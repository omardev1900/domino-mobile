import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { PlayerInventory } from '../store.types';
import { DEFAULT_INVENTORY } from '../store.constants';
import { economyService } from './economy.service';
import { LogService } from './LogService';
import { leaderboardService } from './leaderboard.service';

const STORAGE_KEY_PLAYER_STATS = '@player_stats';
const GUEST_STORAGE_SCOPE = 'guest';

export interface MatchRecord {
    id: string;
    timestamp: number;
    result: 'WIN' | 'LOSS' | 'DRAW';
    score: number;
    cochons: number;
    opponents: { name: string; avatarId: string }[];
    mode: string;
    roundsWon?: number;       // Manches gagnées dans le match
    leaguePointsEarned?: number; // Points Ligue du match : 5 / 4 / 2 / 1 / -1
    mancheLeaguePointsEarned?: number[]; // Résultats de chaque manche : 5 / 4 / 2 / 1 / -1
}

export interface PlayerStats {
    gamesPlayed: number;
    gamesWon: number;
    totalCochonsInflicted: number;
    totalCochonsSubis: number; // Manches où le joueur a pris -1 (cochon reçu)
    totalPointsAccumulated: number;
    totalRoundsWon: number;
    totalLeague5Pts: number;
    totalLeague4Pts: number;
    totalLeague2Pts: number;
    totalLeague1Pt: number;
    totalLeagueMinus1Pt: number;
    matchHistory: MatchRecord[];
    // ─── Economy & Progression ───
    coins: number;
    xp: number;
    level: number;
    diamonds: number;
    leaguePoints: number;
    leagueGrade: string | null;
    inventory: PlayerInventory;
}

const DEFAULT_STATS: PlayerStats = {
    gamesPlayed: 0,
    gamesWon: 0,
    totalRoundsWon: 0,
    totalCochonsInflicted: 0,
    totalCochonsSubis: 0,
    totalPointsAccumulated: 0,
    totalLeague5Pts: 0,
    totalLeague4Pts: 0,
    totalLeague2Pts: 0,
    totalLeague1Pt: 0,
    totalLeagueMinus1Pt: 0,
    matchHistory: [],
    // Economy defaults
    coins: 0,
    xp: 0,
    level: 1,
    diamonds: 0,
    leaguePoints: 0,
    leagueGrade: null,
    inventory: DEFAULT_INVENTORY,
};

class StatsService {
    private cachedStats: PlayerStats | null = null;
    private storageScope = GUEST_STORAGE_SCOPE;

    private get storageKey(): string {
        return `${STORAGE_KEY_PLAYER_STATS}:${this.storageScope}`;
    }

    async useStorageScope(uid?: string | null): Promise<void> {
        const nextScope = uid && !uid.startsWith('guest_') ? uid : GUEST_STORAGE_SCOPE;
        if (this.storageScope !== nextScope) {
            this.storageScope = nextScope;
            this.cachedStats = null;
        }

        // Si l'utilisateur est authentifié, on nettoie son AsyncStorage pour cette clé
        if (uid && !uid.startsWith('guest_')) {
            const keyToRemove = `${STORAGE_KEY_PLAYER_STATS}:${uid}`;
            try {
                await AsyncStorage.removeItem(keyToRemove);
            } catch (error) {
                LogService.error('StatsService', 'Failed to remove stats from AsyncStorage', error);
            }
        }
    }

    private getBreakdownFromHistory(history: MatchRecord[] = []) {
        return history.reduce(
            (acc, match) => {
                const mancheResults = match.mancheLeaguePointsEarned?.length
                    ? match.mancheLeaguePointsEarned
                    : (typeof match.leaguePointsEarned === 'number' ? [match.leaguePointsEarned] : []);

                for (const pts of mancheResults) {
                    if (pts === 5) acc.totalLeague5Pts += 1;
                    else if (pts === 4) acc.totalLeague4Pts += 1;
                    else if (pts === 2) acc.totalLeague2Pts += 1;
                    else if (pts === 1) acc.totalLeague1Pt += 1;
                    else if (pts === -1) acc.totalLeagueMinus1Pt += 1;
                }

                return acc;
            },
            {
                totalLeague5Pts: 0,
                totalLeague4Pts: 0,
                totalLeague2Pts: 0,
                totalLeague1Pt: 0,
                totalLeagueMinus1Pt: 0,
            }
        );
    }

    /**
     * Load stats from Firestore (authenticated) or AsyncStorage (guest)
     */
    async getStats(): Promise<PlayerStats> {
        if (this.cachedStats) return { ...this.cachedStats };

        // For authenticated users, read directly from Firestore instead of AsyncStorage
        if (this.storageScope !== GUEST_STORAGE_SCOPE) {
            try {
                const userRef = doc(db, 'users', this.storageScope);
                const userSnap = await getDoc(userRef);
                
                if (!userSnap.exists() || !userSnap.data().stats) {
                    this.cachedStats = { ...DEFAULT_STATS };
                    return { ...this.cachedStats };
                }
                
                const remoteData = userSnap.data().stats;
                const history = remoteData.matchHistory ?? [];
                const historyBreakdown = this.getBreakdownFromHistory(history);
                this.cachedStats = {
                    gamesPlayed: remoteData.gamesPlayed ?? 0,
                    gamesWon: remoteData.gamesWon ?? 0,
                    totalRoundsWon: remoteData.totalRoundsWon ?? 0,
                    totalCochonsInflicted: remoteData.totalCochonsInflicted ?? 0,
                    totalCochonsSubis: remoteData.totalCochonsSubis ?? 0,
                    totalPointsAccumulated: remoteData.totalPointsAccumulated ?? 0,
                    totalLeague5Pts: remoteData.totalLeague5Pts ?? historyBreakdown.totalLeague5Pts,
                    totalLeague4Pts: remoteData.totalLeague4Pts ?? historyBreakdown.totalLeague4Pts,
                    totalLeague2Pts: remoteData.totalLeague2Pts ?? historyBreakdown.totalLeague2Pts,
                    totalLeague1Pt: remoteData.totalLeague1Pt ?? historyBreakdown.totalLeague1Pt,
                    totalLeagueMinus1Pt: remoteData.totalLeagueMinus1Pt ?? historyBreakdown.totalLeagueMinus1Pt,
                    matchHistory: history,
                    coins: remoteData.coins ?? 0,
                    xp: remoteData.xp ?? 0,
                    level: remoteData.level ?? 1,
                    diamonds: remoteData.diamonds ?? 0,
                    leaguePoints: remoteData.leaguePoints ?? 0,
                    leagueGrade: remoteData.leagueGrade || null,
                    inventory: remoteData.inventory || DEFAULT_INVENTORY,
                };
                
                return { ...this.cachedStats };

            } catch (error) {
                LogService.error('StatsService', 'Failed to get secure stats from Firebase', error);
                throw error; // On bloque au lieu d'utiliser des zéros par défaut uniquement si c'est une vraie erreur (ex: réseau)
            }
        }

        // Fallback for guests (read from AsyncStorage)
        try {
            const json = await AsyncStorage.getItem(this.storageKey);
            if (json) {
                const parsed = JSON.parse(json);
                const history = parsed.matchHistory ?? [];
                const historyBreakdown = this.getBreakdownFromHistory(history);
                this.cachedStats = {
                    gamesPlayed: parsed.gamesPlayed ?? 0,
                    gamesWon: parsed.gamesWon ?? 0,
                    totalRoundsWon: parsed.totalRoundsWon ?? 0,
                    totalCochonsInflicted: parsed.totalCochonsInflicted ?? 0,
                    totalCochonsSubis: parsed.totalCochonsSubis ?? 0,
                    totalPointsAccumulated: parsed.totalPointsAccumulated ?? 0,
                    totalLeague5Pts: parsed.totalLeague5Pts ?? historyBreakdown.totalLeague5Pts,
                    totalLeague4Pts: parsed.totalLeague4Pts ?? historyBreakdown.totalLeague4Pts,
                    totalLeague2Pts: parsed.totalLeague2Pts ?? historyBreakdown.totalLeague2Pts,
                    totalLeague1Pt: parsed.totalLeague1Pt ?? historyBreakdown.totalLeague1Pt,
                    totalLeagueMinus1Pt: parsed.totalLeagueMinus1Pt ?? historyBreakdown.totalLeagueMinus1Pt,
                    matchHistory: history,
                    // Economy fields — fallback to 0/defaults for old persisted data
                    coins: parsed.coins ?? 0,
                    xp: parsed.xp ?? 0,
                    level: parsed.level ?? 1,
                    diamonds: parsed.diamonds ?? 0,
                    leaguePoints: parsed.leaguePoints ?? 0,
                    leagueGrade: parsed.leagueGrade ?? null,
                    inventory: parsed.inventory ?? DEFAULT_INVENTORY,
                };
            } else {
                this.cachedStats = { ...DEFAULT_STATS };
            }
        } catch (error) {
            LogService.error('StatsService', 'Failed to load stats from AsyncStorage', error);
            this.cachedStats = { ...DEFAULT_STATS };
        }

        return { ...this.cachedStats };
    }

    /**
     * Save stats to AsyncStorage
     */
    private async persistStats(): Promise<void> {
        if (!this.cachedStats) return;
        // No-op for authenticated users to avoid saving stats locally in AsyncStorage
        if (this.storageScope !== GUEST_STORAGE_SCOPE) return;

        try {
            await AsyncStorage.setItem(this.storageKey, JSON.stringify(this.cachedStats));
        } catch (error) {
            LogService.error('StatsService', 'Failed to save stats to AsyncStorage', error);
        }
    }

    /**
     * Record the result of a completed match.
     */
    async recordMatchResult(params: {
        result: 'WIN' | 'LOSS' | 'DRAW';
        cochons: number;
        points: number;
        roundsWon?: number;
        leaguePointsEarned?: number; // -1 / 1 / 2 / 4 / 5 pts ligue
        mancheLeaguePointsEarned?: number[];
        opponents: { name: string; avatarId: string }[];
        mode: string;
        userId?: string; // Optional: sync immediately if provided
    }): Promise<void> {
        const stats = await this.getStats();
        const { result, cochons, points, roundsWon = 0, leaguePointsEarned, mancheLeaguePointsEarned, opponents, mode, userId } = params;

        stats.gamesPlayed += 1;
        if (result === 'WIN') stats.gamesWon += 1;
        stats.totalRoundsWon += roundsWon;
        stats.totalCochonsInflicted += cochons;
        stats.totalPointsAccumulated += points;

        // Cochons subis : compter les -1 dans mancheLeaguePointsEarned, fallback sur leaguePointsEarned
        const cochonsSubisCeMatch = mancheLeaguePointsEarned?.length
            ? mancheLeaguePointsEarned.filter(v => v === -1).length
            : (leaguePointsEarned === -1 ? 1 : 0);
        stats.totalCochonsSubis = (stats.totalCochonsSubis ?? 0) + cochonsSubisCeMatch;

        const mancheResults = mancheLeaguePointsEarned?.length
            ? mancheLeaguePointsEarned
            : (typeof leaguePointsEarned === 'number' ? [leaguePointsEarned] : []);
        for (const pts of mancheResults) {
            if (pts === 5) stats.totalLeague5Pts += 1;
            else if (pts === 4) stats.totalLeague4Pts += 1;
            else if (pts === 2) stats.totalLeague2Pts += 1;
            else if (pts === 1) stats.totalLeague1Pt += 1;
            else if (pts === -1) stats.totalLeagueMinus1Pt += 1;
        }

        // Add to history (keep last 500)
        const newRecord: MatchRecord = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            result,
            score: points,
            cochons: cochons,
            roundsWon,
            leaguePointsEarned,
            mancheLeaguePointsEarned,
            opponents,
            mode
        };

        stats.matchHistory = [newRecord, ...stats.matchHistory].slice(0, 500);

        this.cachedStats = stats;
        await this.persistStats();

        LogService.info('StatsService', 'Stats updated with history', stats);

        // ✅ FIX [2026-04-15]: Removed leaguePoints override here.
        // Previously, this was setting leaguePoints = stats.totalCochonsInflicted (local AsyncStorage value),
        // which would OVERWRITE the Firebase value with a local counter that resets on reinstall.
        // leaguePoints are now managed EXCLUSIVELY by RewardEngine via processServerReward() in GameScreen.
        // This prevents race conditions and ensures Firebase remains the single source of truth.

        // If logged in, sync to Firebase
        if (userId && !userId.startsWith('guest_')) {
            await this.pushStatsToFirebase(userId, stats);
        }
    }

    /**
     * Pushes current stats to Firestore
     */
    async pushStatsToFirebase(uid: string, stats: PlayerStats): Promise<void> {
        if (uid.startsWith('guest_')) return;

        try {
            const userRef = doc(db, 'users', uid);
            // Use setDoc with merge to handle both new and existing documents
            await setDoc(userRef, {
                stats: {
                    gamesPlayed: stats.gamesPlayed,
                    gamesWon: stats.gamesWon,
                    totalRoundsWon: stats.totalRoundsWon,
                    totalCochonsInflicted: stats.totalCochonsInflicted,
                    totalCochonsSubis: stats.totalCochonsSubis ?? 0,
                    totalPointsAccumulated: stats.totalPointsAccumulated,
                    totalLeague5Pts: stats.totalLeague5Pts ?? 0,
                    totalLeague4Pts: stats.totalLeague4Pts ?? 0,
                    totalLeague2Pts: stats.totalLeague2Pts ?? 0,
                    totalLeague1Pt: stats.totalLeague1Pt ?? 0,
                    totalLeagueMinus1Pt: stats.totalLeagueMinus1Pt ?? 0,
                    matchHistory: stats.matchHistory,
                    // Economy fields
                    coins: stats.coins,
                    xp: stats.xp,
                    level: stats.level,
                    diamonds: stats.diamonds,
                    leaguePoints: stats.leaguePoints,
                    leagueGrade: stats.leagueGrade,
                    lastSync: Date.now()
                }
            }, { merge: true });
            LogService.info('StatsService', 'Stats synced to Firebase');

            // Propagate to monthly stats
            const displayName = auth.currentUser?.displayName || undefined;
            const avatarId = auth.currentUser?.photoURL || undefined;
            let activeFrame: string | null | undefined = undefined;
            try {
                const eco = await economyService.getEconomy();
                activeFrame = eco.activeFrame;
            } catch (e) {
                LogService.error('StatsService', 'Failed to retrieve economy for activeFrame', e);
            }

            await leaderboardService.updateMonthlyStats(uid, stats, {
                displayName,
                avatarId,
                activeFrame,
            });
        } catch (error) {
            LogService.error('StatsService', 'Failed to push stats to Firebase', error);
        }
    }

    /**
     * TÉLÉCHARGE les statistiques depuis Firebase (Pull-only).
     * Le serveur est la source de vérité absolue.
     */
    async syncWithFirebase(uid: string): Promise<void> {
        if (uid.startsWith('guest_')) return;

        try {
            const userRef = doc(db, 'users', uid);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists() || !userSnap.data().stats) {
                // Le compte existe mais l'objet stats est vide (ou le doc n'existe pas encore).
                // On charge les valeurs par défaut EN MÉMOIRE uniquement. On ne push RIEN.
                this.cachedStats = { ...DEFAULT_STATS };
                await this.persistStats();
                LogService.info('StatsService', 'Stats introuvables sur le serveur, utilisation des valeurs par défaut en mémoire.');
                return;
            }

            const remoteData = userSnap.data().stats;
            const history = remoteData.matchHistory || [];
            const historyBreakdown = this.getBreakdownFromHistory(history);

            const downloadedStats: PlayerStats = {
                gamesPlayed: remoteData.gamesPlayed ?? 0,
                gamesWon: remoteData.gamesWon ?? 0,
                totalRoundsWon: remoteData.totalRoundsWon ?? 0,
                totalCochonsInflicted: remoteData.totalCochonsInflicted ?? 0,
                totalCochonsSubis: remoteData.totalCochonsSubis ?? 0,
                totalPointsAccumulated: remoteData.totalPointsAccumulated ?? 0,
                totalLeague5Pts: remoteData.totalLeague5Pts ?? historyBreakdown.totalLeague5Pts,
                totalLeague4Pts: remoteData.totalLeague4Pts ?? historyBreakdown.totalLeague4Pts,
                totalLeague2Pts: remoteData.totalLeague2Pts ?? historyBreakdown.totalLeague2Pts,
                totalLeague1Pt: remoteData.totalLeague1Pt ?? historyBreakdown.totalLeague1Pt,
                totalLeagueMinus1Pt: remoteData.totalLeagueMinus1Pt ?? historyBreakdown.totalLeagueMinus1Pt,
                matchHistory: history,
                coins: remoteData.coins ?? 0,
                xp: remoteData.xp ?? 0,
                level: remoteData.level ?? 1,
                diamonds: remoteData.diamonds ?? 0,
                leaguePoints: remoteData.leaguePoints ?? 0,
                leagueGrade: remoteData.leagueGrade || null,
                inventory: remoteData.inventory || DEFAULT_INVENTORY,
            };

            this.cachedStats = downloadedStats;
            await this.persistStats();
            LogService.info('StatsService', 'Stats téléchargées avec succès depuis Firebase (Pull-only).');

        } catch (error) {
            LogService.error('StatsService', 'Échec de syncWithFirebase (Pull-only)', error);
            throw error; // On propage l'erreur pour bloquer la connexion uniquement si c'est une vraie erreur réseau
        }
    }

    /**
     * Helper to merge match histories and remove duplicates by ID
     */
    private mergeMatchHistories(local: MatchRecord[], remote: MatchRecord[]): MatchRecord[] {
        const combined = [...local, ...remote];
        const seen = new Set();
        return combined
            .filter(item => {
                const duplicate = seen.has(item.id);
                seen.add(item.id);
                return !duplicate;
            })
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 500);
    }

    /**
     * Reset all stats (for debug/testing)
     */
    async resetStats(): Promise<void> {
        this.cachedStats = { ...DEFAULT_STATS };
        await this.persistStats();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Inventory Updates
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Updates the player's inventory (owned items and equipped cosmetics).
     */
    async updateInventory(newInventory: PlayerInventory, uid?: string): Promise<void> {
        if (!this.cachedStats) return;

        this.cachedStats.inventory = newInventory;
        await this.persistStats();

        if (uid && !uid.startsWith('guest_')) {
            try {
                const userRef = doc(db, 'users', uid);
                // We merge only the stats.inventory field
                await setDoc(userRef, { stats: { inventory: newInventory } }, { merge: true });
                LogService.info('StatsService', 'Inventory synced to Firebase.');
            } catch (error) {
                LogService.error('StatsService', 'Failed to sync inventory to Firebase', error);
            }
        }
    }
}

export const statsService = new StatsService();
