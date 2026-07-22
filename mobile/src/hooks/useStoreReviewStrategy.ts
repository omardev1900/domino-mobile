import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LogService } from '../core/services/LogService';

const WIN_COUNT_KEY = '@domino_win_count';
const HAS_ANSWERED_KEY = '@domino_has_answered_review';

export function useStoreReviewStrategy() {
    const [shouldAskReview, setShouldAskReview] = useState(false);

    // Initialise l'état au démarrage
    const init = useCallback(async () => {
        try {
            const hasAnsweredStr = await AsyncStorage.getItem(HAS_ANSWERED_KEY);
            if (hasAnsweredStr === 'true') {
                return; // Le joueur a déjà répondu, on ne fera plus rien
            }
            // Juste pour initialiser, on ne fait rien de plus ici, 
            // la décision se prend à la fin d'un match gagné
        } catch (error) {
            LogService.warn('useStoreReviewStrategy', 'Erreur lors de l\'initialisation', error);
        }
    }, []);

    useEffect(() => {
        init();
    }, [init]);

    // Fonction appelée à chaque victoire locale
    const triggerWinReview = async () => {
        try {
            const hasAnsweredStr = await AsyncStorage.getItem(HAS_ANSWERED_KEY);
            if (hasAnsweredStr === 'true') {
                return; // Plus jamais
            }

            const currentCountStr = await AsyncStorage.getItem(WIN_COUNT_KEY);
            let winCount = currentCountStr ? parseInt(currentCountStr, 10) : 0;
            
            winCount += 1;
            await AsyncStorage.setItem(WIN_COUNT_KEY, winCount.toString());

            // Paliers : 1, 5, 10, 20, 30, 40...
            const isMilestone = 
                winCount === 1 || 
                winCount === 5 || 
                (winCount >= 10 && winCount % 10 === 0);

            if (isMilestone) {
                setShouldAskReview(true);
            }
        } catch (error) {
            LogService.warn('useStoreReviewStrategy', 'Erreur lors du trigger', error);
        }
    };

    // Le joueur a fait un choix (Oui, Bof, Non)
    const markAsAnswered = async () => {
        try {
            await AsyncStorage.setItem(HAS_ANSWERED_KEY, 'true');
            setShouldAskReview(false);
        } catch (error) {
            LogService.warn('useStoreReviewStrategy', 'Erreur markAsAnswered', error);
        }
    };

    // Le joueur a fermé le modal (Plus tard, ou tap en dehors) sans faire de choix
    const dismissPrompt = () => {
        setShouldAskReview(false);
    };

    return {
        shouldAskReview,
        triggerWinReview,
        markAsAnswered,
        dismissPrompt
    };
}
