import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { getYearMonthUtcString } from './leaderboard.time';
import { shouldRecordLastActivity } from '../lastActivity';
import { LogService } from './LogService';

const LAST_ACTIVITY_INTERVAL_MS = 6 * 60 * 60 * 1000;
const storageKeyFor = (uid: string) => `@last_activity_recorded:${uid}`;

class LastActivityService {
    async recordIfDue(uid: string, now: number = Date.now()): Promise<boolean> {
        if (uid.startsWith('guest_')) return false;

        try {
            const storedAt = await AsyncStorage.getItem(storageKeyFor(uid));
            const lastRecordedAt = storedAt === null ? null : Number(storedAt);
            const validLastRecordedAt = Number.isFinite(lastRecordedAt) ? lastRecordedAt : null;
            if (!shouldRecordLastActivity(validLastRecordedAt, now, LAST_ACTIVITY_INTERVAL_MS)) return false;

            await setDoc(doc(db, 'users', uid), { lastActiveAt: serverTimestamp() }, { merge: true });
            await AsyncStorage.setItem(storageKeyFor(uid), String(now));

            // Le document mensuel existe dès qu'un joueur apparaît au classement.
            // updateDoc évite de créer artificiellement une entrée à zéro pour les nouveaux joueurs.
            await updateDoc(
                doc(db, 'users_monthly_stats', `${uid}_${getYearMonthUtcString()}`),
                { lastActiveAt: serverTimestamp() }
            ).catch((error: unknown) => {
                LogService.info('LastActivity', 'Statistique mensuelle absente, activité mensuelle ignorée', error);
            });

            return true;
        } catch (error) {
            LogService.warn('LastActivity', 'Enregistrement de l’activité impossible', error);
            return false;
        }
    }
}

export const lastActivityService = new LastActivityService();
