import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { View } from 'react-native';
import { ActionFooter } from '../ActionFooter';
import { GameState, Player, Domino } from '../../../core/types';

// Mock PlayerHand
const MockPlayerHand = (props: any) => <View {...props} />;
jest.mock('../../PlayerHand', () => ({
    PlayerHand: jest.fn(({ disabled }) => (
        <MockPlayerHand testID="mock-player-hand" disabled={disabled} />
    ))
}));

describe('ActionFooter Component', () => {
    const mockInsets = { top: 0, bottom: 20, left: 0, right: 0 };
    const mockLocalPlayer: Player = { id: 'local', name: 'Me', hand: [] } as unknown as Player;
    const mockGameState = {
        phase: 'PLAYING',
        currentPlayerId: 'local',
        table: { leftValue: 6, rightValue: 6 }
    } as GameState;

    const defaultProps = {
        localPlayer: mockLocalPlayer,
        gameState: mockGameState,
        localPlayerId: 'local',
        bannerState: 'NONE' as const,
        isHardLocked: false,
        forcedOpeningDominoId: null,
        insets: mockInsets,
        onPlayDomino: jest.fn(),
    };

    it('renders PlayerHand and passes disabled=false when it is local player turn', () => {
        const { getByTestId } = render(<ActionFooter {...defaultProps} />);

        const hand = getByTestId('mock-player-hand');
        expect(hand).toBeTruthy();
        expect(hand.props.disabled).toBe(false);
    });

    it('passes disabled=true to PlayerHand when not local player turn', () => {
        const { getByTestId } = render(
            <ActionFooter
                {...defaultProps}
                gameState={{ ...mockGameState, currentPlayerId: 'opponent' }}
            />
        );

        const hand = getByTestId('mock-player-hand');
        expect(hand.props.disabled).toBe(true);
    });

    it('passes disabled=true to PlayerHand while a move animation is pausing interactions', () => {
        const { getByTestId } = render(
            <ActionFooter
                {...defaultProps}
                isPaused={true}
            />
        );

        const hand = getByTestId('mock-player-hand');
        expect(hand.props.disabled).toBe(true);
    });

    it('renders pass turn button when canPassTurn is true', () => {
        const onPassTurn = jest.fn();
        const { getByTestId } = render(
            <ActionFooter {...defaultProps} canPassTurn={true} onPassTurn={onPassTurn} />
        );

        const btn = getByTestId('btn-pass-turn');
        expect(btn).toBeTruthy();

        fireEvent.press(btn);
        expect(onPassTurn).toHaveBeenCalled();
    });

    it('renders side selection buttons when showSideSelection is true', () => {
        const onSelectSide = jest.fn();
        const { getByTestId } = render(
            <ActionFooter {...defaultProps} showSideSelection={true} onSelectSide={onSelectSide} />
        );

        const btnLeft = getByTestId('btn-select-left');
        const btnRight = getByTestId('btn-select-right');

        expect(btnLeft).toBeTruthy();
        expect(btnRight).toBeTruthy();

        fireEvent.press(btnLeft);
        expect(onSelectSide).toHaveBeenCalledWith('left');

        fireEvent.press(btnRight);
        expect(onSelectSide).toHaveBeenCalledWith('right');
    });

    it('returns null when gameState or localPlayer is missing', () => {
        const { queryByTestId } = render(
            <ActionFooter {...defaultProps} gameState={null} />
        );
        expect(queryByTestId('action-footer')).toBeNull();
    });
});
