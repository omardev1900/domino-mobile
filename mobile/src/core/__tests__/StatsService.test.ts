/**
 * StatsService.test.ts
 *
 * Tests unitaires pour stats.service.ts — focus sur totalCochonsSubis :
 *   1. Incrément depuis mancheLeaguePointsEarned (source principale)
 *   2. Fallback sur leaguePointsEarned pour anciens enregistrements
 *   3. Comportement de syncWithFirebase (Math.max local vs remote)
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

// ─── Import après mocks ───────────────────────────────────────────────────────

import { statsService } from '../services/stats.service';
import { getDoc, setDoc } from 'firebase/firestore';

const mockSetItem = jest.fn().mockResolvedValue(undefined);
const mockGetItem = jest.fn().mockResolvedValue(null);
const mockRemoveItem = jest.fn().mockResolvedValue(undefined);

jest.mock('@react-native-async-storage/async-storage', () => ({
    setItem: (...args: any[]) => mockSetItem(...args),
    getItem: (...args: any[]) => mockGetItem(...args),
    removeItem: (...args: any[]) => mockRemoveItem(...args),
}));

jest.mock('firebase/firestore', () => ({
    doc: jest.fn(),
    getDoc: jest.fn(),
    setDoc: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/firebase', () => ({ 
    db: {},
    auth: { currentUser: { displayName: 'TestUser', photoURL: 'test.jpg' } } 
}));

jest.mock('../services/economy.service', () => ({
    economyService: { getEconomy: jest.fn().mockResolvedValue({ activeFrame: null }), setEconomy: jest.fn() },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE_OPPONENTS = [{ name: 'Bot1', avatarId: 'avatar_default' }];

const recordWin = (overrides: {
    cochons?: number;
    points?: number;
    leaguePointsEarned?: number;
    mancheLeaguePointsEarned?: number[];
} = {}) =>
    statsService.recordMatchResult({
        result: 'WIN',
        cochons: overrides.cochons ?? 0,
        points: overrides.points ?? 5,
        leaguePointsEarned: overrides.leaguePointsEarned,
        mancheLeaguePointsEarned: overrides.mancheLeaguePointsEarned,
        opponents: BASE_OPPONENTS,
        mode: 'MANCHE',
    });

const recordLoss = (overrides: {
    leaguePointsEarned?: number;
    mancheLeaguePointsEarned?: number[];
} = {}) =>
    statsService.recordMatchResult({
        result: 'LOSS',
        cochons: 0,
        points: -1,
        leaguePointsEarned: overrides.leaguePointsEarned,
        mancheLeaguePointsEarned: overrides.mancheLeaguePointsEarned,
        opponents: BASE_OPPONENTS,
        mode: 'MANCHE',
    });

// ─── Reset service entre tests ────────────────────────────────────────────────

beforeEach(() => {
    // Forcer le service à repartir d'un état vierge
    (statsService as any).cachedStats = null;
    (statsService as any).storageScope = 'guest';
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockClear();
    mockGetItem.mockClear();
    mockRemoveItem.mockClear();
    jest.clearAllMocks();
});

// ─── Suite 1 : incrément depuis mancheLeaguePointsEarned ─────────────────────

describe('totalCochonsSubis — mancheLeaguePointsEarned (source principale)', () => {

    it('une manche à -1 dans mancheLeaguePointsEarned incrémente de 1', async () => {
        await recordLoss({ mancheLeaguePointsEarned: [-1] });
        const stats = await statsService.getStats();
        expect(stats.totalCochonsSubis).toBe(1);
    });

    it('deux manches à -1 dans un seul match incrémentent de 2', async () => {
        await recordLoss({ mancheLeaguePointsEarned: [-1, 4, -1] });
        const stats = await statsService.getStats();
        expect(stats.totalCochonsSubis).toBe(2);
    });

    it('un match sans -1 n\'incrémente pas totalCochonsSubis', async () => {
        await recordWin({ mancheLeaguePointsEarned: [5] });
        const stats = await statsService.getStats();
        expect(stats.totalCochonsSubis).toBe(0);
    });

    it('accumulation sur plusieurs matchs', async () => {
        await recordLoss({ mancheLeaguePointsEarned: [-1] });
        await recordLoss({ mancheLeaguePointsEarned: [-1, -1] });
        await recordWin({ mancheLeaguePointsEarned: [4] });
        const stats = await statsService.getStats();
        expect(stats.totalCochonsSubis).toBe(3);
        expect(stats.totalLeague4Pts).toBe(1);
        expect(stats.totalLeagueMinus1Pt).toBe(3);
    });

    it('mancheLeaguePointsEarned vide ([]) ne compte aucun cochon subi', async () => {
        await recordLoss({ mancheLeaguePointsEarned: [] });
        const stats = await statsService.getStats();
        expect(stats.totalCochonsSubis).toBe(0);
    });
});

describe('cumulative league breakdown counters', () => {
    it('increments 5/4/2/1/-1 counters from mancheLeaguePointsEarned', async () => {
        await recordWin({ mancheLeaguePointsEarned: [5, 2, 1] });
        await recordLoss({ mancheLeaguePointsEarned: [-1, 4] });

        const stats = await statsService.getStats();
        expect(stats.totalLeague5Pts).toBe(1);
        expect(stats.totalLeague4Pts).toBe(1);
        expect(stats.totalLeague2Pts).toBe(1);
        expect(stats.totalLeague1Pt).toBe(1);
        expect(stats.totalLeagueMinus1Pt).toBe(1);
    });
});

// ─── Suite 2 : fallback leaguePointsEarned (anciens enregistrements) ─────────

describe('totalCochonsSubis — fallback leaguePointsEarned (legacy)', () => {

    it('leaguePointsEarned === -1 sans mancheLeaguePointsEarned incrémente de 1', async () => {
        await recordLoss({ leaguePointsEarned: -1 });
        const stats = await statsService.getStats();
        expect(stats.totalCochonsSubis).toBe(1);
    });

    it('leaguePointsEarned > 0 sans mancheLeaguePointsEarned n\'incrémente pas', async () => {
        await recordWin({ leaguePointsEarned: 5 });
        const stats = await statsService.getStats();
        expect(stats.totalCochonsSubis).toBe(0);
    });

    it('mancheLeaguePointsEarned prend la priorité sur leaguePointsEarned', async () => {
        // mancheLeaguePointsEarned=[4] → 0 cochon subi, même si leaguePointsEarned=-1
        await recordWin({
            mancheLeaguePointsEarned: [4],
            leaguePointsEarned: -1,
        });
        const stats = await statsService.getStats();
        expect(stats.totalCochonsSubis).toBe(0);
    });

    it('ni mancheLeaguePointsEarned ni leaguePointsEarned → totalCochonsSubis reste 0', async () => {
        await statsService.recordMatchResult({
            result: 'LOSS',
            cochons: 0,
            points: 1,
            opponents: BASE_OPPONENTS,
            mode: 'MANCHE',
        });
        const stats = await statsService.getStats();
        expect(stats.totalCochonsSubis).toBe(0);
    });
});

// ─── Suite 3 : syncWithFirebase — Pull-only ──────────────────────────────────

describe('syncWithFirebase — Pull-only', () => {

    it('télécharge la valeur remote même si elle est inférieure', async () => {
        (statsService as any).cachedStats = {
            gamesPlayed: 10,
            gamesWon: 5,
            totalCochonsSubis: 12,
        };

        (getDoc as jest.Mock).mockResolvedValueOnce({
            exists: () => true,
            data: () => ({
                stats: {
                    gamesPlayed: 8,
                    gamesWon: 3,
                    totalCochonsSubis: 4, // Remote est plus bas
                },
            }),
        });

        await statsService.syncWithFirebase('uid-test');

        const stats = await statsService.getStats();
        expect(stats.totalCochonsSubis).toBe(4);
    });

    it('totalCochonsSubis remote absent → utilise 0 (Pull-only strict)', async () => {
        (statsService as any).cachedStats = {
            totalCochonsSubis: 5,
        };

        (getDoc as jest.Mock).mockResolvedValueOnce({
            exists: () => true,
            data: () => ({
                stats: {
                    gamesPlayed: 3,
                    // totalCochonsSubis absent
                },
            }),
        });

        await statsService.syncWithFirebase('uid-test');

        const stats = await statsService.getStats();
        expect(stats.totalCochonsSubis).toBe(0);
    });

    it('pushStatsToFirebase écrit totalCochonsSubis dans Firestore', async () => {
        const fakeStats: any = {
            gamesPlayed: 3,
            gamesWon: 1,
            totalRoundsWon: 2,
            totalCochonsInflicted: 4,
            totalCochonsSubis: 6,
            totalPointsAccumulated: 15,
            matchHistory: [],
            coins: 0, xp: 0, level: 1, diamonds: 0,
            leaguePoints: 0, leagueGrade: 'APPRENTI_1', inventory: {},
        };

        (setDoc as jest.Mock).mockClear();
        await statsService.pushStatsToFirebase('uid-test', fakeStats);

        expect(setDoc).toHaveBeenCalledWith(
            undefined, // doc() est mocké, retourne undefined
            expect.objectContaining({
                stats: expect.objectContaining({ totalCochonsSubis: 6 }),
            }),
            { merge: true }
        );
    });
});

describe('storage scoping per user', () => {
    it('nettoie la cle AsyncStorage lors de useStorageScope pour un utilisateur authentifie', async () => {
        await statsService.useStorageScope('uid-a');
        expect(mockRemoveItem).toHaveBeenCalledWith('@player_stats:uid-a');
    });

    it('lit depuis Firestore pour un utilisateur authentifie et ne touche pas a AsyncStorage', async () => {
        (getDoc as jest.Mock).mockResolvedValueOnce({
            exists: () => true,
            data: () => ({
                stats: {
                    gamesPlayed: 12,
                    gamesWon: 6,
                },
            }),
        });

        await statsService.useStorageScope('uid-a');
        const stats = await statsService.getStats();

        expect(stats.gamesPlayed).toBe(12);
        expect(mockGetItem).not.toHaveBeenCalled();
    });

    it('ne persiste pas dans AsyncStorage pour un utilisateur authentifie lors de recordMatchResult', async () => {
        await statsService.useStorageScope('uid-a');
        
        // Mock getDoc to return some stats
        (getDoc as jest.Mock).mockResolvedValue({
            exists: () => true,
            data: () => ({ stats: {} }),
        });

        await statsService.recordMatchResult({
            result: 'WIN',
            cochons: 1,
            points: 4,
            opponents: BASE_OPPONENTS,
            mode: 'MANCHE',
            userId: 'uid-a',
        });

        expect(mockSetItem).not.toHaveBeenCalled();
    });
});
