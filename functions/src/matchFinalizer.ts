import * as admin from 'firebase-admin';

import { TABLE_CONFIGS } from './core/economy.constants';
import { LeagueFrameId, MatchReward, TableTier } from './core/economy.types';
import { RewardEngine } from './core/RewardEngine';
import { hasTransitionFingerprint, TransitionFingerprint } from './gameCoordinator';
import { GameRoom, PlayerProfile } from './gameCore/types';

type DocumentData = Record<string, unknown>;

export interface PlayerFinalization {
    economy: DocumentData;
    stats: DocumentData;
    monthlyStats: DocumentData;
    reward: MatchReward;
}

const asRecord = (value: unknown): DocumentData =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value as DocumentData
        : {};

const asNumber = (value: unknown, fallback = 0): number =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const asStringArray = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];

const getYearMonthUtc = (timestamp: number): string => {
    const date = new Date(timestamp);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

const getMonthStartUtc = (timestamp: number): number => {
    const date = new Date(timestamp);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
};

export const getMatchParticipantIds = (room: GameRoom): string[] => {
    if (room.participantIds?.length) return [...new Set(room.participantIds)];
    const gameParticipants = (room.gameState?.players ?? [])
            .filter(player => player.status !== 'BOT')
            .map(player => player.id);
    if (gameParticipants.length) return [...new Set(gameParticipants)];
    return [...new Set(
        room.players
            .filter(profile => profile.status !== 'BOT')
            .map(profile => profile.uid)
    )];
};

export const resolveTableTier = (buyIn?: number): TableTier => {
    const match = Object.values(TABLE_CONFIGS).find(config => config.buyIn === buyIn);
    return match?.tier ?? 'DEBUTANT';
};

const getProfile = (room: GameRoom, uid: string): PlayerProfile | undefined =>
    room.participantProfiles?.find(profile => profile.uid === uid)
    ?? room.players.find(profile => profile.uid === uid);

export const buildPlayerFinalization = (
    room: GameRoom,
    uid: string,
    userData: DocumentData,
    finalizationId: string,
    now: number
): PlayerFinalization => {
    const state = room.gameState;
    if (!state || state.phase !== 'MATCH_END') {
        throw new Error('MATCH_END state required for finalization.');
    }
    const player = state.players.find(candidate => candidate.id === uid);
    if (!player) throw new Error(`Player ${uid} is absent from final state.`);

    const economy = asRecord(userData.economy);
    const stats = asRecord(userData.stats);
    const unlockedFrames = asStringArray(economy.unlockedFrames) as LeagueFrameId[];
    const rewardInput = RewardEngine.buildInputFromGameState({
        gameState: state,
        localPlayerId: uid,
        currentLevel: asNumber(economy.level, 1),
        currentXP: asNumber(economy.xp),
        currentLeaguePoints: asNumber(economy.leaguePoints),
        currentCochonsGiven: asNumber(economy.cochonsGiven, asNumber(stats.totalCochonsInflicted)),
        unlockedFrames,
        tableTier: resolveTableTier(room.buyIn),
        isSoloMode: false,
    });
    const reward = RewardEngine.calculate(rewardInput);
    const newUnlockedFrames = [...new Set([
        ...unlockedFrames,
        ...reward.newlyUnlockedFrames.map(frame => frame.frameId),
    ])];

    const manchePoints = rewardInput.mancheHistory
        .map(manche => manche.pointsEarned)
        .filter(points => [5, 4, 2, 1, -1].includes(points));
    const incrementCount = (points: number) => manchePoints.filter(value => value === points).length;
    const ranking = rewardInput.playerFinalStats;
    const opponents = state.players.filter(candidate => candidate.id !== uid).map(opponent => {
        const profile = getProfile(room, opponent.id);
        return { name: opponent.name, avatarId: profile?.avatarId ?? opponent.avatarId ?? 'avatar_default' };
    });
    const history = Array.isArray(stats.matchHistory) ? stats.matchHistory : [];
    const matchRecord = {
        id: finalizationId,
        timestamp: now,
        result: ranking.rank === 1 ? 'WIN' : 'LOSS',
        score: player.totalPoints || 0,
        cochons: player.totalCochonsInfliges || 0,
        roundsWon: player.mancheWins || 0,
        leaguePointsEarned: reward.leaguePointsEarned,
        mancheLeaguePointsEarned: manchePoints,
        opponents,
        mode: 'MULTIPLAYER',
    };
    const nextHistory = [matchRecord, ...history].slice(0, 500);
    const nextStats: DocumentData = {
        ...stats,
        gamesPlayed: asNumber(stats.gamesPlayed) + 1,
        gamesWon: asNumber(stats.gamesWon) + (ranking.rank === 1 ? 1 : 0),
        totalRoundsWon: asNumber(stats.totalRoundsWon) + (player.mancheWins || 0),
        totalCochonsInflicted: asNumber(stats.totalCochonsInflicted) + (player.totalCochonsInfliges || 0),
        totalCochonsSubis: asNumber(stats.totalCochonsSubis) + incrementCount(-1),
        totalPointsAccumulated: asNumber(stats.totalPointsAccumulated) + (player.totalPoints || 0),
        totalLeague5Pts: asNumber(stats.totalLeague5Pts) + incrementCount(5),
        totalLeague4Pts: asNumber(stats.totalLeague4Pts) + incrementCount(4),
        totalLeague2Pts: asNumber(stats.totalLeague2Pts) + incrementCount(2),
        totalLeague1Pt: asNumber(stats.totalLeague1Pt) + incrementCount(1),
        totalLeagueMinus1Pt: asNumber(stats.totalLeagueMinus1Pt) + incrementCount(-1),
        matchHistory: nextHistory,
        lastSync: now,
    };

    const nextEconomy: DocumentData = {
        ...economy,
        coins: asNumber(economy.coins) + reward.coinsEarned,
        xp: reward.newXP,
        level: reward.newLevel,
        diamonds: asNumber(economy.diamonds) + reward.diamondsEarned,
        leaguePoints: reward.newLeaguePoints,
        leagueGrade: reward.newGrade,
        cochonsGiven: reward.newCochonsGiven,
        unlockedFrames: newUnlockedFrames,
    };

    const monthStart = getMonthStartUtc(now);
    const monthlyHistory = nextHistory.filter(record => asNumber(asRecord(record).timestamp) >= monthStart);
    const monthlyStats = {
        userId: uid,
        yearMonth: getYearMonthUtc(now),
        cochonsGiven: monthlyHistory.reduce((sum, record) => sum + asNumber(asRecord(record).cochons), 0),
        cochonsSubis: monthlyHistory.reduce((sum, record) => {
            const values = asRecord(record).mancheLeaguePointsEarned;
            return sum + (Array.isArray(values) ? values.filter(value => value === -1).length : 0);
        }, 0),
        pointsAccumulated: monthlyHistory.reduce((sum, record) => sum + asNumber(asRecord(record).score), 0),
        gamesPlayed: monthlyHistory.length,
        displayName: getProfile(room, uid)?.displayName ?? player.name,
        avatarId: getProfile(room, uid)?.avatarId ?? player.avatarId ?? 'avatar_default',
        activeFrame: economy.activeFrame ?? null,
        updatedAt: now,
    };

    return { economy: nextEconomy, stats: nextStats, monthlyStats, reward };
};

export const finalizeCoordinatedMatch = async (
    db: admin.firestore.Firestore,
    roomId: string,
    expected: TransitionFingerprint
): Promise<boolean> => {
    const roomRef = db.collection('rooms').doc(roomId);
    return db.runTransaction(async transaction => {
        const roomSnapshot = await transaction.get(roomRef);
        if (!roomSnapshot.exists) return false;
        const room = roomSnapshot.data() as GameRoom;
        const state = room.gameState;
        if (
            room.coordinatorVersion !== 1
            || !state
            || !hasTransitionFingerprint(state, expected)
            || state.phase !== 'MATCH_END'
        ) return false;

        const finalizationId = `match:${roomId}:${state.stateVersion ?? 0}:${state.mancheNumber}:${state.roundNumber}`;
        if (room.finalization?.id === finalizationId && room.finalization.status === 'COMPLETED') return false;

        const participantIds = getMatchParticipantIds(room);
        const userRefs = participantIds.map(uid => db.collection('users').doc(uid));
        const userSnapshots = await Promise.all(userRefs.map(ref => transaction.get(ref)));
        const now = Date.now();
        const rewards: Record<string, MatchReward> = {};

        participantIds.forEach((uid, index) => {
            const userData = userSnapshots[index].exists
                ? userSnapshots[index].data() as DocumentData
                : {};
            const finalized = buildPlayerFinalization(room, uid, userData, finalizationId, now);
            rewards[uid] = finalized.reward;
            const userUpdate: DocumentData = {
                economy: finalized.economy,
                stats: finalized.stats,
            };
            if (userData.activeRoomId === roomId) userUpdate.activeRoomId = null;
            transaction.set(userRefs[index], userUpdate, { merge: true });
            const monthId = `${uid}_${finalized.monthlyStats.yearMonth}`;
            transaction.set(
                db.collection('users_monthly_stats').doc(monthId),
                finalized.monthlyStats,
                { merge: true }
            );
        });

        transaction.update(roomRef, {
            status: 'FINISHED',
            finalization: {
                id: finalizationId,
                status: 'COMPLETED',
                completedAt: admin.firestore.FieldValue.serverTimestamp(),
                rewards,
            },
            coordinator: {
                ...(room.coordinator ?? { version: 1 }),
                version: 1,
                lastTransitionId: finalizationId,
                lastTransitionAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            lastActivity: now,
        });
        return true;
    });
};
