/**
 * leaderboard.service.ts
 *
 * Service Firebase pour récupérer les classements des joueurs.
/**
 * leaderboard.service.ts
 *
 * Service Firebase pour récupérer les classements des joueurs.
 * Gère la récupération du "Top XP" (Mapipi/Gran-Moun) et "Top Coins" (Richesse).
 *
 * v2 — Utilise onSnapshot() pour des mises à jour en temps réel.
 *       Expose getPlayerRank() pour afficher la position d'un joueur hors Top 50.
 */

import {
    collection,
    query,
    orderBy,
    limit,
    onSnapshot,
    where,
    getCountFromServer,
    Unsubscribe,
    doc,
    setDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { LeagueGrade } from '../economy.types';
import { getStartOfCurrentMonthUtc, getYearMonthUtcString } from './leaderboard.time';
import { LogService } from './LogService';

export type ClassementCategory = 'PLUS_COCHONS' | 'MOINS_COCHONS' | 'PLUS_POINTS';

export interface LeaderboardEntry {
    uid: string;
    displayName: string;
    avatarId: string;
    activeFrame?: string;
    xp: number;
    coins: number;
    level: number;
    leagueGrade: LeagueGrade | null;
    leaguePoints: number;
    /** Cochons réellement infligés (source de vérité pour le grade) */
    cochonsGiven: number;
    /** Cochons infligés depuis le 1er du mois en cours (calculé depuis matchHistory) */
    cochonsGivenThisMonth: number;
    /** Cochons subis (manches à -1) — reconstitué depuis mancheLeaguePointsEarned, fallback leaguePointsEarned */
    totalCochonsSubis: number;
    /** Points cumulés sur toute la carrière */
    totalPointsAccumulated: number;
    /** Nombre total de matchs joués (départage en cas d'égalité) */
    gamesPlayed: number;
    /** Nombre de matchs joués depuis le début du mois en cours */
    gamesPlayedThisMonth: number;
    /** Cochons subis depuis le début du mois en cours */
    totalCochonsSubisThisMonth: number;
    /** Points cumulés depuis le début du mois en cours */
    totalPointsAccumulatedThisMonth: number;
    rank: number;
}

export type LeaderboardCategory = 'XP' | 'COINS' | 'COCHONS';

/** Champ Firestore correspondant à chaque catégorie */
const CATEGORY_FIELD: Record<LeaderboardCategory, string> = {
    XP: 'economy.xp',
    COINS: 'economy.coins',
    COCHONS: 'stats.totalCochonsInflicted',
};

class LeaderboardService {
    private mapUserToEntry(docId: string, data: any, rank: number, startOfMonth: number): LeaderboardEntry | null {
        const economy = data.economy || {};
        const stats = data.stats || {};

        if (economy.xp === undefined || economy.coins === undefined) {
            return null;
        }

        const cochonsGiven = stats.totalCochonsInflicted || economy.cochonsGiven || 0;
        const matchHistory: {
            timestamp?: number;
            cochons?: number;
            score?: number;
            leaguePointsEarned?: number;
            mancheLeaguePointsEarned?: number[];
        }[] = stats.matchHistory || [];

        const monthlyHistory = matchHistory.filter(m => (m.timestamp ?? 0) >= startOfMonth);
        const cochonsGivenThisMonth = monthlyHistory.reduce((sum, m) => sum + (m.cochons ?? 0), 0);
        const totalPointsAccumulatedThisMonth = monthlyHistory.reduce((sum, m) => sum + (m.score ?? 0), 0);
        const totalCochonsSubisThisMonth = monthlyHistory.reduce((sum, m) => {
            const mancheResults = m.mancheLeaguePointsEarned?.length
                ? m.mancheLeaguePointsEarned
                : (typeof m.leaguePointsEarned === 'number' ? [m.leaguePointsEarned] : []);
            return sum + mancheResults.filter(v => v === -1).length;
        }, 0);

        // totalCochonsSubis : champ direct si présent (profils récents),
        // sinon recompute depuis matchHistory (compatibilité profils anciens)
        const totalCochonsSubis = stats.totalCochonsSubis != null
            ? stats.totalCochonsSubis
            : matchHistory.reduce((sum: number, m: { mancheLeaguePointsEarned?: number[]; leaguePointsEarned?: number }) => {
                const mancheResults = m.mancheLeaguePointsEarned?.length
                    ? m.mancheLeaguePointsEarned
                    : (typeof m.leaguePointsEarned === 'number' ? [m.leaguePointsEarned] : []);
                return sum + mancheResults.filter((v: number) => v === -1).length;
            }, 0);

        return {
            uid: docId,
            displayName: data.displayName || data.email?.split('@')[0] || 'Joueur',
            avatarId: data.avatarId || data.avatarUrl || 'avatar_default',
            activeFrame: economy.activeFrame || null,
            xp: economy.xp || 0,
            coins: economy.coins || 0,
            level: economy.level || 1,
            leagueGrade: economy.leagueGrade || null,
            leaguePoints: economy.leaguePoints || 0,
            cochonsGiven,
            cochonsGivenThisMonth,
            totalCochonsSubis,
            totalPointsAccumulated: stats.totalPointsAccumulated || 0,
            gamesPlayed: stats.gamesPlayed || 0,
            gamesPlayedThisMonth: monthlyHistory.length,
            totalCochonsSubisThisMonth,
            totalPointsAccumulatedThisMonth,
            rank,
        };
    }

    /**
     * S'abonne en temps réel au classement de la catégorie donnée.
     * Appelle `callback` à chaque mise à jour de Firestore.
     * Retourne une fonction `unsubscribe` à appeler lors du démontage.
     *
     * @param category   - 'XP' | 'COINS' | 'COCHONS'
     * @param limitCount - Nombre de joueurs à récupérer (défaut: 50)
     * @param callback   - Fonction appelée avec les entrées mises à jour
     */
    subscribeLeaderboard(
        category: LeaderboardCategory,
        limitCount: number = 50,
        callback: (entries: LeaderboardEntry[]) => void
    ): Unsubscribe {
        const field = CATEGORY_FIELD[category];
        const usersRef = collection(db, 'users');
        const q = query(usersRef, orderBy(field, 'desc'), limit(limitCount));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const leaderboard: LeaderboardEntry[] = [];
            let currentRank = 1;

            // Début du mois en cours en UTC (timestamp canonique partagé entre clients)
            const startOfMonth = getStartOfCurrentMonthUtc();

            snapshot.forEach((doc) => {
                const entry = this.mapUserToEntry(doc.id, doc.data(), currentRank, startOfMonth);
                if (entry) {
                    leaderboard.push(entry);
                    currentRank += 1;
                }
            });

            callback(leaderboard);
        }, (error) => {
            LogService.error('LeaderboardService', 'onSnapshot error:', error);
            callback([]);
        });

        return unsubscribe;
    }

    /**
     * Calcule et enregistre les agrégats mensuels d'un joueur dans users_monthly_stats.
     */
    async updateMonthlyStats(
        uid: string,
        stats: { matchHistory: any[] },
        profileData?: { displayName?: string; avatarId?: string; activeFrame?: string | null }
    ): Promise<void> {
        if (uid.startsWith('guest_')) return;

        try {
            const startOfMonth = getStartOfCurrentMonthUtc();
            const yearMonth = getYearMonthUtcString();

            const matchHistory = stats.matchHistory || [];
            const monthlyHistory = matchHistory.filter(m => (m.timestamp ?? 0) >= startOfMonth);

            const cochonsGiven = monthlyHistory.reduce((sum, m) => sum + (m.cochons ?? 0), 0);
            const pointsAccumulated = monthlyHistory.reduce((sum, m) => sum + (m.score ?? 0), 0);
            const cochonsSubis = monthlyHistory.reduce((sum, m) => {
                const mancheResults = m.mancheLeaguePointsEarned?.length
                    ? m.mancheLeaguePointsEarned
                    : (typeof m.leaguePointsEarned === 'number' ? [m.leaguePointsEarned] : []);
                return sum + mancheResults.filter((v: number) => v === -1).length;
            }, 0);
            const gamesPlayed = monthlyHistory.length;

            const docId = `${uid}_${yearMonth}`;
            const monthlyRef = doc(db, 'users_monthly_stats', docId);

            const updateData: any = {
                userId: uid,
                yearMonth,
                cochonsGiven,
                cochonsSubis,
                pointsAccumulated,
                gamesPlayed,
                updatedAt: Date.now(),
            };

            if (profileData) {
                if (profileData.displayName) updateData.displayName = profileData.displayName;
                if (profileData.avatarId) updateData.avatarId = profileData.avatarId;
                if (profileData.activeFrame !== undefined) updateData.activeFrame = profileData.activeFrame;
            }

            await setDoc(monthlyRef, updateData, { merge: true });
            LogService.info('LeaderboardService', `Monthly stats updated for ${uid} on month ${yearMonth}`);
        } catch (error) {
            LogService.error('LeaderboardService', 'updateMonthlyStats error:', error);
        }
    }

    /**
     * S'abonne aux 100 meilleurs classements mensuels pour le mois courant.
     */
    subscribeLeagueClassementMonthly(
        category: ClassementCategory,
        callback: (entries: LeaderboardEntry[]) => void
    ): Unsubscribe {
        const yearMonth = getYearMonthUtcString();
        const monthlyRef = collection(db, 'users_monthly_stats');

        let q;
        if (category === 'PLUS_COCHONS') {
            q = query(
                monthlyRef,
                where('yearMonth', '==', yearMonth),
                orderBy('cochonsGiven', 'desc'),
                limit(100)
            );
        } else if (category === 'MOINS_COCHONS') {
            // Pour éviter les joueurs inactifs (0 match), on récupère les plus actifs du mois et trie côté client
            q = query(
                monthlyRef,
                where('yearMonth', '==', yearMonth),
                orderBy('gamesPlayed', 'desc'),
                limit(100)
            );
        } else {
            q = query(
                monthlyRef,
                where('yearMonth', '==', yearMonth),
                orderBy('pointsAccumulated', 'desc'),
                limit(100)
            );
        }

        return onSnapshot(q, (snapshot) => {
            const entries: LeaderboardEntry[] = [];
            let currentRank = 1;

            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                entries.push({
                    uid: data.userId,
                    displayName: data.displayName || 'Joueur',
                    avatarId: data.avatarId || 'avatar_default',
                    activeFrame: data.activeFrame || null,
                    xp: 0,
                    coins: 0,
                    level: 1,
                    leagueGrade: null,
                    leaguePoints: 0,
                    cochonsGiven: data.cochonsGiven || 0,
                    cochonsGivenThisMonth: data.cochonsGiven || 0,
                    totalCochonsSubis: data.cochonsSubis || 0,
                    totalCochonsSubisThisMonth: data.cochonsSubis || 0,
                    totalPointsAccumulated: data.pointsAccumulated || 0,
                    totalPointsAccumulatedThisMonth: data.pointsAccumulated || 0,
                    gamesPlayed: data.gamesPlayed || 0,
                    gamesPlayedThisMonth: data.gamesPlayed || 0,
                    rank: currentRank++,
                });
            });

            callback(entries);
        }, (error) => {
            LogService.error('LeaderboardService', 'subscribeLeagueClassementMonthly error:', error);
            callback([]);
        });
    }

    /**
     * S'abonne aux 100 meilleurs classements globaux de tous les temps.
     */
    subscribeLeagueClassementGlobal(
        category: ClassementCategory,
        callback: (entries: LeaderboardEntry[]) => void
    ): Unsubscribe {
        const usersRef = collection(db, 'users');

        let q;
        if (category === 'PLUS_COCHONS') {
            // economy.cochonsGiven est présent sur tous les profils (champ source de la Ligue)
            q = query(
                usersRef,
                orderBy('economy.cochonsGiven', 'desc'),
                limit(100)
            );
        } else if (category === 'MOINS_COCHONS') {
            // Tri par gamesPlayed desc pour avoir les joueurs actifs (proxy anti-inactifs)
            // Le tri final cochonsSubis ASC est fait côté client dans LeagueHubView
            q = query(
                usersRef,
                orderBy('stats.gamesPlayed', 'desc'),
                limit(100)
            );
        } else {
            q = query(
                usersRef,
                orderBy('stats.totalPointsAccumulated', 'desc'),
                limit(100)
            );
        }

        return onSnapshot(q, (snapshot) => {
            const entries: LeaderboardEntry[] = [];
            const startOfMonth = getStartOfCurrentMonthUtc();
            let currentRank = 1;

            snapshot.forEach((docSnap) => {
                const entry = this.mapUserToEntry(docSnap.id, docSnap.data(), currentRank++, startOfMonth);
                if (entry) {
                    entries.push(entry);
                }
            });

            callback(entries);
        }, (error) => {
            LogService.error('LeaderboardService', 'subscribeLeagueClassementGlobal error:', error);
            callback([]);
        });
    }

    /**
     * Retourne le rang approximatif d'un joueur pour une catégorie donnée.
     * Compte le nombre de joueurs ayant un score strictement supérieur au sien,
     * puis ajoute 1 pour obtenir sa position.
     *
     * Retourne `null` si le joueur n'a pas de données Firebase (invité).
     */
    async getPlayerRank(
        uid: string,
        category: LeaderboardCategory,
        playerScore: number
    ): Promise<number | null> {
        if (uid.startsWith('guest_')) return null;

        try {
            const field = CATEGORY_FIELD[category];
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where(field, '>', playerScore));
            const snapshot = await getCountFromServer(q);
            return snapshot.data().count + 1;
        } catch (error) {
            LogService.error('LeaderboardService', 'getPlayerRank error:', error);
            return null;
        }
    }
}

export const leaderboardService = new LeaderboardService();
