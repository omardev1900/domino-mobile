import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    hasAcknowledgedReleaseNotes,
    RELEASE_NOTES_ACKNOWLEDGMENT_KEY,
    RELEASE_VERSION,
} from '../core/releaseNotes';
import { LogService } from '../core/services/LogService';

interface ReleaseNotesState {
    isReady: boolean;
    visible: boolean;
    acknowledge: () => Promise<void>;
}

/**
 * Affiche les nouveautés une seule fois par version et par appareil.
 * L'état est volontairement local : consulter les nouveautés ne nécessite
 * ni lecture Firestore ni donnée personnelle.
 */
export function useReleaseNotes(): ReleaseNotesState {
    const [isReady, setIsReady] = useState(false);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        let isMounted = true;

        AsyncStorage.getItem(RELEASE_NOTES_ACKNOWLEDGMENT_KEY)
            .then((acknowledgedVersion) => {
                if (!isMounted) return;
                setVisible(!hasAcknowledgedReleaseNotes(acknowledgedVersion));
            })
            .catch((error: unknown) => {
                LogService.warn('ReleaseNotes', 'Lecture de l’état des nouveautés impossible', error);
                if (isMounted) setVisible(true);
            })
            .finally(() => {
                if (isMounted) setIsReady(true);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    const acknowledge = useCallback(async () => {
        try {
            await AsyncStorage.setItem(RELEASE_NOTES_ACKNOWLEDGMENT_KEY, RELEASE_VERSION);
        } catch (error) {
            LogService.warn('ReleaseNotes', 'Enregistrement de l’état des nouveautés impossible', error);
        } finally {
            setVisible(false);
        }
    }, []);

    return { isReady, visible, acknowledge };
}
