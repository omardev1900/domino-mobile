import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { GameOverlays } from '../GameOverlays';
import { GameState, Domino } from '../../../core/types';
import { UnifiedResultOverlay } from '../../UnifiedResultOverlay';

// Mock UnifiedResultOverlay so it doesn't render its complex logic
jest.mock('../../UnifiedResultOverlay', () => ({
    UnifiedResultOverlay: jest.fn(() => null)
}));

jest.mock('@expo/vector-icons', () => ({
    MaterialCommunityIcons: 'Icon',
    Ionicons: 'Icon'
}));

describe('GameOverlays Component', () => {
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
        pendingDomino: null,
        isLandscape: true,
        insets: mockInsets,
        isSoloMode: true,
        gameId: '12345',
        showRoomInfo: false,
        onCloseRoomInfo: jest.fn(),
        showScoreOverlay: false,
        localPlayerId: 'player1',
        onOverlayContinue: jest.fn(),
        onLeaveRoom: jest.fn(),
        roomData: { createdBy: 'player1' },
        bannerState: 'NONE' as const,
        isPaused: false,
        onResume: jest.fn(),
    };

    it('renders choice banner when pendingDomino is present', () => {
        const mockDomino = { id: '0-0', left: 0, right: 0 } as Domino;
        const { getByTestId } = render(
            <GameOverlays {...defaultProps} pendingDomino={mockDomino} />
        );
        expect(getByTestId('choice-banner')).toBeTruthy();
    });

    it('renders pause overlay when isPaused is true', () => {
        const { getByTestId } = render(
            <GameOverlays {...defaultProps} isPaused={true} />
        );
        expect(getByTestId('pause-overlay')).toBeTruthy();
    });

    it('calls onResume when resume button is pressed inside pause overlay', () => {
        const { getByTestId } = render(
            <GameOverlays {...defaultProps} isPaused={true} />
        );
        fireEvent.press(getByTestId('btn-resume'));
        expect(defaultProps.onResume).toHaveBeenCalled();
    });

    it('calls onLeaveRoom when quit is confirmed inside pause overlay', () => {
        const { getByTestId } = render(
            <GameOverlays {...defaultProps} isPaused={true} />
        );
        // First press opens confirmation screen
        fireEvent.press(getByTestId('btn-quit'));
        // Second press on confirm actually calls onLeaveRoom
        fireEvent.press(getByTestId('btn-quit-confirm'));
        expect(defaultProps.onLeaveRoom).toHaveBeenCalled();
    });

    it('renders round banner with correct text', () => {
        const { getByText, getByTestId } = render(
            <GameOverlays {...defaultProps} bannerState="MANCHE" />
        );
        expect(getByTestId('round-banner')).toBeTruthy();
        expect(getByText('Manche N° 1')).toBeTruthy();
    });

    it('renders room info card in multiplayer when showRoomInfo is true', () => {
        const { getByText, getByTestId } = render(
            <GameOverlays {...defaultProps} isSoloMode={false} showRoomInfo={true} />
        );
        expect(getByTestId('room-info-backdrop')).toBeTruthy();
        expect(getByText('Salle')).toBeTruthy();
        expect(getByText('12345')).toBeTruthy(); // Room ID
    });

    it('calls onCloseRoomInfo when room info background is pressed', () => {
        const { getByTestId } = render(
            <GameOverlays {...defaultProps} isSoloMode={false} showRoomInfo={true} />
        );
        fireEvent.press(getByTestId('room-info-backdrop'));
        expect(defaultProps.onCloseRoomInfo).toHaveBeenCalled();
    });

    it('calls UnifiedResultOverlay with correct props when showScoreOverlay is true', () => {
        render(
            <GameOverlays {...defaultProps} showScoreOverlay={true} />
        );

        expect(UnifiedResultOverlay).toHaveBeenCalledTimes(1);
        const [props] = (UnifiedResultOverlay as jest.Mock).mock.calls[0];
        expect(props).toMatchObject({
            gameState: mockGameState,
            visible: true,
            currentUserId: 'player1',
            isHost: true
        });
    });
});
