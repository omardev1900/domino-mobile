/**
 * RewardEngine.ts
 *
 * ╔══════════════════════════════════════════════════════╗
 * ║  REWARD ENGINE — Logique Métier Pure                 ║
 * ║  • Aucun I/O (pas de Firebase, pas d'AsyncStorage)  ║
 * ║  • Aucun composant UI                                ║
 * ║  • Aucun side-effect                                 ║
 * ║  • 100% testable & déterministe                      ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * Point d'entrée unique : `RewardEngine.calculate(input)`
 * Retourne un `MatchReward` complet qui peut être:
 *   → Persisté par `EconomyService`
 *   → Affiché par `RewardOverlay`
 */

import {
    RewardCalculationInput,
    MatchReward,
    RewardBreakdown,
    LeagueGrade,
    MancheRewardEvent,
    PlayerMatchSnapshot,
    LevelUpChest,
    TableTier,
    FrameUnlockEvent,
    LeagueFrameId,
} from './economy.types';


import { GameState } from './types';
import { LogService } from './services/LogService';

import {
    BASE_REWARDS,
    TABLE_CONFIGS,
    RAKE_PERCENT,
    POT_DISTRIBUTION,
    SOLO_WIN_FLAT_REWARD,
    XP_PER_LEVEL_BASE,
    XP_GROWTH_RATE,
    COIN_MULTIPLIER_PER_LEVEL,
    MAX_LEVEL,
    LEAGUE_THRESHOLDS,
    LEAGUE_GRADE_ORDER,
    LEAGUE_FRAME_GRADE_ORDER,
    LEAGUE_FRAME_THRESHOLDS,
    LEAGUE_FRAME_REWARDS,
    LEAGUE_FRAMES_ENABLED,
    LEVEL_UP_CHESTS,
    DEFAULT_LEVEL_UP_COINS,
} from './economy.constants';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers Purs (fonctions mathématiques)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcule l'XP total requis pour atteindre un niveau donné.
 * Formule exponentielle : xpForLevel(n) = XP_BASE × GROWTH^(n-1)
 * xpRequired(level) = Somme de xpForLevel(1) à xpForLevel(level-1)
 */
export function xpRequiredForLevel(level: number): number {
    if (level <= 1) return 0;
    let total = 0;
    for (let l = 1; l < level; l++) {
        total += Math.floor(XP_PER_LEVEL_BASE * Math.pow(XP_GROWTH_RATE, l - 1));
    }
    return total;
}

/**
 * Détermine le niveau d'un joueur à partir de son XP total.
 */
export function getLevelFromXP(totalXP: number): number {
    let level = 1;
    while (level < MAX_LEVEL) {
        const xpNeeded = xpRequiredForLevel(level + 1);
        if (totalXP < xpNeeded) break;
        level++;
    }
    return level;
}

/**
 * XP restant pour atteindre le prochain niveau depuis un XP total.
 */
export function xpToNextLevel(totalXP: number, currentLevel: number): number {
    if (currentLevel >= MAX_LEVEL) return 0;
    return xpRequiredForLevel(currentLevel + 1) - totalXP;
}

/**
 * Détermine le grade de Ligue des Cochons selon le nombre de cochons.
 * Retourne null si le joueur n'a encore inflige aucun cochon.
 */
export function getLeagueGrade(leaguePoints: number): LeagueGrade | null {
    let grade: LeagueGrade | null = null;
    for (const g of LEAGUE_GRADE_ORDER) {
        if (leaguePoints >= LEAGUE_THRESHOLDS[g]) {
            grade = g;
        }
    }
    return grade;
}

/**
 * Seuil du prochain grade de ligue, ou null si grade max.
 * Si grade est null (joueur sans grade), retourne le premier seuil.
 */
export function nextLeagueThreshold(grade: LeagueGrade | null): number | null {
    if (grade === null) return LEAGUE_THRESHOLDS[LEAGUE_GRADE_ORDER[0]];
    const idx = LEAGUE_GRADE_ORDER.indexOf(grade);
    const next = LEAGUE_GRADE_ORDER[idx + 1];
    if (!next) return null;
    return LEAGUE_THRESHOLDS[next];
}

/**
 * Applique le multiplicateur de niveau sur un montant de coins.
 */
export function applyLevelMultiplier(coins: number, level: number): number {
    const multiplier = 1 + (level - 1) * COIN_MULTIPLIER_PER_LEVEL;
    return Math.floor(coins * multiplier);
}

/**
 * Calcule le pot distribué pour une table multi.
 * pot = (buyIn × playerCount) × (1 - rake)
 */
export function calculatePot(buyIn: number, playerCount: number): number {
    return Math.floor(buyIn * playerCount * (1 - RAKE_PERCENT));
}

/**
 * Vérifie si le joueur reçoit un coffre à ce niveau exact.
 */
export function getLevelUpChest(level: number): LevelUpChest | null {
    return LEVEL_UP_CHESTS.find(c => c.level === level) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// RewardEngine — Point d'entrée public
// ─────────────────────────────────────────────────────────────────────────────

export const RewardEngine = {

    /**
     * Calcule l'intégralité des récompenses pour un joueur
     * à la fin d'un match (`MATCH_END`).
     *
     * @param input - Contexte de calcul (stats finales, historique des manches, niveau, etc.)
     * @returns `MatchReward` — objet complet avec totaux, progression XP, ligue et breakdown
     */
    calculate(input: RewardCalculationInput): MatchReward {
        const {
            playerFinalStats,
            finalRanking,
            mancheHistory,
            currentLevel,
            currentLeaguePoints,
            currentXP,
            gameMode,
            tableTier,
            playerCount,
        } = input;

        const breakdown: RewardBreakdown[] = [];
        let totalCoinsRaw = 0; // Coins de performance (manches, rounds) — soumis au multiplicateur
        let potCoins = 0;      // Coins du pot — jamais multipliés par le niveau
        let totalXP = 0;
        let totalDiamonds = 0;
        let totalLeaguePoints = 0;

        // Calculé ici car nécessaire dès la section 1
        const isSolo = playerCount <= 1 || gameMode === 'SOLO';

        // ── 0. Calcul des rounds joués (approximatif = somme des victoires de round) ──
        const totalRoundsPlayed = finalRanking.reduce((sum, p) => sum + p.totalRoundWins, 0) || 1;

        // ── 1. Gains par événement de manche (LIGUE DES COCHONS UNIQUEMENT) ─────────
        // Les manches n'apportent plus d'XP, Coins ou Diamants.
        // Elles ne servent qu'à comptabiliser les cochons infligés (League Points).
        for (const manche of mancheHistory) {
            if (manche.isWinner) {
                if (manche.resultType === 'COCHON' && manche.cochonCount > 0) {
                    if (manche.cochonCount >= 2) {
                        // Double Cochon (3-0-0)
                        totalLeaguePoints += BASE_REWARDS.DOUBLE_COCHON.leaguePoints;
                        breakdown.push({
                            id: `double_cochon_${manche.mancheNumber}`,
                            label: `🐷🐷 Double Cochon (Manche #${manche.mancheNumber})`,
                            coins: 0,
                            xp: 0,
                            diamonds: 0,
                            leaguePoints: BASE_REWARDS.DOUBLE_COCHON.leaguePoints,
                        });
                    } else {
                        // Cochon Simple (3-1-0)
                        totalLeaguePoints += BASE_REWARDS.COCHON_BONUS.leaguePoints;
                        breakdown.push({
                            id: `cochon_${manche.mancheNumber}`,
                            label: `🐷 Bonus Cochon (Manche #${manche.mancheNumber})`,
                            coins: 0,
                            xp: 0,
                            diamonds: 0,
                            leaguePoints: BASE_REWARDS.COCHON_BONUS.leaguePoints,
                        });
                    }
                }
            }
        }

        // ── 2. Gains de Rounds (Désactivé) ──────────────────────────────────────────
        // L'XP par victoire de round individuelle est remplacée par un gain global en fin de match.
        
        // ── 3. Gains de fin de Match (Standardisation) ──────────────────────────
        const rank = playerFinalStats.rank;
        
        // XP globale basée sur le temps de jeu (20 XP par round joué dans le match)
        totalXP = totalRoundsPlayed * 20;

        if (rank === 1) {
            // Vainqueur du match
            potCoins = 300;
            totalDiamonds = 1;

            breakdown.push({
                id: 'match_win',
                label: `🏆 Victoire du Match`,
                coins: potCoins,
                xp: totalXP,
                diamonds: totalDiamonds,
                leaguePoints: 0,
            });
        } else {
            // Participation (non vainqueur)
            potCoins = 0;
            totalDiamonds = 0;

            breakdown.push({
                id: 'match_finish',
                label: `Participation`,
                coins: potCoins,
                xp: totalXP,
                diamonds: 0,
                leaguePoints: 0,
            });
        }

        // NOTE: The previous MATCH_END breakdown lines are now included in the chunk above!

        // ── 4. Appliquer le multiplicateur de niveau (performance coins uniquement) ───
        // potCoins (= pot du match en multi, flat reward en solo) N'est PAS multiplié.
        // Le multiplicateur de niveau s'applique UNIQUEMENT aux coins de performance
        // (manches, rounds en solo — en multi totalCoinsRaw = 0 donc pas d'effet).
        const performanceCoinsMultiplied = applyLevelMultiplier(totalCoinsRaw, currentLevel);
        const coinsEarned = performanceCoinsMultiplied + potCoins;

        // Ratio pour ajuster le breakdown (ne s'applique qu'aux lignes performance)
        const multiplierRatio = totalCoinsRaw > 0 ? performanceCoinsMultiplied / totalCoinsRaw : 1;
        const adjustedBreakdown = breakdown.map(b => ({
            ...b,
            coins: Math.floor(b.coins * multiplierRatio),
        }));

        // Si un multiplicateur est actif, ajouter une ligne explicative (solo uniquement)
        if (isSolo && currentLevel > 1 && totalCoinsRaw > 0) {
            const bonusCoins = performanceCoinsMultiplied - totalCoinsRaw;
            if (bonusCoins > 0) {
                adjustedBreakdown.push({
                    id: 'level_multiplier',
                    label: `⚡ Bonus Niveau ${currentLevel} (+${((currentLevel - 1) * COIN_MULTIPLIER_PER_LEVEL * 100).toFixed(0)}%)`,
                    coins: bonusCoins,
                    xp: 0,
                    diamonds: 0,
                    leaguePoints: 0,
                });
            }
        }

        // ── 5. Calcul de progression XP & Niveau ─────────────────────────────
        const previousLevel = currentLevel;
        const newXP = currentXP + totalXP;
        const newLevel = Math.min(getLevelFromXP(newXP), MAX_LEVEL);
        const leveledUp = newLevel > previousLevel;
        const xpLeft = xpToNextLevel(newXP, newLevel);

        // Coffres de niveau (si passage de niveau)
        let chestCoins = 0;
        let chestDiamonds = 0;
        if (leveledUp) {
            for (let l = previousLevel + 1; l <= newLevel; l++) {
                const chest = getLevelUpChest(l);
                chestCoins += chest?.coinsReward ?? DEFAULT_LEVEL_UP_COINS;
                chestDiamonds += chest?.diamondReward ?? 0;
            }
            if (chestCoins > 0 || chestDiamonds > 0) {
                adjustedBreakdown.push({
                    id: 'level_up_chest',
                    label: `📦 Coffre Niveau ${newLevel}`,
                    coins: chestCoins,
                    xp: 0,
                    diamonds: chestDiamonds,
                    leaguePoints: 0,
                });
            }
        }

        // ── 6. Calcul de Ligue ──────────────────────────────────────
        const previousLeaguePoints = currentLeaguePoints;
        const newLeaguePoints = currentLeaguePoints + totalLeaguePoints;
        const previousGrade = getLeagueGrade(previousLeaguePoints);
        const newGrade = getLeagueGrade(newLeaguePoints);
        const gradeUp = newGrade !== previousGrade;

        // ── 6b. Ligue des Cochons — Déblocage de cadres ────────────────
        // `totalLeaguePoints` = cochons INFLIGÉS dans ce match
        const cochonsGivenBefore = input.currentCochonsGiven ?? 0;
        const alreadyUnlocked = (input.unlockedFrames ?? []) as LeagueFrameId[];
        const newCochonsGiven = cochonsGivenBefore + totalLeaguePoints;

        const newlyUnlockedFrames: FrameUnlockEvent[] = [];
        let frameCoinsBonus = 0;
        let unlockedPalierCount = 0;

        for (const grade of LEAGUE_FRAME_GRADE_ORDER) {
            const threshold = LEAGUE_FRAME_THRESHOLDS[grade];
            const frameReward = LEAGUE_FRAME_REWARDS[grade];
            const frameId = frameReward.frameId as LeagueFrameId;

            if (
                newCochonsGiven >= threshold &&
                cochonsGivenBefore < threshold &&
                !alreadyUnlocked.includes(frameId)
            ) {
                unlockedPalierCount += 1;
                // Les coins de palier sont TOUJOURS attribués, que les cadres visuels
                // soient activés ou non (LEAGUE_FRAMES_ENABLED ne contrôle que le
                // déblocage cosmétique, pas la récompense économique).
                frameCoinsBonus += frameReward.coinsBonus;

                if (LEAGUE_FRAMES_ENABLED) {
                    newlyUnlockedFrames.push({
                        grade,
                        frameId,
                        coinsBonus: frameReward.coinsBonus,
                        cochonsAtUnlock: newCochonsGiven,
                    });
                }
            }
        }

        // Les coins des cadres s'ajoutent au détail
        if (frameCoinsBonus > 0) {
            adjustedBreakdown.push({
                id: 'league_frame_unlock',
                label: `🐷 Bonus palier Ligue (×${unlockedPalierCount})`,
                coins: frameCoinsBonus,
                xp: 0,
                diamonds: 0,
                leaguePoints: 0,
            });
        }

        // ── 7. Construction du MatchReward Final ──────────────────────
        const matchReward: MatchReward = {
            // Totaux
            coinsEarned: coinsEarned + chestCoins + frameCoinsBonus,
            xpEarned: totalXP,
            diamondsEarned: totalDiamonds + chestDiamonds,
            leaguePointsEarned: totalLeaguePoints,
            isWinner: rank === 1,

            // Progression XP
            previousLevel,
            newLevel,
            leveledUp,
            previousXP: currentXP,
            newXP,
            xpToNextLevel: xpLeft,

            // Ligue (grades)
            previousGrade,
            newGrade,
            gradeUp,
            previousLeaguePoints,
            newLeaguePoints,
            nextGradeThreshold: nextLeagueThreshold(newGrade),

            // Ligue des Cochons — Cadres
            newCochonsGiven,
            newlyUnlockedFrames,
            frameCoinsBonus,

            // Détail animable
            breakdown: adjustedBreakdown,
        };

        LogService.debug('RewardEngine', 'Rewards calculated:', {
            rank,
            coinsEarned: matchReward.coinsEarned,
            xpEarned: matchReward.xpEarned,
            leveledUp: matchReward.leveledUp,
            newLevel: matchReward.newLevel,
            gradeUp: matchReward.gradeUp,
            newGrade: matchReward.newGrade,
            newCochonsGiven: matchReward.newCochonsGiven,
            framesUnlocked: unlockedPalierCount,
            lines: adjustedBreakdown.length,
        });

        return matchReward;
    },

    /**
     * Construit un `RewardCalculationInput` depuis le GameState finalisé.
     * Helper à utiliser dans GameScreen pour éviter le couplage direct.
     */
    buildInputFromGameState(params: {
        gameState: GameState;
        localPlayerId: string;
        currentLevel: number;
        currentXP: number;
        currentLeaguePoints: number;
        currentCochonsGiven?: number;
        unlockedFrames?: LeagueFrameId[];
        tableTier: TableTier;
        isSoloMode: boolean;
    }): RewardCalculationInput {
        const { gameState, localPlayerId, currentLevel, currentXP, currentLeaguePoints, currentCochonsGiven, unlockedFrames, tableTier, isSoloMode } = params;
        const getCochonRankingValue = (player: GameState['players'][number]) =>
            gameState.gameMode === 'COCHON'
                ? (player.totalCochonsInfliges || 0)
                : (player.totalCochons || 0);

        // Classement final
        // MULTI-PENALITE-ABANDON : un joueur SURRENDERED est TOUJOURS dernier,
        // quelle que soit la performance de son bot pendant le reste du match.
        const sortedPlayers = [...gameState.players].sort((a, b) => {
            const aS = a.status === 'SURRENDERED';
            const bS = b.status === 'SURRENDERED';
            if (aS && !bS) return 1;   // a → dernier
            if (!aS && bS) return -1;  // b → dernier
            if (gameState.gameMode === 'COCHON') {
                if (getCochonRankingValue(b) !== getCochonRankingValue(a)) {
                    return getCochonRankingValue(b) - getCochonRankingValue(a);
                }
                return b.totalPoints - a.totalPoints;
            }
            if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
            if (b.totalCochons !== a.totalCochons) return b.totalCochons - a.totalCochons;
            return b.mancheWins - a.mancheWins;
        });

        const finalRanking: PlayerMatchSnapshot[] = sortedPlayers.map((p, i) => ({
            playerId: p.id,
            totalPoints: p.totalPoints,
            totalCochons: getCochonRankingValue(p),
            mancheWins: p.mancheWins,
            totalRoundWins: p.totalRoundWins || 0,
            rank: i + 1,
        }));

        const playerSnapshot = finalRanking.find(p => p.playerId === localPlayerId)!;

        // Construire les événements de manche pour ce joueur
        const mancheHistory: MancheRewardEvent[] = (gameState.mancheHistory || []).map(record => ({
            mancheNumber: record.mancheNumber,
            resultType: record.resultType,
            cochonCount: record.cochonCount || 0,
            isWinner: record.winnerId === localPlayerId,
            isCochonne: record.resultType === 'COCHON' && (record.points[localPlayerId] || 0) < 0,
            pointsEarned: record.points[localPlayerId] || 0,
        }));

        return {
            playerFinalStats: playerSnapshot,
            finalRanking,
            mancheHistory,
            currentLevel,
            currentLeaguePoints,
            currentXP,
            currentCochonsGiven,
            unlockedFrames,
            gameMode: isSoloMode ? 'SOLO' : gameState.gameMode,
            tableTier,
            playerCount: isSoloMode ? 1 : gameState.players.length,
        };
    },
};
