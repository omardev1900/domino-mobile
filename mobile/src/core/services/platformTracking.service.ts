import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { db } from './firebase';
import { LogService } from './LogService';

export type TrackedPlatform = 'android' | 'ios' | 'web';
const WRITE_INTERVAL_MS = 24 * 60 * 60 * 1_000;

export function toTrackedPlatform(os: string): TrackedPlatform | null {
    return os === 'android' || os === 'ios' || os === 'web' ? os : null;
}

export function shouldRecordPlatform(lastRecordedAt: number | null, now = Date.now()): boolean {
    return lastRecordedAt === null || now - lastRecordedAt >= WRITE_INTERVAL_MS;
}

class PlatformTrackingService {
    private inFlight = new Set<string>();

    async record(uid: string, now = Date.now()): Promise<void> {
        const platform = toTrackedPlatform(Platform.OS);
        if (uid.startsWith('guest_') || platform === null) return;

        const storageKey = `@platform_tracking:${uid}:${platform}`;
        // Deux appels rapprochés (restauration de session puis retour au premier
        // plan) ne doivent pas produire deux écritures Firestore.
        if (this.inFlight.has(storageKey)) return;
        this.inFlight.add(storageKey);

        try {
            const stored = await AsyncStorage.getItem(storageKey);
            const lastRecordedAt = stored === null ? null : Number(stored);
            if (!shouldRecordPlatform(Number.isFinite(lastRecordedAt) ? lastRecordedAt : null, now)) return;

            const userRef = doc(db, 'users', uid);
            const snapshot = await getDoc(userRef);
            const existingPlatform = snapshot.data()?.platforms?.[platform];
            await setDoc(userRef, {
                platforms: {
                    [platform]: {
                        firstSeenAt: existingPlatform?.firstSeenAt ?? serverTimestamp(),
                        lastSeenAt: serverTimestamp(),
                        appVersion: Constants.expoConfig?.version ?? null,
                    },
                },
                lastPlatform: platform,
                lastPlatformAt: serverTimestamp(),
            }, { merge: true });
            await AsyncStorage.setItem(storageKey, String(now));
        } catch (error) {
            LogService.warn('PlatformTracking', 'Impossible d’enregistrer la plateforme.', error);
        } finally {
            this.inFlight.delete(storageKey);
        }
    }
}

export const platformTrackingService = new PlatformTrackingService();
