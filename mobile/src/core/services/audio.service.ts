import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { LogService } from './LogService';

export interface RemoteAudioConfig {
    id: string;
    url: string;
    type: 'BGM' | 'SFX';
    eventName?: string;
}

class AudioService {
    private static instance: AudioService;
    private db = getFirestore();

    private constructor() {}

    static getInstance(): AudioService {
        if (!AudioService.instance) {
            AudioService.instance = new AudioService();
        }
        return AudioService.instance;
    }

    /**
     * Récupère la configuration audio depuis Firestore
     */
    async fetchAudioConfig(): Promise<RemoteAudioConfig[]> {
        try {
            const configRef = doc(this.db, 'config', 'audio');
            const snap = await getDoc(configRef);
            
            if (snap.exists()) {
                const data = snap.data();
                return data.assets || [];
            }
            return [];
        } catch (error) {
            LogService.error('AudioService', 'Failed to fetch audio config', error);
            return [];
        }
    }

    /**
     * TODO: Implémenter le téléchargement et le cache local avec expo-file-system
     */
    async syncRemoteSounds() {
        LogService.info('AudioService', 'Syncing remote sounds (Placeholder)');
        // 1. Fetch URLs from Firestore
        // 2. Compare with local cache
        // 3. Download missing files
    }
}

export default AudioService.getInstance();
