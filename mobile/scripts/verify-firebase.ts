
import { createRoom, joinRoom, subscribeToRoom, updateGameState } from '../src/core/services/firebase';
import { PlayerProfile, GameState, RoomStatus } from '../src/core/types';
import { createBaseGameState } from '../src/hooks/game/__tests__/testUtils';

// Polyfill for fetch/timers if needed in some node envs, but usually tsx handles it reasonably well with modern node.
// If not, we might need 'cross-fetch' but let's try standard first.

const fs = require('fs');
const path = require('path');
const logFile = path.join(__dirname, 'verification-log.txt');

function log(message: string) {
    console.log(message);
    fs.appendFileSync(logFile, message + '\n');
}

// Clear log file
if (fs.existsSync(logFile)) {
    fs.unlinkSync(logFile);
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runVerification() {
    log("🚀 Starting Firebase Verification...");

    const hostProfile: PlayerProfile = {
        uid: "host-user-123",
        displayName: "Host Player",
        gamesPlayed: 10,
        gamesWon: 5
    };

    const joinerProfile: PlayerProfile = {
        uid: "joiner-user-456",
        displayName: "Joiner Player",
        gamesPlayed: 5,
        gamesWon: 1
    };

    try {
        // 1. Create Room
        log("\n1️⃣ Creating Room...");
        const roomId = await createRoom(hostProfile, false);
        log(`✅ Room created with ID: ${roomId}`);

        // 2. Subscribe to Room
        log("\n2️⃣ Subscribing to Room updates...");
        const unsubscribe = subscribeToRoom(roomId, (roomData) => {
            log(`🔔 Room Update Received: Status=[${roomData.status}], Players=[${roomData.players.length}]`);
            if (roomData.gameState) {
                log(`   GameState Phase: ${roomData.gameState.phase}`);
            }
        }, (error) => {
            log(`❌ Subscription Error: ${error}`);
        });

        // Give it a moment to establish listener
        await sleep(2000);

        // 3. Join Room
        log("\n3️⃣ Second player joining Room...");
        await joinRoom(roomId, joinerProfile);
        log("✅ Join action completed (waiting for update via listener...)");

        await sleep(2000);

        // 4. Update Game State (Simulate starting game logic partially)
        log("\n4️⃣ Updating Game State...");
        const mockGameState = createBaseGameState({
            gameId: roomId,
            players: [
                { id: hostProfile.uid, name: hostProfile.displayName, hand: [], handSize: 7, wins: 0, mancheWins: 0, totalPoints: 0, isCochon: false, isBot: false, currentMancheStars: 0, totalRoundWins: 0, totalCochons: 0 } as any,
                { id: joinerProfile.uid, name: joinerProfile.displayName, hand: [], handSize: 7, wins: 0, mancheWins: 0, totalPoints: 0, isCochon: false, isBot: false, currentMancheStars: 0, totalRoundWins: 0, totalCochons: 0 } as any
            ],
            currentPlayerId: hostProfile.uid,
            firstPlayerOfRound: hostProfile.uid
        });

        // Note: The 'startGame' function in firebase.ts is essentially an updateGameState with status change.
        // We will call updateGameState directly as requested to test it, or better yet, we can use startGame provided by service if we want strictly that.
        // But the plan said "Update Game State". Let's use updateGameState to verifying generic updates.

        await updateGameState(roomId, mockGameState);
        log("✅ Game State update sent");

        await sleep(3000);

        log("\n✅ Verification Finished Successfully!");

        // Cleanup
        unsubscribe();
        log("Disconnected listener.");
        process.exit(0);

    } catch (error) {
        log(`\n❌ Verification Failed: ${error}`);
        process.exit(1);
    }
}

runVerification();
