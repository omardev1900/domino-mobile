import { handleTimeout } from '../LogicEngine';
import { GameState } from '../types';

describe('Bot freeze test', () => {
    it('should not throw in handleTimeout for round 2 when playing', () => {
        const state: GameState = {
            id: 'g1',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            createdBy: 'u1',
            status: 'PLAYING',
            players: [
                { id: 'p1', name: 'P1', hand: [{ id: 'd-14', left: 2, right: 5 }, { id: 'd-15', left: 2, right: 6 }], isReady: true, status: 'ONLINE', handSize: 2, difficulty: 'METKAYALI', connectedAt: 0 },
                { id: 'p2', name: 'P2', hand: [{ id: 'd-27', left: 6, right: 6 }], isReady: true, status: 'ONLINE', handSize: 1, difficulty: 'HUMAN', connectedAt: 0 }
            ],
            currentPlayerId: 'p1',
            table: {
                sequence: [
                    { domino: { id: 'd-5', left: 0, right: 5 }, sideAtTable: 'left', isReversed: false }
                ],
                leftValue: 0,
                rightValue: 5
            },
            gameMode: 'MANCHE',
            winningCondition: 1,
            lastActionTimestamp: Date.now(),
            turnId: 3,
            roundNumber: 2,
            mancheNumber: 1,
            history: [
                { action: 'PLAY', playerId: 'p1', timestamp: Date.now(), domino: { id: 'd-5', left: 0, right: 5 }, side: 'left' }
            ],
            startingHandSize: 7,
            phase: 'PLAYING'
        };
        
        const newState = handleTimeout(state, 'p1');
        expect(newState.turnId).toBe(4);
        expect(newState.history[newState.history.length - 1].action).toBe('PLAY');
    });

    it('keeps a human player online when timeout auto-plays', () => {
        const state: GameState = {
            id: 'g1',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            createdBy: 'u1',
            status: 'PLAYING',
            players: [
                { id: 'p1', name: 'P1', hand: [{ id: 'd-14', left: 2, right: 5 }], isReady: true, status: 'HUMAN', handSize: 1, connectedAt: 0 },
                { id: 'p2', name: 'P2', hand: [{ id: 'd-27', left: 6, right: 6 }], isReady: true, status: 'BOT', handSize: 1, connectedAt: 0 }
            ] as any,
            currentPlayerId: 'p1',
            table: {
                sequence: [
                    { domino: { id: 'd-5', left: 0, right: 5 }, sideAtTable: 'left', isReversed: false }
                ],
                leftValue: 0,
                rightValue: 5
            },
            gameMode: 'MANCHE',
            winningCondition: 1,
            lastActionTimestamp: Date.now(),
            turnId: 3,
            roundNumber: 1,
            mancheNumber: 1,
            history: [],
            startingHandSize: 7,
            phase: 'PLAYING'
        } as any;

        const newState = handleTimeout(state, 'p1');

        expect(newState.players.find(p => p.id === 'p1')?.status).toBe('HUMAN');
    });
});
