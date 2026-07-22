import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';
import { RewardOverlay } from '../RewardOverlay';
import { MatchReward } from '../../core/economy.types';
import SoundManager from '../../core/audio/SoundManager';

jest.mock('react-native-reanimated', () => {
    const Reanimated = require('react-native-reanimated/mock');
    Reanimated.default.call = () => {};
    return Reanimated;
});

jest.mock('../RollingNumber', () => {
    return function MockRollingNumber(props: any) {
        return null;
    };
});

jest.mock('../AvatarFrame', () => ({
    AvatarFrame: () => null,
}));

jest.mock('../../core/audio/SoundManager', () => ({
    __esModule: true,
    default: {
        playSound: jest.fn(),
    },
}));

describe('RewardOverlay', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    it('affiche la modale de passage de palier quand gradeUp est vrai', async () => {
        const reward: MatchReward = {
            coinsEarned: 200,
            xpEarned: 50,
            diamondsEarned: 0,
            leaguePointsEarned: 1,
            isWinner: true,
            previousLevel: 1,
            newLevel: 1,
            leveledUp: false,
            previousXP: 100,
            newXP: 150,
            xpToNextLevel: 50,
            previousGrade: null,
            newGrade: 'DEBUTANT',
            gradeUp: true,
            previousLeaguePoints: 0,
            newLeaguePoints: 1,
            nextGradeThreshold: 10,
            newCochonsGiven: 1,
            newlyUnlockedFrames: [],
            frameCoinsBonus: 0,
            breakdown: [],
        };

        const screen = render(
            <RewardOverlay
                visible={true}
                reward={reward}
                isWinner={true}
                onContinue={jest.fn()}
            />
        );

        await act(async () => {
            jest.advanceTimersByTime(1300);
        });

        expect(SoundManager.playSound).toHaveBeenCalledWith('leagueJingle');

        await act(async () => {
            jest.advanceTimersByTime(800);
        });

        expect(screen.getByText(/FELICITATIONS|FÉLICITATIONS/i)).toBeTruthy();
        expect(screen.getAllByText(/DEBUTANT/i).length).toBeGreaterThan(0);
        expect(screen.getByLabelText('Fermer celebration')).toBeTruthy();
        expect(screen.getAllByText(/1.*cochons?/i).length).toBeGreaterThan(0);
        expect(SoundManager.playSound).toHaveBeenCalledWith('applause');
    }, 20000);

    it('reaffiche le contenu principal de recompense apres fermeture du popup de palier', async () => {
        const reward: MatchReward = {
            coinsEarned: 200,
            xpEarned: 50,
            diamondsEarned: 0,
            leaguePointsEarned: 1,
            isWinner: true,
            previousLevel: 1,
            newLevel: 1,
            leveledUp: false,
            previousXP: 100,
            newXP: 150,
            xpToNextLevel: 50,
            previousGrade: null,
            newGrade: 'DEBUTANT',
            gradeUp: true,
            previousLeaguePoints: 0,
            newLeaguePoints: 1,
            nextGradeThreshold: 10,
            newCochonsGiven: 1,
            newlyUnlockedFrames: [],
            frameCoinsBonus: 0,
            breakdown: [],
        };

        const screen = render(
            <RewardOverlay
                visible={true}
                reward={reward}
                isWinner={true}
                onContinue={jest.fn()}
            />
        );

        await act(async () => {
            jest.advanceTimersByTime(1300);
        });

        fireEvent.press(screen.getByLabelText('Fermer celebration'));

        expect(screen.getByText('CONTINUER')).toBeTruthy();
        expect(screen.queryByLabelText('Fermer celebration')).toBeNull();
    });
});
