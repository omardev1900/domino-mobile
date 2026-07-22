import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const cleanupGhostRoomsCron = functions.pubsub
  .schedule('every 15 minutes')
  .onRun(async (context) => {
    const db = admin.firestore();
    const now = Date.now();
    // 15 minutes d'inactivité
    const cutoff = now - 15 * 60 * 1000;

    try {
      const snap = await db
        .collection('rooms')
        .where('status', 'in', ['WAITING', 'PLAYING'])
        .where('lastActivity', '<', cutoff)
        .get();

      if (snap.empty) {
        console.log('No ghost rooms to clean.');
        return null;
      }

      const batch = db.batch();
      let closedCount = 0;

      snap.forEach((doc) => {
        batch.update(doc.ref, { status: 'FINISHED' });
        closedCount++;
      });

      await batch.commit();
      console.log(`Successfully closed ${closedCount} ghost rooms.`);
      return null;
    } catch (error) {
      console.error('Error cleaning up ghost rooms:', error);
      return null;
    }
  });
