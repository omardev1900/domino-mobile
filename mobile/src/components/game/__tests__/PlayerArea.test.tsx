import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { View } from 'react-native';
import { PlayerArea } from '../PlayerArea';
import { GameState, Player } from '../../../core/types';

// Mock PlayerAvatar so it doesn't render SVGs and complex views
const MockPlayerAvatar = (props: any) => <View {...props} />;
jest.mock('../../PlayerAvatar', () => ({
    PlayerAvatar: jest.fn(({ player, isActive, position }) => (
        <MockPlayerAvatar testID={`mock-avatar-for-${player.id}`} isActive={isActive} position={position} />
    ))
}));

describe('PlayerArea Component', () => {
    const mockInsets = { top: 20, bottom: 20, left: 10, right: 10 };
    const mockPlayer1: Player = { id: 'p1', name: 'Player 1', status: 'HUMAN' } as Player;
    const mockPlayer2: Player = { id: 'p2', name: 'Player 2', status: 'HUMAN' } as Player;
    const mockLocalPlayer: Player = { id: 'local', name: 'Me', status: 'HUMAN' } as Player;

    const mockGameState = {
        phase: 'PLAYING',
        currentPlayerId: 'p1',
        turnDuration: 20,
    } as GameState;

    const defaultProps = {
        opponents: [mockPlayer1, mockPlayer2],
        localPlayer: mockLocalPlayer,
        gameState: mockGameState,
        localPlayerId: 'local',
        boudedPlayerId: null,
        playersChat: {},
        overtime: null,
        isBotPlaying: false,
        isPaused: false,
        insets: mockInsets,
        avatarRefs: { current: {} },
        getPlayerScore: jest.fn(() => '10 pts'),
    };

    it('renders opponents and local player', () => {
        const { getByTestId } = render(<PlayerArea {...defaultProps} />);

        expect(getByTestId('mock-avatar-for-p1')).toBeTruthy();
        expect(getByTestId('mock-avatar-for-p2')).toBeTruthy();
        expect(getByTestId('mock-avatar-for-local')).toBeTruthy();
    });

    it('returns null when gameState is null', () => {
        const { queryByTestId } = render(
            <PlayerArea {...defaultProps} gameState={null} />
        );
        expect(queryByTestId('player-area')).toBeNull();
    });

    it('sets isActive true for current player only', () => {
        const { getByTestId } = render(<PlayerArea {...defaultProps} />);

        const avatar1 = getByTestId('mock-avatar-for-p1'); // Current player
        const avatarLocal = getByTestId('mock-avatar-for-local');

        expect(avatar1.props.isActive).toBe(true);
        expect(avatarLocal.props.isActive).toBe(false);
    });

    it('renders the hand sort trigger for the local player', () => {
        const { getByTestId } = render(<PlayerArea {...defaultProps} />);

        expect(getByTestId('hand-sort-trigger')).toBeTruthy();
    });

    it('cycles hand sort options when trigger is pressed', () => {
        const onSelectHandSortMode = jest.fn();
        const { getByTestId } = render(
            <PlayerArea
                {...defaultProps}
                handSortMode="AUTO"
                onSelectHandSortMode={onSelectHandSortMode}
            />
        );

        fireEvent.press(getByTestId('hand-sort-trigger'));
        expect(onSelectHandSortMode).toHaveBeenCalledWith('DOUBLES');
    });
});
