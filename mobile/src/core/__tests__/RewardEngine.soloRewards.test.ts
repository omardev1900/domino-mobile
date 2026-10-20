import { RewardEngine } from '../RewardEngine';
import { SOLO_PREMIUM_WIN_FLAT_REWARD, SOLO_WIN_FLAT_REWARD } from '../economy.constants';
import { RewardCalculationInput } from '../economy.types';

const makeSoloInput = (isPremium: boolean): RewardCalculationInput => ({
    playerFinalStats: {
        playerId: 'player-1',
        totalPoints: 100,
        totalCochons: 0,
        mancheWins: 1,
        totalRoundWins: 1,
        rank: 1,
    },
    finalRanking: [{
        playerId: 'player-1',
        totalPoints: 100,
        totalCochons: 0,
        mancheWins: 1,
        totalRoundWins: 1,
        rank: 1,
    }],
    mancheHistory: [],
    currentLevel: 12,
    currentLeaguePoints: 0,
    currentXP: 0,
    gameMode: 'SOLO',
    tableTier: 'DEBUTANT',
    playerCount: 1,
    isPremium,
});

describe('RewardEngine — récompenses Solo', () => {
    it('verse 250 coins au vainqueur non-Premium, sans bonus de niveau', () => {
        const reward = RewardEngine.calculate(makeSoloInput(false));

        expect(reward.coinsEarned).toBe(SOLO_WIN_FLAT_REWARD);
        expect(reward.breakdown).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'solo_win', coins: SOLO_WIN_FLAT_REWARD }),
        ]));
    });

    it('verse 500 coins au vainqueur Premium et identifie le bonus ×2', () => {
        const reward = RewardEngine.calculate(makeSoloInput(true));

        expect(reward.coinsEarned).toBe(SOLO_PREMIUM_WIN_FLAT_REWARD);
        expect(reward.breakdown).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'solo_premium_win', coins: SOLO_PREMIUM_WIN_FLAT_REWARD }),
        ]));
    });

    it('double aussi le gain d une victoire Premium hors solo', () => {
        const reward = RewardEngine.calculate({
            ...makeSoloInput(true),
            gameMode: 'SCORE',
            playerCount: 3,
        });

        expect(reward.coinsEarned).toBe(600);
        expect(reward.breakdown).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'premium_match_win', coins: 600 }),
        ]));
    });
});
