jest.unmock('firebase/firestore');
jest.unmock('firebase/app');
jest.unmock('firebase/auth');
jest.unmock('firebase/storage');
jest.unmock('../services/firebase');

global.XMLHttpRequest = require('xhr2');



import { initializeTestEnvironment, RulesTestEnvironment, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

jest.setTimeout(30000); // 30 seconds for all tests in this file

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
    // Note: This requires the Firestore emulator to be running on port 8081
    testEnv = await initializeTestEnvironment({
        projectId: 'domino-martinique-v1',
        firestore: {
            host: '127.0.0.1',
            port: 8081,
            rules: fs.readFileSync(path.resolve(__dirname, '../../../../firestore.rules'), 'utf8'),
        },
    });
}, 30000);

beforeEach(async () => {
    if (testEnv) {
        await testEnv.clearFirestore();
    }
});

afterAll(async () => {
    if (testEnv) {
        await testEnv.cleanup();
    }
});

describe('Multiplayer Synchronization (Firestore Emulator)', () => {

    it('Scenario 1: Creates a room, players join, state transitions to PLAYING', async () => {
        const hostContext = testEnv.authenticatedContext('user_host');
        const guestContext = testEnv.authenticatedContext('user_guest');

        const hostDb = hostContext.firestore();
        const guestDb = guestContext.firestore();

        // 1. Host creates a WAITING room
        await assertSucceeds(setDoc(doc(hostDb, 'rooms', 'ROOM_TEST'), {
            roomId: 'ROOM_TEST',
            status: 'WAITING',
            hostId: 'user_host',
            playerIds: ['user_host'],
            gameState: null
        }));

        // 2. Guest joins the room
        await assertSucceeds(updateDoc(doc(guestDb, 'rooms', 'ROOM_TEST'), {
            playerIds: ['user_host', 'user_guest']
        }));

        // 3. Host starts the game (Transitions to PLAYING and sets gameState)
        const initialGameState = {
            phase: 'PLAYING',
            turnId: 1,
            mancheNumber: 1,
            roundNumber: 1,
            players: []
        };

        await assertSucceeds(updateDoc(doc(hostDb, 'rooms', 'ROOM_TEST'), {
            status: 'PLAYING',
            gameState: initialGameState
        }));

        const snap = await getDoc(doc(guestDb, 'rooms', 'ROOM_TEST'));
        const data = snap.data();
        expect(data?.status).toBe('PLAYING');
        expect(data?.gameState.phase).toBe('PLAYING');
    });

    it('Scenario 2: State changes sync properly via onSnapshot', async () => {
        const hostContext = testEnv.authenticatedContext('user_host');
        const guestContext = testEnv.authenticatedContext('user_guest');

        const hostDb = hostContext.firestore();
        const guestDb = guestContext.firestore();

        // Initialize a playing room
        await setDoc(doc(hostDb, 'rooms', 'ROOM_SYNC'), {
            roomId: 'ROOM_SYNC',
            status: 'PLAYING',
            hostId: 'user_host',
            playerIds: ['user_host', 'user_guest'],
            gameState: {
                phase: 'PLAYING',
                turnId: 1
            }
        });

        // Set up listener for guest
        let snapshotData: any = null;
        const unsubscribe = onSnapshot(doc(guestDb, 'rooms', 'ROOM_SYNC'), (snap) => {
            snapshotData = snap.data();
        });

        // Wait for the initial snapshot
        let attempts = 0;
        while (!snapshotData && attempts < 20) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        expect(snapshotData?.gameState?.turnId).toBe(1);

        // Host plays a turn
        await updateDoc(doc(hostDb, 'rooms', 'ROOM_SYNC'), {
            'gameState.turnId': 2,
            'gameState.lastActionTimestamp': Date.now()
        });

        // Wait for snapshot sync
        attempts = 0;
        while (snapshotData?.gameState?.turnId !== 2 && attempts < 20) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        expect(snapshotData?.gameState?.turnId).toBe(2);

        unsubscribe();
    });
});
