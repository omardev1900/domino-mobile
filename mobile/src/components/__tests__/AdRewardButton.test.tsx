import React from 'react';
import { Platform } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { AdRewardButton } from '../AdRewardButton';

const mockLoad = jest.fn();
const mockShow = jest.fn();
let mockAdState: {
    isLoaded: boolean;
    isClosed: boolean;
    isEarnedReward: boolean;
    error?: Error & { code?: string };
};

jest.mock('../../core/services/AdMobAdapter', () => ({
    AdMobIds: { REWARDED_FIN_PARTIE: 'rewarded-test' },
    useRewardedAd: () => ({
        ...mockAdState,
        load: mockLoad,
        show: mockShow,
    }),
}));

jest.mock('../../core/services/LogService', () => ({
    LogService: {
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

jest.mock('@expo/vector-icons', () => {
    const React = require('react');
    const { Text } = require('react-native');
    return {
        Ionicons: ({ name }: { name: string }) => React.createElement(Text, null, name),
    };
});

jest.mock('react-native-reanimated', () => {
    const Reanimated = require('react-native-reanimated/mock');
    Reanimated.default.call = () => {};
    return Reanimated;
});

describe('AdRewardButton', () => {
    const originalPlatform = Platform.OS;

    beforeEach(() => {
        jest.clearAllMocks();
        mockAdState = {
            isLoaded: false,
            isClosed: false,
            isEarnedReward: false,
        };
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    });

    afterAll(() => {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    });

    it('ne rend rien et ne credite rien sur le web', () => {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
        const onClaim = jest.fn();
        const screen = render(<AdRewardButton coinsAmount={100} onClaim={onClaim} />);

        expect(screen.toJSON()).toBeNull();
        expect(onClaim).not.toHaveBeenCalled();
        expect(mockLoad).not.toHaveBeenCalled();
    });

    it('propose le bonus offert uniquement apres un no-fill', async () => {
        const onClaim = jest.fn().mockResolvedValue(undefined);
        const screen = render(<AdRewardButton coinsAmount={100} onClaim={onClaim} />);

        mockAdState.error = Object.assign(new Error('No inventory'), {
            code: 'googleMobileAds/no-fill',
        });
        await act(async () => {
            screen.rerender(<AdRewardButton coinsAmount={100} onClaim={onClaim} />);
        });

        const claimButton = screen.getByLabelText('Recuperer le bonus offert de 100 coins');
        await act(async () => {
            fireEvent.press(claimButton);
            fireEvent.press(claimButton);
        });

        expect(onClaim).toHaveBeenCalledTimes(1);
        expect(onClaim).toHaveBeenCalledWith('no_fill');
        expect(screen.getByText('+100 coins credites !')).toBeTruthy();
    });

    it('ne donne pas de bonus gratuit lors d une erreur reseau', () => {
        const onClaim = jest.fn();
        const screen = render(<AdRewardButton coinsAmount={100} onClaim={onClaim} />);

        mockAdState.error = Object.assign(new Error('Network unavailable'), {
            code: 'googleMobileAds/network-error',
        });
        act(() => {
            screen.rerender(<AdRewardButton coinsAmount={100} onClaim={onClaim} />);
        });

        expect(screen.getByText('Connexion requise pour charger la publicite.')).toBeTruthy();
        expect(screen.queryByLabelText('Recuperer le bonus offert de 100 coins')).toBeNull();
        expect(onClaim).not.toHaveBeenCalled();
    });

    it('ne traite qu une fois plusieurs callbacks de recompense', async () => {
        const onClaim = jest.fn().mockResolvedValue(undefined);
        mockAdState.isLoaded = true;
        const screen = render(<AdRewardButton coinsAmount={100} onClaim={onClaim} />);

        fireEvent.press(screen.getByLabelText('Voir une pub pour gagner 100 coins'));
        expect(mockShow).toHaveBeenCalledTimes(1);

        mockAdState.isEarnedReward = true;
        await act(async () => {
            screen.rerender(<AdRewardButton coinsAmount={100} onClaim={onClaim} />);
        });
        screen.rerender(<AdRewardButton coinsAmount={100} onClaim={onClaim} />);

        expect(onClaim).toHaveBeenCalledTimes(1);
        expect(onClaim).toHaveBeenCalledWith('admob');
    });
});
