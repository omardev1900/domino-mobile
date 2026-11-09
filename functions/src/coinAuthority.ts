import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

/** One-shot migration switch: call after the server-owned client is released. */
export const createMigrateCoinAuthority = (db: admin.firestore.Firestore) => functions.region('europe-west1').https.onCall(async (_data: unknown, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Connexion requise.');
    const adminSnap = await db.collection('admins').doc(context.auth.uid).get();
    if (!adminSnap.exists) throw new functions.https.HttpsError('permission-denied', 'Réservé aux administrateurs.');
    const users = await db.collection('users').get();
    let batch = db.batch(); let pending = 0; let migrated = 0;
    for (const user of users.docs) {
        batch.update(user.ref, { coinAuthority: 'server' }); pending++; migrated++;
        if (pending === 400) { await batch.commit(); batch = db.batch(); pending = 0; }
    }
    if (pending) await batch.commit();
    return { migrated };
});
