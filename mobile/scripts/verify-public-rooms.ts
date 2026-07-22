
import { createRoom, listenToPublicRooms } from '../src/core/services/firebase';
import { PlayerProfile } from '../src/core/types';

// Polyfill for Node environment
const fs = require('fs');
const path = require('path');
const logFile = path.join(__dirname, 'verify-public-log.txt');

function log(message: string) {
    console.log(message);
    fs.appendFileSync(logFile, message + '\n');
}

// Clear log file
if (fs.existsSync(logFile)) {
    fs.unlinkSync(logFile);
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runPublicRoomsVerification() {
    log("🚀 Starting Public Rooms Verification...");

    const hostProfile: PlayerProfile = {
        uid: "host-public-" + Date.now(),
        displayName: "Host Public",
        gamesPlayed: 0,
        gamesWon: 0
    };

    const hostPrivateProfile: PlayerProfile = {
        uid: "host-private-" + Date.now(),
        displayName: "Host Private",
        gamesPlayed: 0,
        gamesWon: 0
    };

    try {
        // 1. Setup Listener
        log("\n1️⃣ Setting up Public Room Listener...");
        let publicRoomsCount = 0;
        let lastRoomList: any[] = [];

        const unsubscribe = listenToPublicRooms((rooms) => {
            log(`🔔 Public Rooms Update: Found ${rooms.length} rooms`);
            lastRoomList = rooms;
            publicRoomsCount = rooms.length;
        }, (error) => {
            log(`❌ Listener Error: ${error}`);
        });

        await sleep(2000); // Wait for initial sync
        const initialCount = publicRoomsCount;
        log(`   Initial count: ${initialCount}`);

        // 2. Create Public Room
        log("\n2️⃣ Creating PUBLIC Room...");
        // createRoom(profile, isPrivate=false, roomName)
        const roomName = "Test Room " + Date.now();
        const publicRoomId = await createRoom(hostProfile, false, roomName);
        log(`✅ Public Room created: ${publicRoomId} with name: ${roomName}`);

        await sleep(3000); // Wait for sync

        // Verify count increased
        if (publicRoomsCount > initialCount) {
            log(`✅ SUCCESS: Public room list updated. Count: ${publicRoomsCount}`);
            const found = lastRoomList.find(r => r.roomId === publicRoomId);
            if (found) {
                log(`   -> Found specific room ${publicRoomId}`);
                if (found.roomName === roomName) {
                    log(`   -> Room Name Verified: ${found.roomName}`);
                } else {
                    log(`   ❌ FAILED: Room Name mismatch. Expected ${roomName}, got ${found.roomName}`);
                }
            }
            else log(`   ❌ FAILED: Did not find room ${publicRoomId} in list`);
        } else {
            log(`❌ FAILED: Public room list did not update.`);
        }

        const countAfterPublic = publicRoomsCount;

        // 3. Create Private Room
        log("\n3️⃣ Creating PRIVATE Room...");
        // createRoom(profile, isPrivate=true)
        const privateRoomId = await createRoom(hostPrivateProfile, true);
        log(`🔒 Private Room created: ${privateRoomId}`);

        await sleep(3000); // Wait for sync

        // Verify count did NOT increase
        if (publicRoomsCount === countAfterPublic) {
            log(`✅ SUCCESS: Public room list count remained same (${publicRoomsCount}).`);
            const foundPrivate = lastRoomList.find(r => r.roomId === privateRoomId);
            if (!foundPrivate) log(`   -> Private room ${privateRoomId} is correctly HIDDEN.`);
            else log(`   ❌ FAILED: Private room ${privateRoomId} WAS FOUND in public list.`);
        } else {
            log(`❌ FAILED: Public room list updated unexpectedly. Count: ${publicRoomsCount}`);
        }

        // Cleanup
        unsubscribe();
        log("\n✅ Verification Test Logic Complete.");
        process.exit(0);

    } catch (error) {
        log(`\n❌ Verification Failed: ${error}`);
        process.exit(1);
    }
}

runPublicRoomsVerification();
