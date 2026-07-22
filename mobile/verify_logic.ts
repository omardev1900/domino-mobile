
import { dealGame, handleTurn } from './src/core/LogicEngine';
import { Domino } from './src/core/types';

const runVerification = () => {
    console.log("Starting Manual Verification...");

    // 1. Setup State
    const p1 = { id: 'p1', name: 'P1', hand: [{ id: 'd1', left: 6, right: 6, isDouble: true, sum: 12 }], handSize: 1, wins: 0, isCochon: false, status: 'HUMAN' };
    const state = {
        gameId: 'g1',
        players: [p1],
        talonMort: [],
        table: { sequence: [], leftValue: 6, rightValue: 6 },
        history: [],
        currentPlayerId: 'p1',
        phase: 'PLAYING',
        firstPlayerOfRound: 'p1',
        winningCondition: 3,
        gameMode: 'MANCHE' as const,
        turnDuration: 15,
        lastActionTimestamp: 0
    };

    // 2. Try to play a tile NOT in hand
    const foreignTile = { id: 'foreign', left: 6, right: 0, isDouble: false, sum: 6 };

    try {
        // @ts-ignore
        handleTurn(state, 'p1', foreignTile);
        console.error("FAILURE: handleTurn should have thrown but didn't.");
        process.exit(1);
    } catch (e) {
        if ((e as Error).message === "Player does not have this domino") {
            console.log("SUCCESS: Caught expected error 'Player does not have this domino'");
        } else {
            console.error("FAILURE: Caught wrong error:", (e as Error).message);
            process.exit(1);
        }
    }

    console.log("Manual Verification Complete: All Checks Passed.");
};

runVerification();
