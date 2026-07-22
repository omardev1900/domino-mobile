import { finalizeRound, determineWinnerOnBoudé } from './src/core/ScoringEngine';
import { GameState, GameMode, Player, PlayerId } from './src/core/types';
import * as fs from 'fs';

const createMockState = (playersData: { id: string, stars: number, totalPoints: number, totalCochons: number, hand: any[] }[], gameMode: GameMode = 'SCORE', winningCondition: number = 30): GameState => {
    return {
        players: playersData.map(p => ({
            id: p.id,
            name: p.id,
            currentMancheStars: p.stars,
            totalPoints: p.totalPoints,
            mancheWins: 0,
            totalRoundWins: 0,
            totalCochons: p.totalCochons,
            isCochon: false,
            isBot: false,
            hand: p.hand,
            handSize: p.hand.length,
        } as unknown as Player)),
        gameId: 'test-game-id',
        turnDuration: 30,
        phase: 'BOUDE',
        gameMode,
        winningCondition,
        talonMort: [],
        table: { sequence: [], leftValue: null, rightValue: null },
        history: [],
        lastActionTimestamp: 0,
        currentPlayerId: playersData[0].id,
        mancheResult: null,
        firstPlayerOfRound: null as PlayerId | null,
        mancheHistory: [],
        roundNumber: 1,
        mancheNumber: 1,
        startingHandSize: 7
    };
};

try {
    let state = createMockState([
        { id: 'A', stars: 2, totalPoints: 10, totalCochons: 0, hand: [{ id: '1', left: 2, right: 3 }] }, // 5 pts
        { id: 'B', stars: 0, totalPoints: 5, totalCochons: 0, hand: [{ id: '2', left: 10, right: 10 }] }, // 20 pts
        { id: 'C', stars: 0, totalPoints: 5, totalCochons: 0, hand: [{ id: '3', left: 15, right: 15 }] }  // 30 pts
    ]);

    const { resolveBoude } = require('./src/core/LogicEngine');
    const { newState, isTie } = resolveBoude(state);

    let output = `isTie: ${isTie}\n`;
    const winner = newState.players.find((p: Player) => p.id === 'A');
    output += `Winner A points: ${winner?.totalPoints} (expected 10 + 1 + 2 = 13)\n`;
    output += `Winner A stars: ${winner?.currentMancheStars}\n`;
    output += `Phase: ${newState.phase} (expected MANCHE_END)\n`;
    output += `Result: ${newState.mancheResult} (expected COCHON)\n`;

    fs.writeFileSync('test_output.txt', output);
    console.log("TEST SUCCESSFUL. Check test_output.txt");
} catch (e: any) {
    fs.writeFileSync('test_output.txt', "ERROR: " + e.message + "\n" + e.stack);
    console.error("TEST FAILED.");
}
