import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../core/services/firebase';
import Constants from 'expo-constants';
import { LogService } from '../core/services/LogService';

export type ForceUpdateInfo = {
    isRequired: boolean;
    updateUrl: string;
    message?: string;
};

const DEFAULT_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.dominomartinique.mobile';

export function useForceUpdate() {
    const [updateInfo, setUpdateInfo] = useState<ForceUpdateInfo | null>(null);

    const checkVersion = useCallback(async () => {
        try {
            // Dans Firebase, on ira chercher un document "config/appSettings"
            const configRef = doc(db, 'config', 'appSettings');
            const configSnap = await getDoc(configRef);

            if (configSnap.exists()) {
                const data = configSnap.data();
                const minVersionCode = data?.minVersionCode ?? 0;
                const updateUrl = data?.updateUrl || DEFAULT_PLAY_STORE_URL;
                const message = data?.updateMessage || "Une nouvelle version est disponible. Mettez à jour pour continuer à jouer.";

                // Obtenir le versionCode actuel du build
                const currentVersionCode = Constants.expoConfig?.android?.versionCode ?? 0;

                if (currentVersionCode > 0 && currentVersionCode < minVersionCode) {
                    setUpdateInfo({
                        isRequired: true,
                        updateUrl,
                        message
                    });
                } else {
                    setUpdateInfo(null);
                }
            }
        } catch (err) {
            LogService.warn('useForceUpdate', 'Erreur lors de la vérification de la version:', err);
            // En cas d'erreur (pas de connexion, erreur DB), on ne bloque pas le joueur
        }
    }, []);

    // Vérification initiale
    useEffect(() => {
        checkVersion();
    }, [checkVersion]);

    // Vérification à chaque fois que l'app revient au premier plan
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
            if (state === 'active') {
                checkVersion();
            }
        });
        return () => subscription.remove();
    }, [checkVersion]);

    return updateInfo;
}
