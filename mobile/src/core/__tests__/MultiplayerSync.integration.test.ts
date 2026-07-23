jest.unmock('firebase/firestore');
jest.unmock('firebase/app');
jest.unmock('firebase/auth');
jest.unmock('firebase/storage');
jest.unmock('../services/firebase');

global.XMLHttpRequest = require('xhr2');



import { initializeTestEnvironment, RulesTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
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

    it('Scenario 3: coordinated rooms reject client state replacement but allow presence', async () => {
        const memberDb = testEnv.authenticatedContext('user_guest').firestore();
        const roomRef = doc(memberDb, 'rooms', 'ROOM_COORDINATED');
        const gameState = {
            phase: 'PLAYING',
            turnId: 1,
            currentPlayerId: 'user_host',
            players: [
                { id: 'user_host', status: 'HUMAN', hand: [] },
                { id: 'user_guest', status: 'HUMAN', hand: [] },
            ],
        };

        await testEnv.withSecurityRulesDisabled(async context => {
            await setDoc(doc(context.firestore(), 'rooms', 'ROOM_COORDINATED'), {
                roomId: 'ROOM_COORDINATED',
                status: 'PLAYING',
                coordinatorVersion: 1,
                createdBy: 'user_host',
                playerIds: ['user_host', 'user_guest'],
                gameState,
            });
        });

        await assertFails(updateDoc(roomRef, {
            gameState: { ...gameState, turnId: 2, currentPlayerId: 'user_guest' },
        }));
        await assertFails(updateDoc(roomRef, { 'gameState.turnId': 2 }));
        await assertFails(updateDoc(roomRef, {
            'gameState.players': [
                { ...gameState.players[0], status: 'SURRENDERED' },
                gameState.players[1],
            ],
        }));
        await assertSucceeds(updateDoc(roomRef, {
            'gameState.players': [
                gameState.players[0],
                { ...gameState.players[1], status: 'DISCONNECTED' },
            ],
        }));
        await assertSucceeds(updateDoc(roomRef, { 'heartbeats.user_guest': Date.now() }));
    });

    it('Scenario 4: the creator can still start a coordinated rematch from the lobby', async () => {
        const hostDb = testEnv.authenticatedContext('user_host').firestore();
        const guestDb = testEnv.authenticatedContext('user_guest').firestore();
        const roomRef = doc(hostDb, 'rooms', 'ROOM_REMATCH');

        await testEnv.withSecurityRulesDisabled(async context => {
            await setDoc(doc(context.firestore(), 'rooms', 'ROOM_REMATCH'), {
                roomId: 'ROOM_REMATCH',
                status: 'WAITING',
                coordinatorVersion: 1,
                createdBy: 'user_host',
                playerIds: ['user_host', 'user_guest'],
                gameState: null,
            });
        });

        await assertFails(updateDoc(doc(guestDb, 'rooms', 'ROOM_REMATCH'), {
            status: 'PLAYING',
            gameState: { phase: 'PLAYING', turnId: 1, players: [] },
        }));
        await assertSucceeds(updateDoc(roomRef, {
            status: 'PLAYING',
            gameState: { phase: 'PLAYING', turnId: 1, players: [] },
        }));
    });
});
