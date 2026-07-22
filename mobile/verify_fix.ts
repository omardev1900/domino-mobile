
import { handleTurn } from './src/core/LogicEngine';
import { GameState, Domino, Player } from './src/core/types';

const runTest = () => {
    console.log("--- STARTING LOGIC VERIFICATION ---");

    const p1: Player = {
        id: 'p1', name: 'Player 1', hand: [
            { id: '6-6', left: 6, right: 6, isDouble: true, sum: 12 },
            { id: '6-2', left: 6, right: 2, isDouble: false, sum: 8 },
            { id: '2-3', left: 2, right: 3, isDouble: false, sum: 5 }
        ], handSize: 3, wins: 0, mancheWins: 0, totalPoints: 0, isCochon: false, totalCochons: 0, isBot: false, currentMancheStars: 0, totalRoundWins: 0
    };

    let state: GameState = {
        gameId: 'test',
        players: [p1],
        talonMort: [],
        table: { sequence: [], leftValue: null, rightValue: null },
        history: [],
        currentPlayerId: 'p1',
        phase: 'PLAYING',
        firstPlayerOfRound: 'p1',
        winningCondition: 100,
        lastActionTimestamp: Date.now(),
        gameMode: 'MANCHE',
        turnDuration: 15,
        mancheHistory: [],
        roundNumber: 1,
        mancheNumber: 1,
        startingHandSize: 7
    };

    console.log("1. Playing first domino (6-6)");
    state = handleTurn(state, 'p1', p1.hand[0]);
    console.log("   Table ends:", state.table.leftValue, "and", state.table.rightValue);
    console.log("   Sequence length:", state.table.sequence.length);

    console.log("2. Playing 6-2 to the LEFT");
    // To play 6-2 on the left of 6-6, it must be reversed if we want 2 to be the new end.
    // wait, if left end is 6, and we play 6-2:
    // If we play it as (2-6)(6-6), the new left end is 2.
    // getValidMoves would say: if d.left (6) == ends.left (6), isReversed = true.
    // (6-2) reversed becomes (2-6). 2 is the new end.
    state = handleTurn(state, 'p1', p1.hand[1], 'left');
    console.log("   Table ends:", state.table.leftValue, "and", state.table.rightValue);
    console.log("   Sequence[0]:", state.table.sequence[0].domino.left, "-", state.table.sequence[0].domino.right, "(isReversed:", state.table.sequence[0].isReversed, ")");

    if (state.table.leftValue !== 2) {
        console.error("FAILURE: Left value should be 2, got", state.table.leftValue);
        process.exit(1);
    }
    if (state.table.sequence[0].domino.id !== '6-2') {
        console.error("FAILURE: First element of sequence should be 6-2");
        process.exit(1);
    }

    console.log("3. Playing 2-3 to the LEFT (should match the 2)");
    // Left end is 2. Tile 2-3.
    // d.left (2) == ends.left (2) => isReversed = true => (3-2). New end 3.
    state = handleTurn(state, 'p1', p1.hand[2], 'left');
    console.log("   Table ends:", state.table.leftValue, "and", state.table.rightValue);

    if (state.table.leftValue !== 3) {
        console.error("FAILURE: Left value should be 3, got", state.table.leftValue);
        process.exit(1);
    }

    console.log("--- LOGIC VERIFICATION SUCCESSFUL ---");
};

runTest();
