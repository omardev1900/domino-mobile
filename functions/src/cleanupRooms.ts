import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

import { LogService } from './core/services/LogService';
import { closeRoomAndClearUsers } from './roomLifecycle';

export const cleanupGhostRoomsCron = functions.pubsub
    .schedule('every 15 minutes')
    .onRun(async () => {
        const db = admin.firestore();
        const now = Date.now();
        const staleCutoff = now - 15 * 60 * 1000;
        const finishedCutoff = now - 24 * 60 * 60 * 1000;

        try {
            const staleRooms = await db
                .collection('rooms')
                .where('lastActivity', '<', staleCutoff)
                .get();
            const staleActiveRooms = staleRooms.docs.filter(room =>
                room.data().status === 'WAITING' || room.data().status === 'PLAYING'
            );
            const expiredFinishedRooms = staleRooms.docs.filter(room =>
                room.data().status === 'FINISHED'
                && typeof room.data().lastActivity === 'number'
                && room.data().lastActivity < finishedCutoff
            );

            let closedCount = 0;
            for (const room of staleActiveRooms) {
                if (await closeRoomAndClearUsers(db, room.id)) closedCount += 1;
            }

            let deletedCount = 0;
            for (const room of expiredFinishedRooms) {
                if (await closeRoomAndClearUsers(db, room.id, true)) deletedCount += 1;
            }

            LogService.info('cleanupGhostRoomsCron', 'Room cleanup completed.', {
                closedCount,
                deletedCount,
            });
            return null;
        } catch (error) {
            LogService.error('cleanupGhostRoomsCron', 'Room cleanup failed.', error);
            throw error;
        }
    });
