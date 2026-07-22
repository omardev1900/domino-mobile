import { renderHook, act } from '@testing-library/react-native';
import { useBotDecision } from '../useBotDecision';
import { createBaseGameState } from './testUtils';

jest.mock('../../../core/MeytKayaliEngine', () => {
    const actual = jest.requireActual('../../../core/MeytKayaliEngine');
    return {
        ...actual,
        getMeytKayaliMove: jest.fn(() => {
            throw new Error('METKAYALI crash');
        }),
    };
});

describe('useBotDecision', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('dispatches an emergency fallback move when METKAYALI throws', () => {
        const dispatch = jest.fn().mockResolvedValue(undefined);
        const gameState = createBaseGameState({
            currentPlayerId: 'bot1',
            turnId: 12,
            table: {
                sequence: [{ domino: { id: 'd-1', left: 0, right: 5, isDouble: false }, sideAtTable: 'left', isReversed: false }],
                leftValue: 0,
                rightValue: 5,
            },
            players: [
                {
                    id: 'player1',
                    name: 'Tester',
                    hand: [],
                    handSize: 0,
                    currentMancheStars: 0,
                    wins: 0,
                    mancheWins: 0,
                    totalRoundWins: 0,
                    totalPoints: 0,
                    isCochon: false,
                    totalCochons: 0,
                    totalCochonsInfliges: 0,
                    totalCochonsSubis: 0,
                    status: 'HUMAN',
                },
                {
                    id: 'bot1',
                    name: 'Maxime',
                    hand: [{ id: 'd-2', left: 5, right: 6, isDouble: false }],
                    handSize: 1,
                    currentMancheStars: 0,
                    wins: 0,
                    mancheWins: 0,
                    totalRoundWins: 0,
                    totalPoints: 0,
                    isCochon: false,
                    totalCochons: 0,
                    totalCochonsInfliges: 0,
                    totalCochonsSubis: 0,
                    status: 'BOT',
                    difficulty: 'METKAYALI',
                },
            ],
        });

        renderHook(() => useBotDecision({
            gameState,
            roomData: null,
            localPlayerId: 'player1',
            isSoloMode: true,
            isPaused: false,
            isLocalHost: true,
            canAction: () => true,
            dispatch,
        }));

        act(() => {
            jest.advanceTimersByTime(2000);
        });

        expect(dispatch).toHaveBeenCalledWith({
            type: 'PLAY_TILE',
            playerId: 'bot1',
            tile: { id: 'd-2', left: 5, right: 6, isDouble: false },
            side: 'right',
        });
    });

    it('retries when the bot action gate is closed on the first attempt', () => {
        jest.spyOn(Math, 'random').mockReturnValue(0);
        const dispatch = jest.fn().mockResolvedValue(undefined);
        const canAction = jest.fn()
            .mockReturnValueOnce(false)
            .mockReturnValue(true);
        const gameState = createBaseGameState({
            currentPlayerId: 'bot1',
            turnId: 13,
            table: {
                sequence: [{ domino: { id: 'd-1', left: 0, right: 5, isDouble: false }, sideAtTable: 'left', isReversed: false }],
                leftValue: 0,
                rightValue: 5,
            },
            players: [
                {
                    id: 'player1',
                    name: 'Tester',
                    hand: [],
                    handSize: 0,
                    currentMancheStars: 0,
                    wins: 0,
                    mancheWins: 0,
                    totalRoundWins: 0,
                    totalPoints: 0,
                    isCochon: false,
                    totalCochons: 0,
                    totalCochonsInfliges: 0,
                    totalCochonsSubis: 0,
                    status: 'HUMAN',
                },
                {
                    id: 'bot1',
                    name: 'Jojo',
                    hand: [{ id: 'd-3', left: 0, right: 2, isDouble: false }],
                    handSize: 1,
                    currentMancheStars: 0,
                    wins: 0,
                    mancheWins: 0,
                    totalRoundWins: 0,
                    totalPoints: 0,
                    isCochon: false,
                    totalCochons: 0,
                    totalCochonsInfliges: 0,
                    totalCochonsSubis: 0,
                    status: 'BOT',
                    difficulty: 'GRAN_MOUN',
                },
            ],
        });

        renderHook(() => useBotDecision({
            gameState,
            roomData: null,
            localPlayerId: 'player1',
            isSoloMode: true,
            isPaused: false,
            isLocalHost: true,
            canAction,
            dispatch,
        }));

        act(() => {
            jest.advanceTimersByTime(1000);
        });
        expect(dispatch).not.toHaveBeenCalled();

        act(() => {
            jest.advanceTimersByTime(250);
        });
        expect(dispatch).toHaveBeenCalledWith({
            type: 'PLAY_TILE',
            playerId: 'bot1',
            tile: { id: 'd-3', left: 0, right: 2, isDouble: false },
            side: 'left',
        });
    });
});
