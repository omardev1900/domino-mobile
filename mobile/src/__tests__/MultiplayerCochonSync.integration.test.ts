import { finalizeRound } from '../core/ScoringEngine';
import { GameState, Player } from '../core/types';

/** Factory locale — crée un GameState minimal sans dépendance externe */
const createBaseGameState = (overrides: Partial<GameState>): GameState => ({
    gameId: 'test-game',
    players: [],
    talonMort: [],
    table: { sequence: [], leftValue: null, rightValue: null },
    currentPlayerId: 'A',
    phase: 'PLAYING',
    firstPlayerOfRound: null,
    history: [],
    winningCondition: 2,
    gameMode: 'COCHON',
    mancheResult: null,
    turnDuration: 15,
    lastActionTimestamp: Date.now(),
    turnId: 1,
    mancheHistory: [],
    roundNumber: 1,
    mancheNumber: 1,
    startingHandSize: 7,
    ...overrides,
});

// Mocking some dependencies if needed, or using real logic as it's an integration test of logic + expected db behavior
// We'll simulate the "Database" as an object that all "Clients" read/write to.

class MockDB {
    private state: any = null;
    private listeners: ((state: any) => void)[] = [];

    setState(newState: any) {
        this.state = JSON.parse(JSON.stringify(newState));
        this.notify();
    }

    getState() {
        return JSON.parse(JSON.stringify(this.state));
    }

    notify() {
        this.listeners.forEach(l => l(this.state));
    }

    subscribe(callback: (state: any) => void) {
        this.listeners.push(callback);
        callback(this.state);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    async runTransaction(updateFn: (currentState: any) => Promise<any> | any) {
        // Simulate network latency if desired
        const currentState = this.getState();
        const newState = await updateFn(currentState);
        if (newState) {
            this.setState(newState);
        }
        return true;
    }
}

describe('Multiplayer Cochon Synchronization Integration', () => {
    let db: MockDB;

    // Clients
    let playerA_State: GameState;
    let playerB_State: GameState;
    let playerC_State: GameState;

    const createInitialCochonState = (): GameState => {
        return createBaseGameState({
            players: [
                { id: 'A', name: 'Player A', hand: [], handSize: 0, currentMancheStars: 2, totalPoints: 10, totalCochons: 0, totalCochonsInfliges: 0, totalCochonsSubis: 0, wins: 2, mancheWins: 0, totalRoundWins: 0, isCochon: false, status: 'HUMAN' } as Player,
                { id: 'B', name: 'Player B', hand: [{ id: 'd1', sum: 5 } as any], handSize: 1, currentMancheStars: 0, totalPoints: 5, totalCochons: 0, totalCochonsInfliges: 0, totalCochonsSubis: 0, wins: 0, mancheWins: 0, totalRoundWins: 0, isCochon: false, status: 'HUMAN' } as Player,
                { id: 'C', name: 'Player C', hand: [{ id: 'd2', sum: 10 } as any], handSize: 1, currentMancheStars: 0, totalPoints: 3, totalCochons: 0, totalCochonsInfliges: 0, totalCochonsSubis: 0, wins: 0, mancheWins: 0, totalRoundWins: 0, isCochon: false, status: 'HUMAN' } as Player
            ],
            gameMode: 'COCHON',
            phase: 'PLAYING',
            roundNumber: 3,
            mancheNumber: 1,
            mancheHistory: [],
            currentPlayerId: 'A'
        });
    };

    beforeEach(() => {
        db = new MockDB();
        const initialState = createInitialCochonState();
        db.setState(initialState);

        // Connect clients to "Real-time" DB
        db.subscribe(s => playerA_State = s);
        db.subscribe(s => playerB_State = s);
        db.subscribe(s => playerC_State = s);
    });

    test('Propagation du Cochon : Player A gagne et les scores se synchronisent pour tous', async () => {
        // 1. Player A (Host) detects win and runs finalizeRound
        // In reality, this would be triggered by handleTurn when hand.length === 0
        const stateBeforeWin = db.getState();

        // Simulating the action that triggers the end of round
        // Player A wins the round, reaching 3 stars while B and C are at 0.
        const newStateAfterWin = finalizeRound(stateBeforeWin, 'A');

        // Verify the logic result locally first
        expect(newStateAfterWin.mancheResult).toBe('COCHON');
        expect(newStateAfterWin.phase).toBe('MATCH_END');

        const playerA = newStateAfterWin.players.find(p => p.id === 'A');
        const playerB = newStateAfterWin.players.find(p => p.id === 'B');
        const playerC = newStateAfterWin.players.find(p => p.id === 'C');

        // Initial : A:10, B:5, C:3
        // A gagne le round (+1 donc 3 étoiles) et bonus double cochon (+2) => +3 => 13
        // B et C sont cochons => -1
        expect(playerA?.totalPoints).toBe(13);
        expect(playerB?.totalPoints).toBe(4);
        expect(playerC?.totalPoints).toBe(2);

        // Manche history check
        const latestHistory = newStateAfterWin.mancheHistory[0];
        // Points in history for the winner = round wins (3) + cochonCount (2) = 5
        expect(latestHistory.points['A']).toBe(5);
        expect(latestHistory.points['B']).toBe(-1);
        expect(latestHistory.points['C']).toBe(-1);

        // Seul le vainqueur cumule les cochons infligés ; les perdants subissent seulement le malus.
        expect(playerA?.totalCochonsInfliges).toBe(2);
        expect(playerA?.totalCochons).toBe(2);
        expect(playerB?.totalCochons).toBe(0);
        expect(playerC?.totalCochons).toBe(0);
        expect(playerB?.totalCochonsSubis).toBe(1);
        expect(playerC?.totalCochonsSubis).toBe(1);

        // 2. Propagation to DB
        await db.runTransaction(() => newStateAfterWin);

        // 3. Verify all clients see the SAME data
        expect(playerA_State.phase).toBe('MATCH_END');
        expect(playerB_State.phase).toBe('MATCH_END');
        expect(playerC_State.phase).toBe('MATCH_END');

        expect(playerB_State.mancheHistory).toEqual(playerA_State.mancheHistory);
        // A: 10 initial + 1 star (current win) + 2 cochon bonus = 13 (since previous 2 stars were already in the 10)
        expect(playerB_State.players.find(p => p.id === 'A')?.totalPoints).toBe(13);
    });

    test('Validation de l\'Overlay : Tous les clients reçoivent le badge Cochon', async () => {
        // Here we simulate that the state has reached MANCHE_END with result COCHON
        const cochonState = db.getState();
        cochonState.phase = 'MANCHE_END';
        cochonState.mancheResult = 'COCHON';
        await db.runTransaction(() => cochonState);

        // Verify clients local views
        [playerA_State, playerB_State, playerC_State].forEach(clientState => {
            expect(clientState.phase).toBe('MANCHE_END');
            expect(clientState.mancheResult).toBe('COCHON');
            // This ensures the UnifiedResultOverlay (which reads this state) will show the badge
        });
    });

    test('Robustesse (Latence) : Aucun démarrage de manche avant sauvegarde', async () => {
        // Let's simulate a slow DB update
        let resolveSave: any;
        const savePromise = new Promise(r => resolveSave = r);

        const currentActiveState = db.getState();
        const nextState = finalizeRound(currentActiveState, 'A');

        // Start saving
        const dbUpdate = db.runTransaction(async () => {
            await savePromise; // Delay
            return nextState;
        });

        // Client B tries to check phase or see if they can continue (but phase is still PLAYING in DB)
        expect(db.getState().phase).toBe('PLAYING');

        // Resolve save
        resolveSave();
        await dbUpdate;

        // Now phase is updated
        expect(db.getState().phase).toBe('MATCH_END');
    });
});
