import { GameState, Player, PlayerId, GameMode, MancheResult } from './types';
import { MANCHE_WIN_THRESHOLD, WINS_TO_WIN_MATCH } from './constants';
import { LogService } from './services/LogService';

/**
 * calculateHandPoints : Somme des points d'une main
 */
export const calculateHandPoints = (hand: any[]): number => {
    return hand.reduce((sum, d) => sum + d.left + d.right, 0);
};

export const determineWinnerOnBoudé = (players: Player[]): PlayerId | 'TIE' => {
    // Guard : Math.min(...[]) === Infinity → écriture Firestore rejetée (400)
    if (players.length === 0) {
        LogService.error('ScoringEngine', 'determineWinnerOnBoudé appelé sans joueurs');
        return 'TIE';
    }
    const scores = players.map(p => ({ id: p.id, score: calculateHandPoints(p.hand), hand: p.hand }));
    const minScore = Math.min(...scores.map(s => s.score));
    const candidates = scores.filter(s => s.score === minScore);

    if (candidates.length === 1) return candidates[0].id;

    // RULE: If more than one player has the same minimum score, it's a TIE.
    // No tie-breaker. The round is ignored and restarted.
    return 'TIE';
};

/**
 * finalizeRound : Logique stricte de fin de round.
 * 
 * --- CLARIFICATION DES RÈGLES (Sprint 2) ---
 * 
 * C1 (Points) : La double attribution est évitée en ajoutant systématiquement 1 point
 * par round gagné au 'totalPoints'. Les bonus de "Cochon" (Manche) ne sont ajoutés
 * qu'à la fin de la manche (mancheWinner) en sus des points déjà acquis.
 * 
 * C2 (Winner) : 'firstPlayerOfRound' est mis à jour pour refléter le vainqueur du round
 * ou de la manche, garantissant une sémantique claire pour le prochain démarrage.
 * 
 * C3 (Reset) : Le reset des étoiles (currentMancheStars) et du statut Cochon (isCochon)
 * est centralisé dans 'preparePlayersForNextRound' pour être appelé par le LogicEngine.
 */
export const finalizeRound = (
    gameState: GameState,
    winnerId: PlayerId | 'TIE'
): GameState => {
    // 0. Clone state
    const newState = JSON.parse(JSON.stringify(gameState)) as GameState;
    newState.stateVersion = (newState.stateVersion || 0) + 1; // FIX-MULTI-P1

    if (winnerId === 'TIE') {
        newState.phase = 'BOUDE';
        return newState;
    }

    // --- MODE VICTOIRE : Logique indépendante (pas de manche, pas de chiré, pas de cochon) ---
    // Le match se joue en rounds purs. Le premier joueur à atteindre winningCondition victoires gagne.
    if (newState.gameMode === 'VICTOIRE') {
        newState.players = newState.players.map(p => {
            if (p.id === winnerId) {
                return {
                    ...p,
                    totalRoundWins: (p.totalRoundWins || 0) + 1,
                    totalPoints: (p.totalPoints || 0) + 1,
                };
            }
            return p;
        });
        newState.firstPlayerOfRound = winnerId;
        newState.mancheResult = null;

        const roundWinner = newState.players.find(p => p.id === winnerId);
        if (roundWinner && (roundWinner.totalRoundWins || 0) >= newState.winningCondition) {
            newState.phase = 'MATCH_END';
        } else {
            newState.phase = 'PARTIE_END';
        }
        return newState;
    }

    // --- ETAPE 1 : ATTRIBUTION ---
    // Le gagnant reçoit +1 Étoile (currentMancheStars) et +1 Point de Round (totalRoundWins)
    const pointsGainedInRound: { [playerId: string]: number } = {};
    newState.players = newState.players.map(p => {
        if (p.id === winnerId) {
            pointsGainedInRound[p.id] = 1;
            return {
                ...p,
                currentMancheStars: p.currentMancheStars + 1, // Étoile (+1 currentMancheStars)
                totalRoundWins: (p.totalRoundWins || 0) + 1, // Point de Round permanent
                totalPoints: (p.totalPoints || 0) + 1 // Add 1 point per round win immediately
            };
        }
        pointsGainedInRound[p.id] = 0;
        return p;
    });

    // --- ETAPE 2 : DÉTECTION CHIRÉE (PRIORITÉ 1) ---
    // Si TOUS les joueurs ont au moins 1 étoile.
    const isChire = newState.players.every(p => p.currentMancheStars >= 1);

    if (isChire) {
        LogService.info('Scoring', "CHIRÉE DETECTED! Manche ends, manche increments.");

        // On ne remet PAS les étoiles à 0 ici.
        // L'écran de résultat (GameOverScreen / UnifiedResultOverlay) a besoin de lire les 'currentMancheStars' pour les afficher.
        // L'effacement des étoiles se fera via `handleNextRound` dans GameScreen.tsx lors du clic sur 'Manche suivante'.

        newState.mancheResult = 'CHIRE';
        newState.firstPlayerOfRound = winnerId; // Round winner restarts

        // ✅ FIX 1: Prendre un cliché des étoiles acquises pendant la manche chirée avant la remise à zéro
        const chirePointsGained: { [playerId: string]: number } = {};
        newState.players.forEach(p => {
            chirePointsGained[p.id] = p.currentMancheStars;
        });

        if (!newState.mancheHistory) newState.mancheHistory = [];
        newState.mancheHistory.push({
            mancheNumber: newState.mancheHistory.length + 1,
            points: chirePointsGained, // Affiche les étoiles collectées avant l'annulation
            winnerId: 'TIE', // Aucun vainqueur officiel sur une chirée
            resultType: 'CHIRE',
            cochonCount: 0
        });

        // ✅ FIX 2: Use MANCHE_END so handleNextRound increments mancheNumber
        newState.phase = 'MANCHE_END';
    }

    // --- ETAPE 3 : DÉTECTION VICTOIRE MANCHE (PRIORITÉ 2) ---
    const mancheWinner = !isChire ? newState.players.find(p => p.currentMancheStars >= MANCHE_WIN_THRESHOLD) : null;

    if (mancheWinner) {
        LogService.info('Scoring', `MANCHE WINNER: ${mancheWinner.id}`);
        // 3.2 Calcul Bonus/Malus Cochon
        const losersAtZero = newState.players.filter(p => p.currentMancheStars === 0);
        const cochonCount = losersAtZero.length;

        if (cochonCount > 0) {
            LogService.info('Scoring', `COCHON DETECTED! Count: ${cochonCount}`);
            newState.mancheResult = 'COCHON';
        } else {
            LogService.info('Scoring', "Manche finished normally.");
            newState.mancheResult = 'NORMAL';
        }

        // --- CALCULATION OF FINAL MANCHE POINTS (Rule of +5) ---
        newState.players = newState.players.map(p => {
            let historyPointsForManche = 0;
            let updatedPlayer = { ...p };

            if (p.id === mancheWinner.id) {
                // All rounds were already added to totalPoints in Step 1.
                // We only add the extra "cochon" bonus points here.
                const bonus = cochonCount;
                historyPointsForManche = p.currentMancheStars + bonus;

                updatedPlayer = {
                    ...p,
                    mancheWins: p.mancheWins + 1,
                    totalPoints: (p.totalPoints || 0) + bonus,
                    // Source de vérité métier : les cochons visibles/gagnants sont les cochons infligés.
                    // `totalCochons` reste un alias legacy aligné sur ce compteur pour éviter de casser
                    // d'anciens écrans qui ne seraient pas encore migrés.
                    totalCochonsInfliges: (p.totalCochonsInfliges || 0) + cochonCount,
                    totalCochons: (p.totalCochons || 0) + cochonCount
                };
            } else if (p.currentMancheStars === 0) {
                historyPointsForManche = -1;
                updatedPlayer = {
                    ...p,
                    isCochon: true,
                    totalPoints: (p.totalPoints || 0) - 1,
                    // Le perdant ne gagne pas de cochon : il subit seulement le malus.
                    totalCochonsSubis: (p.totalCochonsSubis || 0) + 1
                };
            } else {
                historyPointsForManche = p.currentMancheStars;
            }

            pointsGainedInRound[p.id] = historyPointsForManche;
            return updatedPlayer;
        });

        // Record Manche History
        if (!newState.mancheHistory) newState.mancheHistory = [];
        newState.mancheHistory.push({
            mancheNumber: newState.mancheHistory.length + 1,
            points: pointsGainedInRound,
            winnerId: mancheWinner.id,
            resultType: newState.mancheResult || 'NORMAL',
            cochonCount: cochonCount
        });
    }

    // Ensure firstPlayerOfRound is ALWAYS updated to the round winner
    // This is used for animations and avatar display in overlays
    newState.firstPlayerOfRound = winnerId;

    let isMatchOver = false;

    if (!isChire && !mancheWinner) {
        newState.mancheResult = null;

        newState.phase = 'PARTIE_END';
    }

    // 3.3 Check Match End

    if (mancheWinner || isChire) {
        if (newState.gameMode === 'SCORE') {
            // Mode SCORE : le seuil se vérifie uniquement à la fin d'une manche complète.
            // Si plusieurs joueurs partagent le meilleur score au franchissement du seuil,
            // on continue sur une manche supplémentaire jusqu'au départage.
            const maxPoints = Math.max(...newState.players.map(p => p.totalPoints || 0));
            if (maxPoints >= newState.winningCondition) {
                const leaders = newState.players.filter(p => (p.totalPoints || 0) === maxPoints);
                isMatchOver = leaders.length === 1;
                if (leaders.length > 1) {
                    LogService.info('ScoringEngine', `TIE AT SCORE THRESHOLD (${maxPoints})! Continuing for another manche...`);
                }
            }
        } else if (newState.gameMode === 'MANCHE') {
            // Match ends ONLY when fixed number of manches played AND tie-breaker is resolved
            if (newState.mancheHistory && newState.mancheHistory.length >= newState.winningCondition) {
                const maxPoints = Math.max(...newState.players.map(p => p.totalPoints || 0));
                const leaders = newState.players.filter(p => (p.totalPoints || 0) === maxPoints);
                isMatchOver = leaders.length === 1;
                if (leaders.length > 1) {
                    LogService.info('ScoringEngine', `TIE AT MANCHE THRESHOLD (Points: ${maxPoints})! Continuing for another manche...`);
                }
            }
        } else if (newState.gameMode === 'COCHON') {
            const maxCochons = Math.max(...newState.players.map(p => p.totalCochonsInfliges || 0));
            if (maxCochons >= newState.winningCondition) {
                isMatchOver = true;
            }
        }
    }

    if (isMatchOver) {
        newState.phase = 'MATCH_END';
    } else if (mancheWinner || isChire) {
        newState.phase = 'MANCHE_END';
        if (mancheWinner) newState.firstPlayerOfRound = mancheWinner.id;
    }

    return newState;
};

/**
 * preparePlayersForNextRound (C3) : Centralise le reset des compteurs temporaires.
 * Appelé par LogicEngine lors du passage au round/manche suivant.
 */
export const preparePlayersForNextRound = (
    nextRoundDistributedPlayers: Player[], 
    oldPlayers: Player[], 
    isMancheEnd: boolean
): Player[] => {
    return nextRoundDistributedPlayers.map((p, i) => {
        const originalPlayer = oldPlayers[i] as Player | undefined;
        
        const newPlayer: Player = {
            ...p,
            id: originalPlayer?.id || p.id,
            // (C3) Reset uniquement si c'est une fin de manche
            currentMancheStars: isMancheEnd ? 0 : (originalPlayer?.currentMancheStars ?? 0),
            isCochon: isMancheEnd ? false : (originalPlayer?.isCochon ?? false),
            // Conservation des stats permanentes
            mancheWins: originalPlayer?.mancheWins ?? 0,
            totalPoints: originalPlayer?.totalPoints ?? 0,
            totalCochons: originalPlayer?.totalCochons ?? 0,
            totalCochonsInfliges: originalPlayer?.totalCochonsInfliges ?? 0,
            totalCochonsSubis: originalPlayer?.totalCochonsSubis ?? 0,
            totalRoundWins: originalPlayer?.totalRoundWins ?? 0,
            status: originalPlayer?.status ?? 'HUMAN',
            wins: originalPlayer?.wins ?? 0,
        };

        // On n'ajoute ces clés que si elles sont strictement définies pour éviter les rejets Firestore 400
        if (originalPlayer?.avatarId !== undefined) {
            newPlayer.avatarId = originalPlayer.avatarId;
        }
        if (originalPlayer?.difficulty !== undefined) {
            newPlayer.difficulty = originalPlayer.difficulty;
        }
        if (originalPlayer?.leagueGrade !== undefined) {
            newPlayer.leagueGrade = originalPlayer.leagueGrade;
        }
        if (originalPlayer?.activeFrame !== undefined) {
            newPlayer.activeFrame = originalPlayer.activeFrame;
        }

        return newPlayer;
    });
};
