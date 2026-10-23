import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

type Data = admin.firestore.DocumentData;

export const buildGlobalLeaderboardProjection = (uid: string, user: Data): Data => {
    const economy = user.economy ?? {};
    const stats = user.stats ?? {};
    const history = Array.isArray(stats.matchHistory) ? stats.matchHistory : [];
    const legacyCochonsSubis = history.reduce((sum: number, match: Data) => {
        const mancheValues = Array.isArray(match.mancheLeaguePointsEarned)
            ? match.mancheLeaguePointsEarned
            : typeof match.leaguePointsEarned === 'number'
                ? [match.leaguePointsEarned]
                : [];
        return sum + mancheValues.filter((value: unknown) => value === -1).length;
    }, 0);
    return {
        userId: uid,
        displayName: user.displayName ?? user.email?.split('@')[0] ?? 'Joueur',
        avatarId: user.avatarId ?? user.avatarUrl ?? 'avatar_default',
        activeFrame: economy.activeFrame ?? null,
        xp: economy.xp ?? 0,
        coins: economy.coins ?? 0,
        level: economy.level ?? 1,
        leagueGrade: economy.leagueGrade ?? null,
        leaguePoints: economy.leaguePoints ?? 0,
        cochonsGiven: stats.totalCochonsInflicted ?? economy.cochonsGiven ?? 0,
        cochonsSubis: stats.totalCochonsSubis ?? legacyCochonsSubis,
        pointsAccumulated: stats.totalPointsAccumulated ?? 0,
        gamesPlayed: stats.gamesPlayed ?? 0,
        lastActiveAt: user.lastActiveAt ?? null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
};

export const createGlobalLeaderboardProjection = (db: admin.firestore.Firestore) =>
    functions.firestore.document('users/{uid}').onWrite(async (change, context) => {
        const target = db.collection('users_global_stats').doc(context.params.uid);
        if (!change.after.exists) {
            await target.delete();
            return;
        }
        await target.set(
            buildGlobalLeaderboardProjection(context.params.uid, change.after.data() ?? {}),
            { merge: true }
        );
    });

export const createBackfillGlobalLeaderboard = (db: admin.firestore.Firestore) =>
    functions.https.onCall(async (_data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Authentification requise.');
        }
        const adminDoc = await db.collection('admins').doc(context.auth.uid).get();
        if (!adminDoc.exists) {
            throw new functions.https.HttpsError('permission-denied', 'Accès administrateur requis.');
        }

        let processed = 0;
        let cursor: admin.firestore.QueryDocumentSnapshot | undefined;
        do {
            let query: admin.firestore.Query = db.collection('users')
                .orderBy(admin.firestore.FieldPath.documentId())
                .limit(400);
            if (cursor) query = query.startAfter(cursor);
            const snapshot = await query.get();
            if (snapshot.empty) break;

            const batch = db.batch();
            snapshot.docs.forEach(userDoc => {
                batch.set(
                    db.collection('users_global_stats').doc(userDoc.id),
                    buildGlobalLeaderboardProjection(userDoc.id, userDoc.data()),
                    { merge: true }
                );
            });
            await batch.commit();
            processed += snapshot.size;
            cursor = snapshot.docs[snapshot.docs.length - 1];
        } while (cursor);

        return { processed };
    });
