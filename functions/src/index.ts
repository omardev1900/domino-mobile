import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { RewardEngine } from './core/RewardEngine';
import { RewardCalculationInput } from './core/economy.types';
import { logSystemEvent } from './systemLog';

admin.initializeApp();
const db = admin.firestore();

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

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();

    let currentXP = 0;
    let currentLevel = 1;
    let currentLeaguePoints = 0;
    let currentCochonsGiven = 0;
    let currentCoins = 0;
    let currentDiamonds = 0;

    let existingEconomy: Record<string, any> = {};
    if (userSnap.exists) {
        const userData = userSnap.data();
        if (userData?.economy) {
            existingEconomy = userData.economy;
            currentXP = existingEconomy.xp || 0;
            currentLevel = existingEconomy.level || 1;
            currentLeaguePoints = existingEconomy.leaguePoints || 0;
            currentCochonsGiven = existingEconomy.cochonsGiven ?? existingEconomy.leaguePoints ?? 0;
            currentCoins = existingEconomy.coins || 0;
            currentDiamonds = existingEconomy.diamonds || 0;
        }
    }

    const secureInput: RewardCalculationInput = {
        ...(clientInput as RewardCalculationInput),
        currentXP,
        currentLevel,
        currentLeaguePoints,
        currentCochonsGiven,
    };

    const reward = RewardEngine.calculate(secureInput);

    const newEconomy = {
        ...existingEconomy,
        coins: currentCoins + reward.coinsEarned,
        xp: reward.newXP,
        level: reward.newLevel,
        diamonds: currentDiamonds + reward.diamondsEarned,
        leaguePoints: reward.newLeaguePoints,
        leagueGrade: reward.newGrade,
        cochonsGiven: reward.newCochonsGiven,
        unlockedFrames: [...new Set([
            ...(existingEconomy.unlockedFrames || []),
            ...reward.newlyUnlockedFrames.map((frame: any) => frame.frameId),
        ])],
    };

    await userRef.set({ economy: newEconomy }, { merge: true });

    if (clientInput.tournamentId) {
        try {
            const tournamentId = clientInput.tournamentId;
            const tournamentRef = db.collection('tournaments').doc(tournamentId);
            const participantRef = tournamentRef.collection('participants').doc(uid);
            const pointsToAdd = clientInput.playerFinalStats?.totalPoints || reward.xpEarned;

            await db.runTransaction(async (transaction) => {
                const participantSnap = await transaction.get(participantRef);
                const tournamentSnap = await transaction.get(tournamentRef);

                if (tournamentSnap.exists && tournamentSnap.data()?.status === 'ACTIVE' && participantSnap.exists) {
                    const participantData = participantSnap.data();
                    const currentScore = participantData?.score || 0;
                    const gamesPlayed = participantData?.gamesPlayed || 0;

                    transaction.update(participantRef, {
                        score: currentScore + pointsToAdd,
                        gamesPlayed: gamesPlayed + 1,
                        lastPlayedAt: Date.now(),
                    });
                }
            });

            console.log(`[processMatchReward] Joueur ${uid} credite: +${pointsToAdd} pts au tournoi ${tournamentId}.`);
            await logSystemEvent({
                event: 'tournament_score_update',
                level: 'info',
                functionName: 'processMatchReward',
                uid,
                message: `+${pointsToAdd} pts ajoutes au tournoi ${tournamentId}`,
                metadata: { tournamentId, pointsToAdd },
            });
        } catch (error: any) {
            console.error(`Erreur maj tournoi ${clientInput.tournamentId} pour user ${uid}:`, error);
            await logSystemEvent({
                event: 'function_error',
                level: 'error',
                functionName: 'processMatchReward',
                uid,
                message: `Erreur maj tournoi ${clientInput.tournamentId}: ${error?.message ?? error}`,
                metadata: { tournamentId: clientInput.tournamentId },
            });
        }
    }

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
 * Migration one-shot : copie stats.totalCochonsInflicted -> economy.cochonsGiven
 * pour tous les utilisateurs dont economy.cochonsGiven < stats.totalCochonsInflicted.
 * A appeler une seule fois depuis l'admin, puis desactiver.
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
        const statsTotal = data?.stats?.totalCochonsInflicted ?? 0;
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
        message: `Migration cochons terminee : ${migrated} migres, ${skipped} ignores`,
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
        const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const monthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

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
