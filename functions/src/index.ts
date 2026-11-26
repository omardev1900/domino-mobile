import { createAddWaitingRoomBot, createReleaseWaitingRoomSeat } from './waitingRoomSeats';
import { createStartCoordinatedRoom } from './coordinatedRoomStart';
import { createConfirmMultiplayerAd, createExpireMultiplayerAds } from './multiplayerAdCycle';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { createHash } from 'node:crypto';
import { RewardEngine } from './core/RewardEngine';
import { RewardCalculationInput } from './core/economy.types';
import { logSystemEvent } from './systemLog';
import { createTerminalGameCoordinator } from './terminalGameCoordinator';
import { createActiveTurnCoordinator } from './activeTurnCoordinator';
import { createPresenceCoordinator } from './presenceCoordinator';
import { createSubmitGameAction } from './submitGameAction';
import { createRequestRematch } from './roomLifecycle';
import { createPublicRoomProjection } from './spectatorProjection';
import { createMatchmakingPresenceCoordinator } from './matchmakingPresence';
import {
    createActivatePremiumTrial,
    createGrantPremiumAccess,
    createPremiumCodesCallable,
    createRedeemPremiumCode,
    isActivePremiumEntitlement,
} from './premiumAccess';
import { createChargeCurrentReplay } from './replayOpen';
import { createOpenMultiplayerReplay } from './replayMultiplayer';
import { createSavePurchasedReplay, createDeleteReplaySlot, createOpenSavedReplay, createListReplayLibrary } from './replayLibrary';
import { createPurchaseReplay, createReadPurchasedReplay } from './replayPurchase';
import { createStripeCheckout } from './premiumStripeCheckout';
import { createStripeWebhook } from './premiumStripeWebhook';
import { createRechargeCodeEmailSender } from './premiumBrevoEmail';
import { createPremiumRechargeCodeReader } from './premiumRechargeCode';
import { createStripeCustomerPortal } from './premiumStripePortal';
import { getMonthlyCochonsFromHistory } from './matchFinalizer';
import { getPreviousLeagueMonthKey, getStartOfLeagueMonth } from './leagueTime';
import { createDebitSoloBuyIn, createRefundSoloBuyIn } from './coinBuyIn';
import { createSettleMultiplayerBuyIn, createSettleTournamentBuyIn } from './multiplayerBuyIn';
import { createBuyReplaySlot, createGetReplayCapacity } from './replaySlotPurchase';
import { createCreditCoins } from './coinCredits';
import { createPurchaseStoreItem } from './storePurchase';
import { createPurchaseChatItem } from './chatPurchase';
import { createAuditCoinAuthority } from './coinAuthorityAudit';
import {
    createBackfillGlobalLeaderboard,
    createGlobalLeaderboardProjection,
} from './globalLeaderboard';

admin.initializeApp();
const db = admin.firestore();
const rtdb = admin.database();

export const chargeCurrentReplay = createChargeCurrentReplay(db);
export const openMultiplayerReplay = createOpenMultiplayerReplay(db);
export const savePurchasedReplay = createSavePurchasedReplay(db);
export const deleteSavedReplay = createDeleteReplaySlot(db);
export const openSavedReplay = createOpenSavedReplay(db);
export const listSavedReplays = createListReplayLibrary(db);
export const buyAndSaveReplay = createPurchaseReplay(db);
export const readSavedReplay = createReadPurchasedReplay(db);

export const activatePremiumTrial = createActivatePremiumTrial(db);
export const grantPremiumAccess = createGrantPremiumAccess(db);
export const createPremiumCodes = createPremiumCodesCallable(db);
export const redeemPremiumCode = createRedeemPremiumCode(db);
export const createPremiumStripeCheckout = createStripeCheckout(db);
export const stripePremiumWebhook = createStripeWebhook(db);
export const sendPremiumRechargeEmail = createRechargeCodeEmailSender(db);
export const getPremiumRechargeCode = createPremiumRechargeCodeReader(db);
export const createPremiumCustomerPortal = createStripeCustomerPortal(db);
export const projectGlobalLeaderboard = createGlobalLeaderboardProjection(db);
export const backfillGlobalLeaderboard = createBackfillGlobalLeaderboard(db);
export const debitSoloBuyIn = createDebitSoloBuyIn(db);
export const refundSoloBuyIn = createRefundSoloBuyIn(db);
export const startCoordinatedRoom = createStartCoordinatedRoom(db);
export const releaseWaitingRoomSeat = createReleaseWaitingRoomSeat(db);
export const addWaitingRoomBot = createAddWaitingRoomBot(db);
export const confirmMultiplayerAd = createConfirmMultiplayerAd(db);
export const expireMultiplayerAds = createExpireMultiplayerAds(db);
export const settleMultiplayerBuyIn = createSettleMultiplayerBuyIn(db);
export const settleTournamentBuyIn = createSettleTournamentBuyIn(db);
export const buyReplaySlot = createBuyReplaySlot(db);
export const getReplayCapacity = createGetReplayCapacity(db);
export const creditCoins = createCreditCoins(db);
export const purchaseStoreItem = createPurchaseStoreItem(db);
export const purchaseChatItem = createPurchaseChatItem(db);
export const auditCoinAuthority = createAuditCoinAuthority(db);

const LOCAL_WEB_ALLOWED_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function applyCorsHeaders(req: functions.https.Request, res: functions.Response<any>) {
    const origin = req.headers.origin;
    if (origin && LOCAL_WEB_ALLOWED_ORIGIN.test(origin)) {
        res.set('Access-Control-Allow-Origin', origin);
        res.set('Vary', 'Origin');
    }
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

function sendCorsPreflight(req: functions.https.Request, res: functions.Response<any>): boolean {
    applyCorsHeaders(req, res);
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return true;
    }
    return false;
}

async function processMatchRewardInternal(
    data: { input: Partial<RewardCalculationInput> },
    uid: string
) {
    const clientInput = data.input;
    const operationId = typeof clientInput.operationId === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(clientInput.operationId)
        ? clientInput.operationId
        : `legacy_reward_${createHash('sha256').update(JSON.stringify(clientInput)).digest('hex').slice(0, 48)}`;

    const userRef = db.collection('users').doc(uid);
    // Le client ne décide jamais du multiplicateur Premium : l'entitlement est lu
    // directement dans Firestore avant le calcul de la récompense.
    const entitlementSnap = await db.collection('premium_entitlements').doc(uid).get();
    const hasPremiumAccess = isActivePremiumEntitlement(
        entitlementSnap.exists
            ? entitlementSnap.data() as { expiresAt?: admin.firestore.Timestamp }
            : undefined,
        Date.now()
    );

    const reward = await db.runTransaction(async transaction => {
        const userSnap = await transaction.get(userRef);
        const entryRef = db.collection('coin_wallets').doc(uid).collection('entries').doc(operationId);
        const entrySnap = await transaction.get(entryRef);
        if (entrySnap.exists) return entrySnap.data()?.reward as ReturnType<typeof RewardEngine.calculate>;

        // Le document mensuel est la source de vérité du compteur courant.
        // Ne jamais le recalculer depuis stats.matchHistory : cette dernière
        // pouvait être réécrite par une ancienne version du mobile.
        const leagueMonth = new Date(getStartOfLeagueMonth(Date.now()));
        const leagueMonthKey = `${leagueMonth.getUTCFullYear()}-${String(leagueMonth.getUTCMonth() + 1).padStart(2, '0')}`;
        const monthId = `${uid}_${leagueMonthKey}`;
        const monthlyRef = db.collection('users_monthly_stats').doc(monthId);
        const monthlySnap = await transaction.get(monthlyRef);

        const userData = userSnap.exists ? userSnap.data() ?? {} : {};
        const existingEconomy: Record<string, any> = userData.economy ?? {};
        const currentCochonsGiven = Number(monthlySnap.data()?.cochonsGiven ?? existingEconomy.cochonsGiven ?? 0);
        const secureInput: RewardCalculationInput = {
            ...(clientInput as RewardCalculationInput),
            currentXP: existingEconomy.xp || 0,
            currentLevel: existingEconomy.level || 1,
            currentLeaguePoints: existingEconomy.leaguePoints || 0,
            currentCochonsGiven,
            isPremium: hasPremiumAccess,
        };
        const computed = RewardEngine.calculate(secureInput);
        let participantSnap: admin.firestore.DocumentSnapshot | null = null;
        let tournamentSnap: admin.firestore.DocumentSnapshot | null = null;
        let participantRef: admin.firestore.DocumentReference | null = null;
        if (clientInput.tournamentId) {
            const tournamentRef = db.collection('tournaments').doc(clientInput.tournamentId);
            participantRef = tournamentRef.collection('participants').doc(uid);
            [participantSnap, tournamentSnap] = await Promise.all([
                transaction.get(participantRef),
                transaction.get(tournamentRef),
            ]);
        }
        const currentCoins = existingEconomy.coins || 0;
        const newEconomy = {
            ...existingEconomy,
            coins: currentCoins + computed.coinsEarned,
            xp: computed.newXP,
            level: computed.newLevel,
            diamonds: (existingEconomy.diamonds || 0) + computed.diamondsEarned,
            leaguePoints: computed.newLeaguePoints,
            leagueGrade: computed.newGrade,
            cochonsGiven: computed.newCochonsGiven,
            unlockedFrames: [...new Set([
                ...(existingEconomy.unlockedFrames || []),
                ...computed.newlyUnlockedFrames.map((frame: any) => frame.frameId),
            ])],
        };
        transaction.set(userRef, { economy: newEconomy }, { merge: true });

        // Les statistiques d'un match authentifié sont écrites par le serveur,
        // dans la même transaction que la récompense. Cela évite qu'un cache
        // local ancien puisse remplacer les compteurs historiques.
        const previousStats: Record<string, any> = userData.stats ?? {};
        const mancheResults = Array.isArray(clientInput.mancheHistory)
            ? clientInput.mancheHistory.map((manche: any) => manche.pointsEarned).filter((value: any) => [5, 4, 2, 1, -1].includes(value))
            : [];
        const playerFinalStats = clientInput.playerFinalStats as any;
        const matchRecord = {
            id: operationId,
            timestamp: Date.now(),
            result: playerFinalStats?.rank === 1 ? 'WIN' : 'LOSS',
            score: Number(playerFinalStats?.totalPoints ?? 0),
            cochons: Number(playerFinalStats?.totalCochons ?? 0),
            roundsWon: Number(playerFinalStats?.mancheWins ?? playerFinalStats?.totalRoundWins ?? 0),
            leaguePointsEarned: computed.leaguePointsEarned,
            mancheLeaguePointsEarned: mancheResults,
            opponents: [],
            mode: clientInput.gameMode ?? 'SOLO',
        };
        const nextHistory = [matchRecord, ...(Array.isArray(previousStats.matchHistory) ? previousStats.matchHistory : [])].slice(0, 500);
        const increment = (value: number) => mancheResults.filter((entry: number) => entry === value).length;
        const nextStats = {
            ...previousStats,
            gamesPlayed: Number(previousStats.gamesPlayed ?? 0) + 1,
            gamesWon: Number(previousStats.gamesWon ?? 0) + (playerFinalStats?.rank === 1 ? 1 : 0),
            totalRoundsWon: Number(previousStats.totalRoundsWon ?? 0) + Number(playerFinalStats?.totalRoundWins ?? playerFinalStats?.mancheWins ?? 0),
            totalCochonsInflicted: Number(previousStats.totalCochonsInflicted ?? 0) + Number(playerFinalStats?.totalCochons ?? 0),
            totalCochonsSubis: Number(previousStats.totalCochonsSubis ?? 0) + increment(-1),
            totalPointsAccumulated: Number(previousStats.totalPointsAccumulated ?? 0) + Number(playerFinalStats?.totalPoints ?? 0),
            totalLeague5Pts: Number(previousStats.totalLeague5Pts ?? 0) + increment(5),
            totalLeague4Pts: Number(previousStats.totalLeague4Pts ?? 0) + increment(4),
            totalLeague2Pts: Number(previousStats.totalLeague2Pts ?? 0) + increment(2),
            totalLeague1Pt: Number(previousStats.totalLeague1Pt ?? 0) + increment(1),
            totalLeagueMinus1Pt: Number(previousStats.totalLeagueMinus1Pt ?? 0) + increment(-1),
            matchHistory: nextHistory,
            lastSync: Date.now(),
        };
        transaction.set(userRef, { stats: nextStats }, { merge: true });

        const monthlyData = monthlySnap.exists ? monthlySnap.data() ?? {} : {};
        transaction.set(monthlyRef, {
            ...monthlyData,
            userId: uid,
            yearMonth: monthId.slice(-7),
            // Le compteur mensuel suit exactement le barème du RewardEngine,
            // comme economy.cochonsGiven, et non le champ de classement brut.
            cochonsGiven: computed.newCochonsGiven,
            cochonsSubis: Number(monthlyData.cochonsSubis ?? 0) + increment(-1),
            pointsAccumulated: Number(monthlyData.pointsAccumulated ?? 0) + Number(playerFinalStats?.totalPoints ?? 0),
            gamesPlayed: Number(monthlyData.gamesPlayed ?? 0) + 1,
            gamesWon: Number(monthlyData.gamesWon ?? 0) + (playerFinalStats?.rank === 1 ? 1 : 0),
            updatedAt: Date.now(),
        }, { merge: true });
        transaction.create(entryRef, {
            amount: computed.coinsEarned,
            reason: 'MATCH_REWARD',
            balanceAfter: newEconomy.coins,
            reward: computed,
            createdAt: Date.now(),
        });

        if (participantRef && tournamentSnap && participantSnap) {
            if (tournamentSnap.exists && tournamentSnap.data()?.status === 'ACTIVE' && participantSnap.exists) {
                const participantData = participantSnap.data() ?? {};
                transaction.update(participantRef, {
                    score: (participantData.score || 0) + (clientInput.playerFinalStats?.totalPoints || computed.xpEarned),
                    gamesPlayed: (participantData.gamesPlayed || 0) + 1,
                    lastPlayedAt: Date.now(),
                });
            }
        }
        return computed;
    });

    console.log(`[processMatchReward] Joueur ${uid} credite: +${reward.coinsEarned} pieces.`);
    await logSystemEvent({
        event: 'match_reward',
        level: 'info',
        functionName: 'processMatchReward',
        uid,
        message: `+${reward.coinsEarned} coins credites apres match`,
        metadata: { coinsEarned: reward.coinsEarned, xpEarned: reward.xpEarned },
    });

    return reward;
}

export const processMatchReward = functions.https.onCall(
    async (data: { input: Partial<RewardCalculationInput> }, context: functions.https.CallableContext) => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'Il faut etre connecte pour traiter une recompense.'
            );
        }

        return processMatchRewardInternal(data, context.auth.uid);
    }
);

export const processMatchRewardHttp = functions.https.onRequest(async (req, res) => {
    if (sendCorsPreflight(req, res)) return;
    applyCorsHeaders(req, res);

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'method-not-allowed' });
        return;
    }

    try {
        const authHeader = req.headers.authorization;
        const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!idToken) {
            res.status(401).json({ error: 'unauthenticated', message: 'Token manquant.' });
            return;
        }

        const decoded = await admin.auth().verifyIdToken(idToken);
        const reward = await processMatchRewardInternal(
            req.body as { input: Partial<RewardCalculationInput> },
            decoded.uid
        );

        res.status(200).json({ result: reward });
    } catch (error: any) {
        if (error instanceof functions.https.HttpsError) {
            const statusByCode: Record<string, number> = {
                'invalid-argument': 400,
                unauthenticated: 401,
                'permission-denied': 403,
                'not-found': 404,
                'failed-precondition': 412,
            };

            res.status(statusByCode[error.code] ?? 500).json({
                error: error.code,
                message: error.message,
            });
            return;
        }

        console.error('[processMatchRewardHttp] Unexpected error:', error);
        res.status(500).json({
            error: 'internal',
            message: error?.message ?? 'Erreur interne.',
        });
    }
});

/**
 * Migration one-shot : réaligne economy.cochonsGiven sur l'historique du mois
 * courant, sans recopier le total historique de stats.totalCochonsInflicted.
 * A appeler une seule fois depuis l'admin, puis désactiver.
 */
export const migrateCochonsGiven = functions.https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Acces refuse.');
    }

    const adminSnap = await db.collection('admins').doc(context.auth.uid).get();
    if (!adminSnap.exists) {
        throw new functions.https.HttpsError('permission-denied', 'Reserve aux admins.');
    }

    const usersSnap = await db.collection('users').get();
    let migrated = 0;
    let skipped = 0;
    const batch = db.batch();

    usersSnap.forEach((userDoc) => {
        const data = userDoc.data();
        const statsHistory = data?.stats?.matchHistory;
        if (!Array.isArray(statsHistory)) {
            skipped++;
            return;
        }
        const statsTotal = getMonthlyCochonsFromHistory(statsHistory, Date.now());
        const economyCochons = data?.economy?.cochonsGiven ?? 0;

        if (statsTotal > economyCochons) {
            batch.update(userDoc.ref, {
                'economy.cochonsGiven': statsTotal,
            });
            migrated++;
        } else {
            skipped++;
        }
    });

    await batch.commit();

    console.log(`[migrateCochonsGiven] Migrated: ${migrated}, Skipped: ${skipped}`);
    await logSystemEvent({
        event: 'cochons_migrated',
        level: 'info',
        functionName: 'migrateCochonsGiven',
        uid: context.auth.uid,
        message: `Migration cochons mensuels terminee : ${migrated} migres, ${skipped} ignores`,
        metadata: { migrated, skipped },
    });
    return { migrated, skipped };
});

export const closeTournament = functions.https.onCall(async (data: { tournamentId: string }, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Acces refuse.');
    }

    const { tournamentId } = data;
    if (!tournamentId) {
        throw new functions.https.HttpsError('invalid-argument', 'id de tournoi manquant.');
    }

    const tournamentRef = db.collection('tournaments').doc(tournamentId);

    return db.runTransaction(async (transaction) => {
        const tournamentSnap = await transaction.get(tournamentRef);
        if (!tournamentSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Tournoi introuvable');
        }

        const tournamentData = tournamentSnap.data()!;
        if (tournamentData.status === 'ENDED') {
            throw new functions.https.HttpsError('failed-precondition', 'Tournoi deja cloture');
        }

        const participantsSnap = await transaction.get(
            tournamentRef.collection('participants').orderBy('score', 'desc').limit(3)
        );
        const winners = participantsSnap.docs;

        const rewards = [
            { coins: tournamentData.reward1st || 0, diamonds: tournamentData.rewardDiamonds1st || 0 },
            { coins: tournamentData.reward2nd || 0, diamonds: 0 },
            { coins: tournamentData.reward3rd || 0, diamonds: 0 },
        ];

        for (let i = 0; i < winners.length; i++) {
            if (i >= rewards.length) break;

            const reward = rewards[i];
            const userId = winners[i].id;
            const userRef = db.collection('users').doc(userId);
            const userSnap = await transaction.get(userRef);

            if (userSnap.exists) {
                const userData = userSnap.data()!;
                const currentCoins = userData.economy?.coins || 0;
                const currentDiamonds = userData.economy?.diamonds || 0;
                transaction.update(userRef, {
                    'economy.coins': currentCoins + reward.coins,
                    'economy.diamonds': currentDiamonds + reward.diamonds,
                });
            }
        }

        transaction.update(tournamentRef, { status: 'ENDED' });

        setTimeout(() => {
            logSystemEvent({
                event: 'tournament_closed',
                level: 'info',
                functionName: 'closeTournament',
                uid: context.auth?.uid,
                message: `Tournoi ${tournamentId} cloture avec ${winners.length} gagnants`,
                metadata: { tournamentId, winnersCount: winners.length },
            });
        }, 0);

        return { success: true, winnersCount: winners.length };
    });
});

/**
 * Suppression de compte - exigee par Google Play depuis 2024.
 * Supprime les donnees Firestore du joueur puis son compte Firebase Auth.
 */
export const deleteUserAccount = functions.https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Vous devez etre connecte.');
    }

    const uid = context.auth.uid;

    try {
        const batch = db.batch();
        const collectionsToDelete = ['users', 'stats', 'economy'];

        for (const collectionName of collectionsToDelete) {
            const ref = db.collection(collectionName).doc(uid);
            const snap = await ref.get();
            if (snap.exists) {
                batch.delete(ref);
            }
        }

        await batch.commit();
        await admin.auth().deleteUser(uid);

        console.log(`[deleteUserAccount] Compte supprime : ${uid}`);
        await logSystemEvent({
            event: 'account_deleted',
            level: 'info',
            functionName: 'deleteUserAccount',
            uid,
            message: 'Compte supprime',
        });
        return { success: true };
    } catch (error: any) {
        console.error(`[deleteUserAccount] Erreur pour ${uid}:`, error);
        await logSystemEvent({
            event: 'function_error',
            level: 'error',
            functionName: 'deleteUserAccount',
            uid,
            message: `Erreur suppression compte: ${error?.message ?? error}`,
        });
        throw new functions.https.HttpsError('internal', 'Erreur lors de la suppression du compte.');
    }
});

/**
 * Remise à zéro mensuelle de la Ligue des Cochons.
 * S'exécute automatiquement le 1er de chaque mois à minuit (00:00 UTC).
 *
 * Actions :
 *  1. Sauvegarde les scores du mois écoulé dans `league_history/{YYYY-MM}/players/{uid}`
 *  2. Remet `leaguePoints` et `cochonsGiven` à 0 dans l'économie de chaque joueur
 *  3. Remet `leagueGrade` à null (grade rechargé depuis 0 au prochain gain)
 */
export const resetMonthlyLeague = functions.pubsub
    .schedule('0 0 1 * *')  // Premier du mois à minuit UTC
    .timeZone('America/Martinique')
    .onRun(async (_context) => {
        const now = new Date();
        // Mois précédent (car on exécute le 1er du mois courant)
        const monthKey = getPreviousLeagueMonthKey(now.getTime());

        console.log(`[resetMonthlyLeague] Début du reset pour le mois ${monthKey}`);

        const usersSnap = await db.collection('users').get();

        if (usersSnap.empty) {
            console.log('[resetMonthlyLeague] Aucun utilisateur trouvé.');
            return null;
        }

        const historyRef = db.collection('league_history').doc(monthKey);
        const BATCH_SIZE = 400;
        let batchCount = 0;
        let batch = db.batch();
        let historyBatch = db.batch();
        let processed = 0;

        for (const userDoc of usersSnap.docs) {
            const uid = userDoc.id;
            const data = userDoc.data();
            const economy = data?.economy ?? {};

            const leaguePoints = economy.leaguePoints ?? 0;
            const cochonsGiven = economy.cochonsGiven ?? 0;
            const leagueGrade = economy.leagueGrade ?? null;

            // 1. Archiver le score du mois
            const playerHistoryRef = historyRef.collection('players').doc(uid);
            historyBatch.set(playerHistoryRef, {
                uid,
                displayName: data?.displayName ?? data?.profile?.displayName ?? 'Inconnu',
                leaguePoints,
                cochonsGiven,
                leagueGrade,
                archivedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // 2. Remettre à zéro
            batch.update(userDoc.ref, {
                'economy.leaguePoints': 0,
                'economy.cochonsGiven': 0,
                'economy.leagueGrade': null,
            });

            batchCount++;
            processed++;

            // Firestore : limite de 500 opérations par batch
            if (batchCount >= BATCH_SIZE) {
                await batch.commit();
                await historyBatch.commit();
                batch = db.batch();
                historyBatch = db.batch();
                batchCount = 0;
            }
        }

        if (batchCount > 0) {
            await batch.commit();
            await historyBatch.commit();
        }

        console.log(`[resetMonthlyLeague] Reset terminé : ${processed} joueurs remis à zéro pour ${monthKey}.`);
        await logSystemEvent({
            event: 'monthly_league_reset',
            level: 'info',
            functionName: 'resetMonthlyLeague',
            uid: 'system',
            message: `Reset mensuel ligue terminé : ${processed} joueurs, mois ${monthKey}`,
            metadata: { monthKey, processed },
        });

        return null;
    });

export * from './cleanupRooms';

export const coordinateTerminalGamePhasesV2 = createTerminalGameCoordinator(db);
export const coordinateActiveGameTurnsV2 = createActiveTurnCoordinator(db);
export const coordinatePresenceLeasesV2 = createPresenceCoordinator(db);
export const coordinateMatchmakingPresenceV1 = createMatchmakingPresenceCoordinator(rtdb);
export const submitGameAction = createSubmitGameAction(db);
export const projectPublicRoomViewsV1 = createPublicRoomProjection(db);
export const requestRematch = createRequestRematch(db);
