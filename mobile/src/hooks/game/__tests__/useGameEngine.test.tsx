import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';
import { View, Button } from 'react-native';
import { useGameEngine } from '../useGameEngine';
import { GameState, Player, Domino } from '../../../core/types';
import { createBaseGameState } from './testUtils';

jest.mock('../../../core/DominoEngine', () => ({
    getValidMoves: jest.fn(),
    getForcedOpeningDominoId: jest.fn(),
    handleTurn: jest.fn(),
    passTurn: jest.fn()
}));

jest.mock('../../../core/LogicEngine', () => ({
    handleTurn: jest.fn(),
    passTurn: jest.fn(),
    resolveBoude: jest.fn(),
    handleTimeout: jest.fn(),
    computeNextRoundState: jest.fn(),
    getForcedOpeningDominoId: jest.fn(),
    getForcedTieBreakDominoId: jest.fn(),
}));

describe('useGameEngine Hook (Component Wrapper)', () => {
    let mockSafeUpdateGameState: jest.Mock;
    let mockSetGameState: jest.Mock;
    let mockClearAllTimers: jest.Mock;
    let mockSetOvertime: jest.Mock;
    let mockSetTimeLeft: jest.Mock;
    let mockOnTilePlayed: jest.Mock;

    beforeEach(() => {
        mockSafeUpdateGameState = jest.fn();
        mockSetGameState = jest.fn();
        mockClearAllTimers = jest.fn();
        mockSetOvertime = jest.fn();
        mockSetTimeLeft = jest.fn();
        mockOnTilePlayed = jest.fn();
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(async () => {
        await act(async () => {
            jest.runOnlyPendingTimers();
        });
        jest.useRealTimers();
    });

    const createMockState = (overrides = {}): GameState => createBaseGameState({
        gameId: 'test-room',
        players: [
            { id: 'p1', name: 'Human', hand: [{ id: '1-1', left: 1, right: 1 }] } as unknown as Player,
            { id: 'p2', name: 'Bot', hand: [] } as unknown as Player
        ],
        currentPlayerId: 'p1',
        ...overrides
    });

    const TestComponent = ({ gameState, isSoloMode = false }: { gameState: GameState, isSoloMode?: boolean }) => {
        const engine = useGameEngine({
            gameState,
            localPlayerId: 'p1',
            isSoloMode,
            gameId: 'test-room',
            isPaused: false,
            isLocalHost: true,
            safeUpdateGameState: mockSafeUpdateGameState,
            setGameState: mockSetGameState,
            clearAllTurnTimers: mockClearAllTimers,
            setOvertime: mockSetOvertime,
            setTimeLeft: mockSetTimeLeft,
            onTilePlayed: mockOnTilePlayed
        });

        return (
            <View>
                <Button
                    testID="play"
                    title="Play"
                    onPress={() => engine.handlePlayDomino({ id: '1-1', left: 1, right: 1 } as Domino)
                    }
                />
                < Button
                    testID="pass"
                    title="Pass"
                    onPress={() => engine.handlePassTurn()}
                />
            </View>
        );
    };

    it('handles playing a domino successfully', async () => {
        const DominoEngine = require('../../../core/DominoEngine');
        const LogicEngine = require('../../../core/LogicEngine');
        DominoEngine.getValidMoves.mockReturnValue([{ side: 'start', tile: { id: '1-1' } }]);
        LogicEngine.handleTurn.mockReturnValue({ phase: 'PLAYING' });

        const { getByTestId } = render(<TestComponent gameState={createMockState()} isSoloMode={true} />);

        await act(async () => {
            fireEvent.press(getByTestId('play'));
        });

        expect(mockOnTilePlayed).toHaveBeenCalled();
        expect(mockSetGameState).toHaveBeenCalled();
        expect(LogicEngine.handleTurn).toHaveBeenCalled();
        expect(mockClearAllTimers).toHaveBeenCalled();
    });

    it('blocks manual pass if valid moves exist', async () => {
        const DominoEngine = require('../../../core/DominoEngine');
        const LogicEngine = require('../../../core/LogicEngine');
        DominoEngine.getValidMoves.mockReturnValue([{ side: 'left', tile: { id: '1-1' } }]);

        const { getByTestId } = render(<TestComponent gameState={createMockState()} isSoloMode={true} />);

        await act(async () => {
            fireEvent.press(getByTestId('pass'));
        });

        expect(LogicEngine.passTurn).not.toHaveBeenCalled();
    });

    it('allows manual pass if no valid moves exist', async () => {
        const DominoEngine = require('../../../core/DominoEngine');
        const LogicEngine = require('../../../core/LogicEngine');
        DominoEngine.getValidMoves.mockReturnValue([]);
        LogicEngine.passTurn.mockReturnValue({ phase: 'PLAYING' });

        const { getByTestId } = render(<TestComponent gameState={createMockState()} isSoloMode={true} />);

        // Avancer le temps pour passer l'immunité d'une seconde (C4/P1)
        await act(async () => {
            jest.advanceTimersByTime(1100);
        });

        await act(async () => {
            fireEvent.press(getByTestId('pass'));
        });

        expect(LogicEngine.passTurn).toHaveBeenCalled();
        expect(mockSetGameState).toHaveBeenCalled();
        expect(mockClearAllTimers).toHaveBeenCalled();
    });
});
