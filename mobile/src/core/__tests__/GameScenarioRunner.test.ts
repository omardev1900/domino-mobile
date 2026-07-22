import { computeBotDecision } from '../BotEngine';
import {
    computeNextRoundState,
    dealGame,
    dealGameSolo,
    handleTimeout,
    handleTurn,
    passTurn,
    resolveBoude,
} from '../LogicEngine';
import { GameMode, GameState, Player } from '../types';
import { createBaseGameState } from '../../hooks/game/__tests__/testUtils';

type ScenarioConfig = {
    name: string;
    mode: GameMode;
    winningCondition: number;
    setup: 'solo' | 'multiWithBots';
    seeds: number[];
};

const MAX_STEPS_PER_MATCH = 700;
const VALID_PHASES = ['PLAYING', 'BOUDE', 'PARTIE_END', 'MANCHE_END', 'MATCH_END'];

const createSeededRandom = (seed: number) => {
    let value = seed;
    return () => {
        value = (value * 1664525 + 1013904223) % 4294967296;
        return value / 4294967296;
    };
};

const withSeededRandom = <T>(seed: number, run: () => T): T => {
    const spy = jest.spyOn(Math, 'random').mockImplementation(createSeededRandom(seed));
    try {
        return run();
    } finally {
        spy.mockRestore();
    }
};

const assertPlayableState = (state: GameState, label: string) => {
    expect(VALID_PHASES).toContain(state.phase);
    expect(state.players.length).toBeGreaterThanOrEqual(2);
    expect(state.players.some(p => p.id === state.currentPlayerId)).toBe(true);
    expect(state.turnId).toBeGreaterThanOrEqual(0);

    const disconnectedHumans = state.players.filter(p => p.status === 'DISCONNECTED' && !p.id.startsWith('bot'));
    expect(disconnectedHumans).toEqual([]);

    const duplicateDominoIds = new Set<string>();
    for (const player of state.players) {
        for (const domino of player.hand) {
            const key = `${player.id}:${domino.id}`;
            expect(duplicateDominoIds.has(key)).toBe(false);
            duplicateDominoIds.add(key);
        }
    }

    if (state.phase === 'PLAYING') {
        const currentPlayer = state.players.find(p => p.id === state.currentPlayerId);
        if (!currentPlayer) {
            throw new Error(`${label}: currentPlayerId ${state.currentPlayerId} not found`);
        }
    }
};

const normalizePlayersForMultiBots = (players: Player[]) => players.map((player, index) => {
    if (index === 0) {
        return {
            ...player,
            id: 'human-host',
            name: 'Host',
            status: 'HUMAN' as const,
        };
    }

    return {
        ...player,
        id: `bot-${index}`,
        name: `Bot ${index}`,
        status: 'BOT' as const,
        difficulty: index === 1 ? 'GRAN_MOUN' as const : 'MAPIPI' as const,
    };
});

const createScenarioState = (config: ScenarioConfig, seed: number): GameState => withSeededRandom(seed, () => {
    if (config.setup === 'solo') {
        const partial = dealGameSolo('human-host', 'Host', 'avatar_1', 'MAPIPI', 7);
        return createBaseGameState({
            ...partial,
            gameId: `${config.name}-${seed}`,
            gameMode: config.mode,
            winningCondition: config.winningCondition,
            currentPlayerId: partial.players![0].id,
            firstPlayerOfRound: partial.players![0].id,
            startingHandSize: 7,
        } as Partial<GameState>);
    }

    const partial = dealGame(['Host', 'Bot 1', 'Bot 2'], 7);
    const players = normalizePlayersForMultiBots(partial.players as Player[]);

    return createBaseGameState({
        ...partial,
        players,
        gameId: `${config.name}-${seed}`,
        createdBy: 'human-host',
        gameMode: config.mode,
        winningCondition: config.winningCondition,
        currentPlayerId: players[0].id,
        firstPlayerOfRound: players[0].id,
        startingHandSize: 7,
    } as Partial<GameState>);
});

const advanceTerminalPhase = (state: GameState): GameState => {
    if (state.phase === 'BOUDE') {
        const result = resolveBoude(state);
        if (result.isTie) {
            return {
                ...computeNextRoundState({
                    ...result.newState,
                    phase: 'PARTIE_END',
                    reDealCount: (state.reDealCount || 0) + 1,
                    tiedPlayerIds: result.tiedPlayerIds,
                }),
                tiedPlayerIds: result.tiedPlayerIds,
            };
        }
        return result.newState;
    }

    if (state.phase === 'PARTIE_END' || state.phase === 'MANCHE_END') {
        return computeNextRoundState(state);
    }

    return state;
};

const playOneAutomatedStep = (state: GameState): GameState => {
    if (state.phase !== 'PLAYING') {
        return advanceTerminalPhase(state);
    }

    const currentPlayerId = state.currentPlayerId;
    const decision = computeBotDecision(state, currentPlayerId);

    if (decision) {
        return handleTurn(
            state,
            currentPlayerId,
            decision.tile,
            decision.side === 'start' ? undefined : decision.side
        );
    }

    return passTurn(state, currentPlayerId);
};

const runAutomatedMatch = (initialState: GameState, label: string): GameState => {
    let state = initialState;

    for (let step = 0; step < MAX_STEPS_PER_MATCH; step++) {
        assertPlayableState(state, `${label}/step-${step}`);

        if (state.phase === 'MATCH_END') {
            return state;
        }

        state = playOneAutomatedStep(state);
    }

    throw new Error(`${label} exceeded ${MAX_STEPS_PER_MATCH} automated steps`);
};

describe('GameScenarioRunner - automated anti-freeze scenarios', () => {
    const scenarios: ScenarioConfig[] = [
        { name: 'solo-manche', setup: 'solo', mode: 'MANCHE', winningCondition: 1, seeds: [11, 12, 13] },
        { name: 'solo-score', setup: 'solo', mode: 'SCORE', winningCondition: 3, seeds: [21, 22] },
        { name: 'solo-victoire', setup: 'solo', mode: 'VICTOIRE', winningCondition: 2, seeds: [31, 32] },
        { name: 'multi-bots-manche', setup: 'multiWithBots', mode: 'MANCHE', winningCondition: 1, seeds: [41, 42, 43] },
        { name: 'multi-bots-score', setup: 'multiWithBots', mode: 'SCORE', winningCondition: 3, seeds: [51, 52] },
        { name: 'multi-bots-cochon', setup: 'multiWithBots', mode: 'COCHON', winningCondition: 1, seeds: [61, 62] },
    ];

    test.each(scenarios)('$name completes seeded automated matches', (config) => {
        for (const seed of config.seeds) {
            const finalState = createScenarioState(config, seed);
            const result = withSeededRandom(seed + 1000, () => runAutomatedMatch(finalState, `${config.name}/${seed}`));

            expect(result.phase).toBe('MATCH_END');
            expect(result.players.some(p => (p.totalPoints || 0) > 0 || (p.totalCochonsInfliges || 0) > 0)).toBe(true);
        }
    });

    it('resolves a forced blocked game into the next playable state', () => {
        const blockedState = createBaseGameState({
            gameId: 'forced-boude',
            phase: 'PLAYING',
            gameMode: 'MANCHE',
            winningCondition: 1,
            currentPlayerId: 'p1',
            table: {
                sequence: [{ domino: { id: 'd66', left: 6, right: 6, isDouble: true }, sideAtTable: 'right', isReversed: false }],
                leftValue: 6,
                rightValue: 6,
            },
            history: [
                { playerId: 'p2', action: 'PASS', timestamp: 1 },
                { playerId: 'p3', action: 'PASS', timestamp: 2 },
            ],
            players: [
                { id: 'p1', name: 'P1', hand: [{ id: 'd00', left: 0, right: 0, isDouble: true }], handSize: 1, currentMancheStars: 0, wins: 0, mancheWins: 0, totalRoundWins: 0, totalPoints: 0, isCochon: false, totalCochons: 0, totalCochonsInfliges: 0, totalCochonsSubis: 0, status: 'HUMAN' },
                { id: 'p2', name: 'P2', hand: [{ id: 'd11', left: 1, right: 1, isDouble: true }], handSize: 1, currentMancheStars: 0, wins: 0, mancheWins: 0, totalRoundWins: 0, totalPoints: 0, isCochon: false, totalCochons: 0, totalCochonsInfliges: 0, totalCochonsSubis: 0, status: 'BOT' },
                { id: 'p3', name: 'P3', hand: [{ id: 'd22', left: 2, right: 2, isDouble: true }], handSize: 1, currentMancheStars: 0, wins: 0, mancheWins: 0, totalRoundWins: 0, totalPoints: 0, isCochon: false, totalCochons: 0, totalCochonsInfliges: 0, totalCochonsSubis: 0, status: 'BOT' },
            ],
        } as Partial<GameState>);

        const boudeState = passTurn(blockedState, 'p1');
        expect(boudeState.phase).toBe('BOUDE');

        const resolved = advanceTerminalPhase(boudeState);
        const playable = advanceTerminalPhase(resolved);

        expect(['PLAYING', 'MATCH_END']).toContain(playable.phase);
        expect(playable.players.find(p => p.id === 'p1')?.status).toBe('HUMAN');
    });

    it('keeps timeout automation separate from network disconnection', () => {
        const state = createBaseGameState({
            gameId: 'timeout-human-online',
            currentPlayerId: 'human-host',
            table: {
                sequence: [{ domino: { id: 'd55', left: 5, right: 5, isDouble: true }, sideAtTable: 'right', isReversed: false }],
                leftValue: 5,
                rightValue: 5,
            },
            players: [
                { id: 'human-host', name: 'Host', hand: [{ id: 'd05', left: 0, right: 5, isDouble: false }], handSize: 1, currentMancheStars: 0, wins: 0, mancheWins: 0, totalRoundWins: 0, totalPoints: 0, isCochon: false, totalCochons: 0, totalCochonsInfliges: 0, totalCochonsSubis: 0, status: 'HUMAN' },
                { id: 'bot-1', name: 'Bot 1', hand: [{ id: 'd11', left: 1, right: 1, isDouble: true }], handSize: 1, currentMancheStars: 0, wins: 0, mancheWins: 0, totalRoundWins: 0, totalPoints: 0, isCochon: false, totalCochons: 0, totalCochonsInfliges: 0, totalCochonsSubis: 0, status: 'BOT' },
            ],
        } as Partial<GameState>);

        const afterTimeout = handleTimeout(state, 'human-host');

        expect(afterTimeout.players.find(p => p.id === 'human-host')?.status).toBe('HUMAN');
        expect(['PLAYING', 'PARTIE_END', 'MANCHE_END', 'MATCH_END']).toContain(afterTimeout.phase);
    });
});
