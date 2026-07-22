import React from 'react';
import { render, act } from '@testing-library/react-native';
import { useGameTimers } from '../useGameTimers';
import { GameState, Player } from '../../../core/types';
import { createBaseGameState } from './testUtils';
import { Text, View } from 'react-native';

describe('useGameTimers Hook (Component Wrapper)', () => {
    let mockOnTimeout: jest.Mock;

    beforeEach(() => {
        mockOnTimeout = jest.fn();
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    const createMockState = (overrides = {}): GameState => createBaseGameState({
        gameId: 'test-room',
        players: [
            { id: 'p1', name: 'Human', status: 'HUMAN' } as Player,
            { id: 'p2', name: 'Bot', status: 'BOT' } as Player
        ],
        currentPlayerId: 'p1',
        turnDuration: 10,
        ...overrides
    });

    const TestComponent = ({ gameState, localPlayerId = 'p1', onTimeout }: any) => {
        const { timeLeft, overtime } = useGameTimers({
            gameState,
            isPaused: false,
            localPlayerId,
            onTimeout: mockOnTimeout
        });


        return (
            <View>
                <Text testID="timeLeft">{timeLeft === null ? 'null' : timeLeft}</Text>
                <Text testID="overtime">{overtime === null ? 'null' : overtime}</Text>
            </View>
        );
    };

    it('initializes timer for human player in PLAYING phase', () => {
        const gameState = createMockState();
        const { getByTestId } = render(<TestComponent gameState={gameState} onTimeout={mockOnTimeout} />);

        expect(getByTestId('timeLeft').props.children).toBe(10);
        expect(getByTestId('overtime').props.children).toBe('null');
    });

    it('clears timer if phase is not PLAYING', () => {
        const gameState = createMockState({ phase: 'MATCH_END' });
        const { getByTestId } = render(<TestComponent gameState={gameState} onTimeout={mockOnTimeout} />);

        expect(getByTestId('timeLeft').props.children).toBe('null');
        expect(getByTestId('overtime').props.children).toBe('null');
    });

    it('does not run the turn timer during BOUDE resolution', () => {
        const gameState = createMockState({ phase: 'BOUDE' });
        const { getByTestId } = render(<TestComponent gameState={gameState} onTimeout={mockOnTimeout} />);

        expect(getByTestId('timeLeft').props.children).toBe('null');
        expect(getByTestId('overtime').props.children).toBe('null');
    });

    it('does not start timer for bot players', () => {
        const gameState = createMockState({ currentPlayerId: 'p2' }); // p2 est un bot
        const { getByTestId } = render(<TestComponent gameState={gameState} onTimeout={mockOnTimeout} />);

        expect(getByTestId('timeLeft').props.children).toBe('null');
    });

    it('decrements timeLeft and activates overtime when it reaches 0', () => {
        const gameState = createMockState({ turnDuration: 5 });
        const { getByTestId } = render(<TestComponent gameState={gameState} onTimeout={mockOnTimeout} />);

        act(() => {
            jest.advanceTimersByTime(4000);
        });
        expect(getByTestId('timeLeft').props.children).toBe(1);

        act(() => {
            jest.advanceTimersByTime(1100);
        });

        expect(getByTestId('timeLeft').props.children).toBe(0);
        expect(getByTestId('overtime').props.children).toBe(5);
    });

    it('triggers onTimeout and watchdog resets overtime to 2', () => {
        const gameState = createMockState({ turnDuration: 1 });
        const { getByTestId } = render(<TestComponent gameState={gameState} onTimeout={mockOnTimeout} />);

        // Passer le timeLeft
        act(() => {
            jest.advanceTimersByTime(1100);
        });

        // Avancer tout l'overtime (5s) par étape pour déclencher les useEffect successifs
        for(let i = 0; i < 5; i++) {
            act(() => {
                jest.advanceTimersByTime(1000);
            });
        }

        expect(getByTestId('overtime').props.children).toBe(2);
        expect(mockOnTimeout).toHaveBeenCalledWith('p1', expect.any(Number));
    });

    it('watchdog stops after 3 retries', () => {
        const gameState = createMockState({ turnDuration: 1 });
        const { getByTestId } = render(<TestComponent gameState={gameState} onTimeout={mockOnTimeout} />);

        // Passer le timeLeft
        act(() => {
            jest.advanceTimersByTime(1100);
        });

        // Avancer overtime initial de 5s
        for(let i = 0; i < 5; i++) {
            act(() => jest.advanceTimersByTime(1000));
        }

        expect(getByTestId('overtime').props.children).toBe(2);
        expect(mockOnTimeout).toHaveBeenCalledTimes(1);

        // Attempt 2 (2 seconds later)
        act(() => { jest.advanceTimersByTime(1000); });
        act(() => { jest.advanceTimersByTime(1000); });
        expect(getByTestId('overtime').props.children).toBe(2);
        expect(mockOnTimeout).toHaveBeenCalledTimes(2);

        // Attempt 3 (2 seconds later)
        act(() => { jest.advanceTimersByTime(1000); });
        act(() => { jest.advanceTimersByTime(1000); });
        expect(getByTestId('overtime').props.children).toBe(2);
        expect(mockOnTimeout).toHaveBeenCalledTimes(3);

        // Attempt 4 (2 seconds later) - should stop
        act(() => { jest.advanceTimersByTime(1000); });
        act(() => { jest.advanceTimersByTime(1000); });
        expect(getByTestId('overtime').props.children).toBe('null');
        expect(mockOnTimeout).toHaveBeenCalledTimes(4);
    });
});
