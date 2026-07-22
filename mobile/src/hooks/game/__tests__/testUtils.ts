import { GameState, Player, Domino } from '../../../core/types';

export const createBaseGameState = (overrides?: Partial<GameState>): GameState => {
    return {
        gameId: 'test-game',
        players: [
            { id: 'player1', name: 'Tester', hand: [], handSize: 0, currentMancheStars: 0, wins: 0, mancheWins: 0, totalRoundWins: 0, totalPoints: 0, isCochon: false, totalCochons: 0, totalCochonsInfliges: 0, totalCochonsSubis: 0, status: 'HUMAN' },
            { id: 'bot1', name: 'Bot 1', hand: [], handSize: 0, currentMancheStars: 0, wins: 0, mancheWins: 0, totalRoundWins: 0, totalPoints: 0, isCochon: false, totalCochons: 0, totalCochonsInfliges: 0, totalCochonsSubis: 0, status: 'BOT' }
        ],
        talonMort: [],
        table: { sequence: [], leftValue: null, rightValue: null },
        currentPlayerId: 'player1',
        phase: 'PLAYING',
        firstPlayerOfRound: 'player1',
        history: [],
        winningCondition: 3,
        gameMode: 'MANCHE',
        mancheResult: null,
        turnDuration: 30,
        lastActionTimestamp: Date.now(),
        turnId: 0,
        mancheHistory: [],
        roundNumber: 1,
        mancheNumber: 1,
        startingHandSize: 7,
        ...overrides
    };
};

describe('testUtils Placeholder', () => { it('dummy', () => {}); });
