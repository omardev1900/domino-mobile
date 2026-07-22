import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { GameHeader } from '../GameHeader';
import { GameState } from '../../../core/types';

describe('GameHeader Component', () => {
    const mockInsets = { top: 20, bottom: 0, left: 0, right: 0 };
    const mockGameState = {
        phase: 'PLAYING',
        gameMode: 'MANCHE',
        winningCondition: 3,
        mancheNumber: 1,
        roundNumber: 2,
    } as GameState;

    const defaultProps = {
        gameState: mockGameState,
        insets: mockInsets,
        onOpenOptions: jest.fn(),
    };

    it('renders correctly when phase is PLAYING', () => {
        const { getByTestId } = render(<GameHeader {...defaultProps} />);
        expect(getByTestId('game-header')).toBeTruthy();
    });

    it('returns null when phase is not PLAYING', () => {
        const { queryByTestId } = render(
            <GameHeader {...defaultProps} gameState={{ ...mockGameState, phase: 'LOBBY' }} />
        );

        expect(queryByTestId('game-header')).toBeNull();
    });

    it('returns null when gameState is null', () => {
        const { queryByTestId } = render(
            <GameHeader {...defaultProps} gameState={null} />
        );

        expect(queryByTestId('game-header')).toBeNull();
    });

    it('calls onOpenOptions when options button is pressed', async () => {
        const { getByTestId } = render(<GameHeader {...defaultProps} />);

        await act(async () => {
            fireEvent.press(getByTestId('btn-options'));
        });
        expect(defaultProps.onOpenOptions).toHaveBeenCalledTimes(1);
    });

});
