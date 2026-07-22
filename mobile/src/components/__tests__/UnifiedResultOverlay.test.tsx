import React from 'react';
import { render, act } from '@testing-library/react-native';
import { UnifiedResultOverlay } from '../UnifiedResultOverlay';
import SoundManager from '../../core/audio/SoundManager';

jest.mock('react-native-reanimated', () => {
    const Reanimated = require('react-native-reanimated/mock');
    Reanimated.default.call = () => {};
    Reanimated.useReducedMotion = () => false;
    return Reanimated;
});

jest.mock('react-native-confetti-cannon', () => 'ConfettiCannon');
jest.mock('expo-image', () => ({
    Image: 'Image',
}));
jest.mock('@expo/vector-icons', () => ({
    Ionicons: 'Ionicons',
}));
jest.mock('../GradeBadge', () => ({
    GradeBadge: () => null,
}));
jest.mock('../ShareButton', () => ({
    ShareTextButton: () => null,
    WinShareCard: () => null,
    buildWinShareText: jest.fn(() => 'share-text'),
}));
jest.mock('../../core/audio/SoundManager', () => ({
    __esModule: true,
    default: {
        playSound: jest.fn(),
    },
}));

describe('UnifiedResultOverlay', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    it('plays matchEnd immediately, then applause 800 ms later on match end', async () => {
        const gameState: any = {
            phase: 'MATCH_END',
            gameMode: 'COCHON',
            mancheResult: null,
            firstPlayerOfRound: 'p1',
            players: [
                {
                    id: 'p1',
                    name: 'Moi',
                    avatarId: 'avatar_default',
                    hand: [],
                    totalPoints: 20,
                    totalCochons: 0,
                    mancheWins: 1,
                    totalCochonsInfliges: 10,
                },
                {
                    id: 'p2',
                    name: 'Bot',
                    avatarId: 'avatar_default',
                    hand: [],
                    totalPoints: 5,
                    totalCochons: 0,
                    mancheWins: 0,
                    totalCochonsInfliges: 2,
                },
            ],
        };

        render(
            <UnifiedResultOverlay
                visible={true}
                gameState={gameState}
                currentUserId="p1"
                onContinue={jest.fn()}
                matchReward={null}
            />
        );

        expect(SoundManager.playSound).toHaveBeenCalledWith('matchEnd');
        expect(SoundManager.playSound).not.toHaveBeenCalledWith('applause');

        await act(async () => {
            jest.advanceTimersByTime(800);
        });

        expect(SoundManager.playSound).toHaveBeenCalledWith('applause');
    });
});
