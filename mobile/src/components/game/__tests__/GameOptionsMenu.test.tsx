import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { GameOptionsMenu } from '../GameOptionsMenu';

jest.mock('react-native-reanimated', () => {
    const Reanimated = require('react-native-reanimated/mock');
    Reanimated.default.call = () => {};
    return Reanimated;
});

jest.mock('@expo/vector-icons', () => ({
    Ionicons: 'Icon',
}));

const baseProps = {
    visible: true,
    onClose: jest.fn(),
    isSoloMode: true,
    gameState: null,
    isBgmEnabled: true,
    onToggleBgm: jest.fn(),
    isSfxEnabled: true,
    onToggleSfx: jest.fn(),
    isVibrationEnabled: true,
    onToggleVibration: jest.fn(),
    onQuitGame: jest.fn(),
};

describe('GameOptionsMenu', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('ferme au premier appui sur le bouton X', () => {
        const onClose = jest.fn();
        const screen = render(<GameOptionsMenu {...baseProps} onClose={onClose} />);

        fireEvent.press(screen.getByTestId('options-close-button'));

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('ferme aussi au premier appui sur le fond', () => {
        const onClose = jest.fn();
        const screen = render(<GameOptionsMenu {...baseProps} onClose={onClose} />);

        fireEvent.press(screen.getByTestId('options-backdrop'));

        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
