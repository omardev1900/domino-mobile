import { doc, getDocFromServer, waitForPendingWrites } from 'firebase/firestore';
import { db } from './firebase';

/** Waits for this client's prior writes, then reads a confirmed server balance. */
export async function readConfirmedReplayBalance(uid: string): Promise<number> {
    await waitForPendingWrites(db);
    const snapshot = await getDocFromServer(doc(db, 'users', uid));
    const coins: unknown = snapshot.data()?.economy?.coins;
    if (!snapshot.exists() || typeof coins !== 'number' || !Number.isSafeInteger(coins) || coins < 0) {
        throw new Error('Impossible de confirmer le solde sur le serveur.');
    }
    return coins;
}
