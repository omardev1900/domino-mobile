/**
 * RewardEngine.leagueTierCoins.test.ts
 *
 * Régression BUG-LEAGUE-TIER-REWARD (2026-05-27)
 *
 * Vérifie que frameCoinsBonus est TOUJOURS attribué lors du franchissement
 * d'un palier Ligue des Cochons, que LEAGUE_FRAMES_ENABLED soit true ou false.
 *
 * Contexte : LEAGUE_FRAMES_ENABLED = false désactive les cadres visuels
 * mais ne doit JAMAIS bloquer la récompense économique (coins de palier).
 */

// ─── Mocks obligatoires ─────────────────────────────────────────────────────

jest.mock('firebase/app', () => ({ initializeApp: jest.fn() }));
jest.mock('firebase/auth', () => ({ getAuth: jest.fn() }));
jest.mock('firebase/firestore', () => ({
    getFirestore: jest.fn(),
    doc: jest.fn(),
    getDoc: jest.fn(),
    updateDoc: jest.fn(),
    setDoc: jest.fn(),
    runTransaction: jest.fn(),
    serverTimestamp: jest.fn(),
    increment: jest.fn(),
    arrayUnion: jest.fn(),
}));
jest.mock('../services/LogService', () => ({
    LogService: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

// ─── Imports après mocks ─────────────────────────────────────────────────────

import { RewardEngine } from '../RewardEngine';
import { LEAGUE_FRAME_THRESHOLDS, LEAGUE_FRAME_REWARDS, LEAGUE_FRAMES_ENABLED } from '../economy.constants';
import { RewardCalculationInput } from '../economy.types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Construit un RewardCalculationInput minimal pour tester le calcul de palier.
 * Le joueur vainqueur passe de `cochonsGivenBefore` à `cochonsGivenBefore + cochonsThisMatch` cochons.
 */
function buildInput(params: {
    cochonsGivenBefore: number;
    cochonsThisMatch: number;
    unlockedFrames?: string[];
}): RewardCalculationInput {
    const { cochonsGivenBefore, cochonsThisMatch, unlockedFrames = [] } = params;

    return {
        playerFinalStats: {
            playerId: 'p1',
            rank: 1,
            totalCochons: cochonsThisMatch,
            totalPoints: 100,
            totalRoundWins: 1,
            mancheWins: 1,
        },
        finalRanking: [],
        mancheHistory: Array.from({ length: cochonsThisMatch }, (_, i) => ({
            mancheNumber: i + 1,
            isWinner: true,
            isCochonne: false,
            resultType: 'COCHON',
            cochonCount: 1,
            pointsEarned: 5,
        })),
        currentLevel: 1,
        currentXP: 0,
        currentLeaguePoints: 0,
        currentCochonsGiven: cochonsGivenBefore,
        unlockedFrames: unlockedFrames as any,
        tableTier: 'DEBUTANT',
        gameMode: 'COCHON',
        playerCount: 2,
        isSoloMode: false,
    };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('RewardEngine — BUG-LEAGUE-TIER-REWARD: coins de palier Ligue des Cochons', () => {

    // Trouver le premier palier depuis les constantes
    const firstPalierGrade = 'APPRENTI_1';
    const firstThreshold = LEAGUE_FRAME_THRESHOLDS[firstPalierGrade]; // 10
    const firstCoinReward = LEAGUE_FRAME_REWARDS[firstPalierGrade]?.coinsBonus ?? 200;

    describe(`Franchissement du palier ${firstPalierGrade} (seuil = ${firstThreshold} cochons)`, () => {

        it('frameCoinsBonus > 0 quand le seuil est franchi', () => {
            const input = buildInput({
                cochonsGivenBefore: firstThreshold - 3,
                cochonsThisMatch: 5,
            });
            const reward = RewardEngine.calculate(input);
            expect(reward.frameCoinsBonus).toBe(firstCoinReward);
        });

        it('frameCoinsBonus est inclus dans coinsEarned', () => {
            const input = buildInput({
                cochonsGivenBefore: firstThreshold - 3,
                cochonsThisMatch: 5,
            });
            const reward = RewardEngine.calculate(input);
            // coinsEarned doit inclure la partie "frameCoinsBonus"
            // (le reste dépend de la formule de match, mais frameCoinsBonus doit y être)
            expect(reward.coinsEarned).toBeGreaterThanOrEqual(firstCoinReward);
        });

        it('le breakdown contient un item league_frame_unlock', () => {
            const input = buildInput({
                cochonsGivenBefore: firstThreshold - 3,
                cochonsThisMatch: 5,
            });
            const reward = RewardEngine.calculate(input);
            const palierItem = reward.breakdown.find(b => b.id === 'league_frame_unlock');
            expect(palierItem).toBeDefined();
            expect(palierItem?.coins).toBe(firstCoinReward);
        });

        it('newCochonsGiven est correctement calculé', () => {
            const before = firstThreshold - 3;
            const thisMatch = 5;
            const input = buildInput({ cochonsGivenBefore: before, cochonsThisMatch: thisMatch });
            const reward = RewardEngine.calculate(input);
            expect(reward.newCochonsGiven).toBe(before + thisMatch);
        });
    });

    describe('Indépendance vis-à-vis de LEAGUE_FRAMES_ENABLED', () => {
        /**
         * LEAGUE_FRAMES_ENABLED = false en production actuelle.
         * Ce test vérifie que même dans cette configuration,
         * les coins de palier sont bien calculés.
         */
        it('frameCoinsBonus > 0 MÊME QUAND LEAGUE_FRAMES_ENABLED = false', () => {
            // Ce test échoue si le bug est présent (frameCoinsBonus = 0 quand LEAGUE_FRAMES_ENABLED = false)
            const input = buildInput({
                cochonsGivenBefore: firstThreshold - 1,
                cochonsThisMatch: 2,
            });
            const reward = RewardEngine.calculate(input);
            expect(reward.frameCoinsBonus).toBeGreaterThan(0);
        });

        if (!LEAGUE_FRAMES_ENABLED) {
            it('newlyUnlockedFrames est vide quand LEAGUE_FRAMES_ENABLED = false', () => {
                const input = buildInput({
                    cochonsGivenBefore: firstThreshold - 1,
                    cochonsThisMatch: 2,
                });
                const reward = RewardEngine.calculate(input);
                // Les cadres visuels ne sont pas déblocqués
                expect(reward.newlyUnlockedFrames).toHaveLength(0);
            });

            it('frameCoinsBonus > 0 ET newlyUnlockedFrames.length === 0 (coins sans cadre visuel)', () => {
                const input = buildInput({
                    cochonsGivenBefore: firstThreshold - 1,
                    cochonsThisMatch: 2,
                });
                const reward = RewardEngine.calculate(input);
                expect(reward.frameCoinsBonus).toBeGreaterThan(0);
                expect(reward.newlyUnlockedFrames).toHaveLength(0);
            });
        }
    });

    describe('Pas de coins si aucun palier franchi', () => {
        it('frameCoinsBonus = 0 si on reste en dessous du premier seuil', () => {
            const input = buildInput({
                cochonsGivenBefore: 0,
                cochonsThisMatch: firstThreshold - 1,
            });
            const reward = RewardEngine.calculate(input);
            expect(reward.frameCoinsBonus).toBe(0);
        });

        it('frameCoinsBonus = 0 si le palier était déjà débloqué (idempotence)', () => {
            const input = buildInput({
                cochonsGivenBefore: firstThreshold + 5, // déjà au-delà
                cochonsThisMatch: 3,
                unlockedFrames: [LEAGUE_FRAME_REWARDS[firstPalierGrade].frameId],
            });
            const reward = RewardEngine.calculate(input);
            expect(reward.frameCoinsBonus).toBe(0);
        });

        it('aucun item league_frame_unlock dans le breakdown si pas de palier', () => {
            const input = buildInput({
                cochonsGivenBefore: 0,
                cochonsThisMatch: firstThreshold - 2,
            });
            const reward = RewardEngine.calculate(input);
            const palierItem = reward.breakdown.find(b => b.id === 'league_frame_unlock');
            expect(palierItem).toBeUndefined();
        });
    });

    describe('Cascade multi-paliers', () => {
        it('franchir plusieurs paliers en un match cumule les frameCoinsBonus', () => {
            const secondPalierGrade = 'APPRENTI_2';
            const secondThreshold = LEAGUE_FRAME_THRESHOLDS[secondPalierGrade]; // 20
            const secondCoinReward = LEAGUE_FRAME_REWARDS[secondPalierGrade]?.coinsBonus ?? 300;

            const input = buildInput({
                cochonsGivenBefore: firstThreshold - 2,
                cochonsThisMatch: secondThreshold - firstThreshold + 4, // franchit les 2 paliers
            });
            const reward = RewardEngine.calculate(input);
            expect(reward.frameCoinsBonus).toBe(firstCoinReward + secondCoinReward);
        });
    });
});
