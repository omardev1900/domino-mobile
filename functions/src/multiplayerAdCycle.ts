import { LogService } from './core/services/LogService';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { z } from 'zod';
import { GameRoom, GameState, MultiplayerAdCycle } from './gameCore/types';
import { computeCoordinatorDecision } from './gameCoordinator';
import { isFreshPresenceLease } from './presenceCoordinator';
import { prepareRoomBuyIn } from './coordinatedRoomBuyIn';
import { getReplaySessionId, recordReplayTransition } from './replayCapture';

const AD_WINDOW_MS = 75_000;
const RECONNECT_WINDOW_MS = 45_000;

export function makeAdCycle(
    session: string,
    kind: MultiplayerAdCycle['kind'],
    state: GameState,
    now: number,
): MultiplayerAdCycle {
    return {
        id: [session, kind, state.mancheNumber, state.roundNumber, state.stateVersion].join(':'),
        kind,
        confirmedPlayerIds: [],
        deadline: now + AD_WINDOW_MS,
        reconnecting: false,
    };
}

export function needsIntermission(room: GameRoom): boolean {
    const state = room.gameState;
    return room.adPolicy === 'SYNCHRONIZED'
        && state?.phase === 'MANCHE_END' && state.mancheNumber > 0 && state.mancheNumber % 3 === 0;
}

export async function advanceAdCycle(
    db: admin.firestore.Firestore,
    roomId: string,
    cycleId: string,
    uid?: string,
    clock = Date.now,
): Promise<void> {
    const ref = db.collection('rooms').doc(roomId);
    const outcome = await db.runTransaction(async tx => {
        const room = (await tx.get(ref)).data() as GameRoom | undefined;
        if (!room || room.adPolicy !== 'SYNCHRONIZED' || !room.gameState || !room.replaySessionId) return;
        const cycle = room.adCycle;
        if (!cycle || cycle.id !== cycleId) return;
        if (cycle.kind === 'FINAL' ? room.status !== 'FINISHED' : room.status !== 'PLAYING') return;
        const now = clock();
        const participants = room.participantIds ?? [];
        const humans = cycle.kind === 'FINAL'
            ? participants.filter(id => room.gameState?.players.some(player => player.id === id && player.status !== 'SURRENDERED'))
            : participants;
        if (uid && !humans.includes(uid)) return;

        const expired = now >= cycle.deadline;
        const canConfirm = uid && (!expired || (!cycle.reconnecting && cycle.kind !== 'FINAL'));
        const confirmed = canConfirm && !cycle.confirmedPlayerIds.includes(uid)
            ? [...cycle.confirmedPlayerIds, uid] : cycle.confirmedPlayerIds;
        const everyoneReady = humans.every(id => confirmed.includes(id));

        if (cycle.kind === 'FINAL' && (everyoneReady || expired)) {
            tx.update(ref, { adCycle: null });
            return 'final_revealed';
        }
        if (cycle.kind !== 'FINAL' && everyoneReady && !expired
            && humans.every(id => room.gameState?.players.some(player => player.id === id && player.status !== 'SURRENDERED')
                && isFreshPresenceLease(room, id, now))) {
            const state = room.gameState;
            const decision = cycle.kind === 'INTERMISSION' ? computeCoordinatorDecision(state) : null;
            if (cycle.kind === 'INTERMISSION' && decision?.kind !== 'ADVANCE') return;
            const playable = decision?.kind === 'ADVANCE' ? decision.nextState : state;
            const nextState: GameState = {
                ...playable,
                players: playable.players.map(player => player.status === 'DISCONNECTED' && humans.includes(player.id)
                    ? { ...player, status: 'HUMAN' } : player),
                phase: 'PLAYING',
                lastActionTimestamp: now,
            };
            if (cycle.kind === 'INTERMISSION') {
                recordReplayTransition(db, tx, roomId, room, state, nextState);
            }
            tx.update(ref, { adCycle: null, gameState: withoutUndefined(nextState), lastActivity: now });
            return cycle.reconnecting ? 'resumed' : 'advanced';
        }
        const someoneLeft = cycle.kind !== 'FINAL' && room.gameState.players
            .some(player => humans.includes(player.id) && player.status === 'SURRENDERED');
        if (!someoneLeft && expired && !cycle.reconnecting) {
            tx.update(ref, {
                adCycle: { ...cycle, confirmedPlayerIds: confirmed, reconnecting: true, deadline: now + RECONNECT_WINDOW_MS },
                lastActivity: now,
            });
            return 'reconnecting';
        }
        if (someoneLeft || (expired && cycle.reconnecting)) {
            const refund = await prepareRoomBuyIn(db, tx, roomId, room.replaySessionId, humans, room.managedBuyIn ?? 0, 'refund', now);
            if (refund.blocked) throw new Error('Unable to refund cancelled multiplayer match.');
            refund.apply();
            const replayId = getReplaySessionId(roomId, room);
            if (replayId && cycle.kind === 'INTERMISSION') {
                tx.set(db.collection('replay_sessions').doc(replayId), { status: 'CANCELLED' }, { merge: true });
            }
            tx.update(ref, {
                status: 'FINISHED',
                adCycle: null,
                adCancelled: true,
                gameState: null,
                lastActivity: now,
            });
            return 'cancelled';
        }
        if (confirmed !== cycle.confirmedPlayerIds) {
            tx.update(ref, { 'adCycle.confirmedPlayerIds': confirmed });
        }
        return undefined;
    });
    if (outcome) LogService.info('MultiplayerAdCycle', 'Multiplayer ad cycle updated.', { roomId, cycleId, outcome });
}

function withoutUndefined(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(withoutUndefined);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value)
            .filter(([, child]) => child !== undefined)
            .map(([key, child]) => [key, withoutUndefined(child)]));
    }
    return value;
}

const confirmationSchema = z.object({
    roomId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
    cycleId: z.string().min(1).max(160),
}).strict();

export const createConfirmMultiplayerAd = (db: admin.firestore.Firestore) =>
    functions.region('europe-west1').https.onCall(async (raw: unknown, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Connexion requise.');
        const input = confirmationSchema.safeParse(raw);
        if (!input.success) throw new functions.https.HttpsError('invalid-argument', 'Cycle publicitaire invalide.');
        await advanceAdCycle(db, input.data.roomId, input.data.cycleId, context.auth.uid);
        return { received: true };
    });

export const createExpireMultiplayerAds = (db: admin.firestore.Firestore) =>
    functions.region('europe-west1').pubsub.schedule('* * * * *').onRun(async () => {
        const expired = await db.collection('rooms').where('adCycle.deadline', '<=', Date.now()).get();
        const outcomes = await Promise.allSettled(expired.docs.map(snapshot => {
            const cycle = (snapshot.data() as GameRoom).adCycle;
            return cycle ? advanceAdCycle(db, snapshot.id, cycle.id) : undefined;
        }));
        const failure = outcomes.find(result => result.status === 'rejected');
        if (failure?.status === 'rejected') throw failure.reason;
    });
