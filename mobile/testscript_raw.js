const fs = require('fs');

const { determineWinnerOnBoudé, finalizeRound } = require('./src/core/ScoringEngine');
const { Player } = require('./src/core/types');

const log = (msg) => {
    fs.appendFileSync('test_output.txt', msg + '\n');
}

const createMockState = (playersData) => {
    return {
        players: playersData.map(p => ({
            id: p.id,
            name: p.id,
            currentMancheStars: p.stars,
            totalPoints: p.totalPoints,
            mancheWins: 0,
            totalRoundWins: 0,
            totalCochons: p.totalCochons || 0,
            isCochon: false,
            isBot: false,
            hand: p.hand || [],
            handSize: p.hand ? p.hand.length : 0,
        })),
        gameId: 'test-game-id',
        turnDuration: 30,
        phase: 'BOUDE',
        gameMode: 'SCORE',
        winningCondition: 30,
        talonMort: [],
        table: { sequence: [], leftValue: null, rightValue: null },
        history: [],
        lastActionTimestamp: 0,
        currentPlayerId: playersData[0].id,
        mancheResult: null,
        firstPlayerOfRound: null,
        mancheHistory: [],
        roundNumber: 1,
        mancheNumber: 1,
        startingHandSize: 7
    };
};

try {
    log("=== STARTING TEST ===");
    let state = createMockState([
        { id: 'A', stars: 2, totalPoints: 10, totalCochons: 0, hand: [{ id: '1', left: 2, right: 3 }] }, // 5 pts
        { id: 'B', stars: 0, totalPoints: 5, totalCochons: 0, hand: [{ id: '2', left: 10, right: 10 }] }, // 20 pts
        { id: 'C', stars: 0, totalPoints: 5, totalCochons: 0, hand: [{ id: '3', left: 15, right: 15 }] }  // 30 pts
    ]);

    const { resolveBoude } = require('./src/core/LogicEngine');
    const { newState, isTie } = resolveBoude(state);

    log(`isTie: ${isTie}`);
    const winner = newState.players.find(p => p.id === 'A');
    log(`Winner A points: ${winner.totalPoints} (expected 10 + 1 + 2 = 13)`);
    log(`Winner A stars: ${winner.currentMancheStars}`);
    log(`Phase: ${newState.phase} (expected MANCHE_END)`);
    log(`Result: ${newState.mancheResult} (expected COCHON)`);

    log("=== END TEST ===");
} catch (e) {
    log("ERROR: " + e.message);
}
