/**
 * economy.service.ts
 *
 * ╔══════════════════════════════════════════════════════╗
 * ║  ECONOMY SERVICE — Persistance & Application        ║
 * ║  • Lit/écrit le solde économique du joueur          ║
 * ║  • AsyncStorage (tous joueurs, incl. invités)       ║
 * ║  • Firestore (joueurs authentifiés uniquement)      ║
 * ║  • Applique un MatchReward sur le profil            ║
 * ║  • NE contient AUCUNE logique de calcul             ║
 * ╚══════════════════════════════════════════════════════╝
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth, db } from './firebase';
import { LogService } from './LogService';
import { PlayerEconomy, MatchReward, LeagueGrade, RewardCalculationInput, LeagueFrameId } from '../economy.types';
import { NEW_PLAYER_COINS, DAILY_REWARD_COINS, AD_REWARD_COINS } from '../economy.constants';
import { getLevelFromXP, getLeagueGrade } from '../RewardEngine';

/** Infos de profil minimales nécessaires pour les écrire dans Firestore avec l'économie */
export interface EconomyProfileInfo {
    displayName: string;
    avatarId: string;
}

const STORAGE_KEY_ECONOMY = '@player_economy';
const GUEST_STORAGE_SCOPE = 'guest';
const LOCAL_WEB_FUNCTIONS_HOSTNAMES = new Set(['localhost', '127.0.0.1']);

// ─── Valeur par défaut pour nouveau joueur ───────────────────────────────────

const DEFAULT_ECONOMY: PlayerEconomy = {
    coins: NEW_PLAYER_COINS, // 🪙 Cadeau de bienvenue
    xp: 0,
    level: 1,
    diamonds: 0,
    leaguePoints: 0,
    leagueGrade: null,
    // ─── Ligue des Cochons ───
    // [TECH-DEBT-COCHONS] cochonsGiven n'est plus défini par défaut côté local —
    // Firestore reste source de vérité, le listener met la valeur à jour à chaque snapshot
    cochonsGiven: 0,
    unlockedFrames: [],
    activeFrame: null,
    welcomeGiftClaimed: false,
};

// ─────────────────────────────────────────────────────────────────────────────

class EconomyService {
    private cached: PlayerEconomy | null = null;
    private storageScope = GUEST_STORAGE_SCOPE;
    /** Nombre d'écritures Firestore en cours. Empêche le listener onSnapshot
     *  d'écraser le cache local avec des données périmées. */
    private pendingWrites = 0;

    private get storageKey(): string {
        return `${STORAGE_KEY_ECONOMY}:${this.storageScope}`;
    }

    async useStorageScope(uid?: string | null): Promise<void> {
        const nextScope = uid && !uid.startsWith('guest_') ? uid : GUEST_STORAGE_SCOPE;
        if (this.storageScope === nextScope) return;
        this.storageScope = nextScope;
        this.cached = null;
    }

    private shouldUseWebLocalRewardHttpFallback(): boolean {
        if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
        return LOCAL_WEB_FUNCTIONS_HOSTNAMES.has(window.location.hostname);
    }

    private async callProcessMatchRewardHttp(input: RewardCalculationInput): Promise<MatchReward> {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            throw new Error('Utilisateur non authentifie pour le fallback HTTP processMatchReward.');
        }

        const idToken = await currentUser.getIdToken();
        const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
        if (!projectId) {
            throw new Error('EXPO_PUBLIC_FIREBASE_PROJECT_ID manquant pour le fallback HTTP processMatchReward.');
        }

        const response = await fetch(
            `https://us-central1-${projectId}.cloudfunctions.net/processMatchRewardHttp`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${idToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ input }),
            }
        );

        const payload = await response.json().catch(() => null);
        if (!response.ok) {
            throw new Error(payload?.message ?? `HTTP ${response.status} processMatchRewardHttp`);
        }

        return payload?.result as MatchReward;
    }

    /**
     * Appelle processMatchRewardHttp et applique le reward localement (cache + persistLocal).
     * Utilisé à la fois en chemin principal (Web local) et en fallback.
     */
    private async callAndApplyHttpReward(
        input: RewardCalculationInput,
        userId?: string,
        profile?: EconomyProfileInfo
    ): Promise<MatchReward> {
        LogService.info('EconomyService', '[HTTP] Appel direct processMatchRewardHttp (Web local)...');
        const reward = await this.callProcessMatchRewardHttp(input);

        // La CF a déjà écrit en Firestore. On aligne le cache local sur le reward
        // reçu pour que l'UI affiche immédiatement les bonnes valeurs.
        const current = await this.getEconomy();
        const updated: PlayerEconomy = {
            coins: current.coins + reward.coinsEarned,
            xp: reward.newXP,
            level: reward.newLevel,
            diamonds: current.diamonds + reward.diamondsEarned,
            leaguePoints: reward.newLeaguePoints,
            leagueGrade: reward.newGrade,
            cochonsGiven: reward.newCochonsGiven,
            unlockedFrames: [
                ...new Set([
                    ...(current.unlockedFrames ?? []),
                    ...reward.newlyUnlockedFrames.map(e => e.frameId),
                ])
            ] as LeagueFrameId[],
            activeFrame: current.activeFrame ?? null,
            lastDailyRewardTimestamp: current.lastDailyRewardTimestamp,
        };
        this.cached = updated;
        await this.persistLocal();

        if (userId && profile) {
            await this.syncProfileMetadata(userId, profile.displayName, profile.avatarId);
        }

        LogService.info('EconomyService', '[HTTP] Reward appliqué localement avec succès.');
        return reward;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Lecture
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Retourne l'économie courante du joueur.
     * Priorité : 1. Cache mémoire, 2. AsyncStorage, 3. Défaut (nouveau joueur)
     */
    async getEconomy(): Promise<PlayerEconomy> {
        if (this.cached) return { ...this.cached };

        try {
            const json = await AsyncStorage.getItem(this.storageKey);
            if (json) {
                const parsed = JSON.parse(json);
                // Migration : s'assurer que tous les champs sont présents
                this.cached = this.mergeWithDefaults(parsed);
            } else {
                // Nouveau joueur → cadeau de bienvenue
                this.cached = { ...DEFAULT_ECONOMY };
                await this.persistLocal();
                LogService.info('EconomyService', 'New player: welcome bonus applied.');
            }
        } catch (e) {
            LogService.error('EconomyService', 'getEconomy error:', e);
            this.cached = { ...DEFAULT_ECONOMY };
        }

        return { ...this.cached! };
    }

    /**
     * TÉLÉCHARGE l'économie depuis Firebase (Pull-only).
     * Lève une erreur si le profil n'est pas accessible.
     * Le serveur est la source de vérité absolue.
     */
    async syncFromFirebase(uid: string): Promise<void> {
        if (uid.startsWith('guest_')) return;

        try {
            const userRef = doc(db, 'users', uid);
            const snap = await getDoc(userRef);

            if (!snap.exists()) {
                throw new Error("Document utilisateur introuvable dans Firestore (Economy).");
            }

            const data = snap.data();
            let remoteEconomy = data.economy as Partial<PlayerEconomy> | undefined;
            const remoteStats = data.stats as any; 

            // MIGRATION EN MÉMOIRE POUR LES COMPTES LEGACY
            if (!remoteEconomy && remoteStats) {
                LogService.info('EconomyService', 'Legacy account detected. Migrating economy from stats in memory.');
                remoteEconomy = {
                    coins: typeof remoteStats.coins === 'number' ? remoteStats.coins : DEFAULT_ECONOMY.coins,
                    xp: typeof remoteStats.xp === 'number' ? remoteStats.xp : DEFAULT_ECONOMY.xp,
                    level: typeof remoteStats.level === 'number' ? remoteStats.level : DEFAULT_ECONOMY.level,
                    diamonds: typeof remoteStats.diamonds === 'number' ? remoteStats.diamonds : DEFAULT_ECONOMY.diamonds,
                    leaguePoints: typeof remoteStats.leaguePoints === 'number' ? remoteStats.leaguePoints : DEFAULT_ECONOMY.leaguePoints,
                    leagueGrade: remoteStats.leagueGrade !== undefined ? remoteStats.leagueGrade : DEFAULT_ECONOMY.leagueGrade,
                    cochonsGiven: typeof remoteStats.totalCochonsInflicted === 'number' ? remoteStats.totalCochonsInflicted : DEFAULT_ECONOMY.cochonsGiven,
                    unlockedFrames: remoteStats.unlockedFrames || DEFAULT_ECONOMY.unlockedFrames,
                    activeFrame: remoteStats.activeFrame !== undefined ? remoteStats.activeFrame : DEFAULT_ECONOMY.activeFrame,
                };
            }

            if (!remoteEconomy) {
                 LogService.info('EconomyService', 'No economy or stats found, initializing with defaults.');
                 remoteEconomy = {};
            }

            // MIGRATION WELCOME GIFT
            // Si le document distant n'a pas le flag, c'est un compte legacy (ils ont déjà eu les 500 coins à la création)
            if (remoteEconomy.welcomeGiftClaimed === undefined && (remoteStats || Object.keys(remoteEconomy).length > 0)) {
                remoteEconomy.welcomeGiftClaimed = true;
            }

            // On télécharge et fusionne intelligemment (on garde le timestamp local s'il est plus récent)
            const localEconomy = await this.getEconomy();
            const downloadedEconomy = this.mergeEconomies(localEconomy, remoteEconomy);

            // 🛡️ MIGRATION / RESTAURATION COCHONS [2026-04-15]
            if (remoteStats && typeof remoteStats.totalCochonsInflicted === 'number') {
                const statsCochons = remoteStats.totalCochonsInflicted;
                const economyCochons = downloadedEconomy.cochonsGiven ?? 0;
                if (statsCochons > economyCochons) {
                    LogService.info('EconomyService',
                        `[R3-B10] Migration cochons en mémoire: ${economyCochons} → ${statsCochons}`
                    );
                    downloadedEconomy.cochonsGiven = statsCochons;
                }
            }

            // 🛡️ BUG-WELCOME-COINS : Protection race condition nouveau joueur.
            // Si Firestore répond avant la propagation complète de pushToFirebase (signUp),
            // remote.coins peut valoir 0 ou undefined, ce qui écraserait le cadeau de bienvenue.
            // On vérifie le flag posé par signUp et on restaure/re-pousse si nécessaire.
            try {
                const protectedCoinsRaw = await AsyncStorage.getItem('@new_player_coins_protected');
                if (protectedCoinsRaw !== null) {
                    const protectedCoins = parseInt(protectedCoinsRaw, 10);
                    if (!isNaN(protectedCoins) && (downloadedEconomy.coins ?? 0) < protectedCoins) {
                        LogService.warn(
                            'EconomyService',
                            `[BUG-WELCOME-COINS] Race condition détectée : Firestore coins=${downloadedEconomy.coins} < protégé=${protectedCoins}. Restauration des coins de bienvenue.`
                        );
                        downloadedEconomy.coins = protectedCoins;
                        // Re-pousse la valeur correcte sur Firestore pour corriger la propagation
                        await this.pushToFirebase(uid, downloadedEconomy);
                    }
                    // Flag consommé — le supprimer dans tous les cas
                    await AsyncStorage.removeItem('@new_player_coins_protected');
                    LogService.info('EconomyService', '[BUG-WELCOME-COINS] Flag de protection consommé.');
                }
            } catch (flagError) {
                LogService.warn('EconomyService', '[BUG-WELCOME-COINS] Impossible de lire/supprimer le flag de protection.', flagError);
            }

            this.cached = downloadedEconomy;
            await this.persistLocal();
            // PLUS AUCUN PUSH. La DB est reine, on met à jour le client uniquement.
            LogService.info('EconomyService', 'Economy downloaded from Firebase (Pull-only).');

        } catch (e) {
            LogService.error('EconomyService', 'syncFromFirebase error:', e);
            throw e; // Lève l'erreur pour que l'AuthService puisse bloquer la connexion
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Application des Récompenses
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Applique un `MatchReward` calculé par le `RewardEngine` sur le profil du joueur.
     * Persiste en local (tous joueurs) et Firebase (joueurs authentifiés).
     *
     * @param reward  - Le résultat calculé par RewardEngine.calculate()
     * @param userId  - UID du joueur (pour Firebase sync)
     * @returns       - Le nouvel état économique complet
     */
    async applyReward(reward: MatchReward, userId?: string, profile?: EconomyProfileInfo): Promise<PlayerEconomy> {
        const current = await this.getEconomy();

        const updated: PlayerEconomy = {
            coins: current.coins + reward.coinsEarned,
            xp: reward.newXP,
            level: reward.newLevel,
            diamonds: current.diamonds + reward.diamondsEarned,
            leaguePoints: reward.newLeaguePoints,
            leagueGrade: reward.newGrade,
            // ─── Ligue des Cochons ───
            cochonsGiven: reward.newCochonsGiven,
            unlockedFrames: [
                ...new Set([
                    ...(current.unlockedFrames ?? []),
                    ...reward.newlyUnlockedFrames.map(e => e.frameId),
                ])
            ] as LeagueFrameId[],
            activeFrame: current.activeFrame ?? null,
            lastDailyRewardTimestamp: current.lastDailyRewardTimestamp,
        };

        this.cached = updated;
        await this.persistLocal();

        LogService.debug('EconomyService', 'Reward applied locally:', { coinsAdded: reward.coinsEarned, newCoins: updated.coins });

        // Sync Firebase pour les joueurs authentifiés (Fallback)
        if (userId && !userId.startsWith('guest_')) {
            await this.pushToFirebase(userId, updated, profile);
        }

        return { ...updated };
    }

    /**
     * Appelle le Serveur (Cloud Functions) pour générer la récompense de façon sécurisée.
     */
    async processServerReward(input: RewardCalculationInput, userId?: string, profile?: EconomyProfileInfo): Promise<MatchReward> {
        if (!userId || userId.startsWith('guest_')) {
            // Mode hors-ligne ou invité : on exécute en local
            LogService.info('EconomyService', 'Invité ou mode Solo: Calcul des récompenses en local.');
            const { RewardEngine } = require('../RewardEngine');
            const reward = RewardEngine.calculate(input);
            await this.applyReward(reward, userId, profile);
            return reward;
        }

        // Court-circuit Web local : l'onCall Firebase bloque les origines http://localhost
        // On appelle directement processMatchRewardHttp qui gère CORS correctement.
        if (this.shouldUseWebLocalRewardHttpFallback()) {
            return this.callAndApplyHttpReward(input, userId, profile);
        }

        try {
            LogService.info('EconomyService', 'Appel du Banquier Serveur pour le calcul de récompense...');
            const functions = getFunctions();
            const processMatchRewardHook = httpsCallable<{ input: Partial<RewardCalculationInput> }, MatchReward>(functions, 'processMatchReward');

            const result = await processMatchRewardHook({ input });
            const reward = result.data;

            LogService.info('EconomyService', 'Réponse sécurisée du serveur :', reward);

            // Mise à jour de l'UI localement sans forcer un push Firebase qui écraserait la DB
            const current = await this.getEconomy();
            const updated: PlayerEconomy = {
                coins: current.coins + reward.coinsEarned,
                xp: reward.newXP,
                level: reward.newLevel,
                diamonds: current.diamonds + reward.diamondsEarned,
                leaguePoints: reward.newLeaguePoints,
                leagueGrade: reward.newGrade,
                // ─── Ligue des Cochons ───
                cochonsGiven: reward.newCochonsGiven,
                unlockedFrames: [
                    ...new Set([
                        ...(current.unlockedFrames ?? []),
                        ...reward.newlyUnlockedFrames.map(e => e.frameId),
                    ])
                ] as LeagueFrameId[],
                activeFrame: current.activeFrame ?? null,
                lastDailyRewardTimestamp: current.lastDailyRewardTimestamp,
            };
            this.cached = updated;
            await this.persistLocal(); // On sauvegarde juste dans le AsyncStorage pour l'application fluide

            // Sécurise la cohérence Firestore côté client après un calcul serveur réussi.
            // Si la Cloud Function n'écrit pas (ou pas complètement) economy.xp / economy.coins,
            // le leaderboard lirait des valeurs obsolètes.
            if (userId && !userId.startsWith('guest_')) {
                await this.pushToFirebase(userId, updated, profile);
            }

            return reward;

        } catch (e) {
            LogService.warn('EconomyService', 'Erreur avec le Banquier Serveur, tentative de fallback :', e);

            if (this.shouldUseWebLocalRewardHttpFallback()) {
                try {
                    LogService.warn('EconomyService', '[FALLBACK] Retry via processMatchRewardHttp...');
                    return await this.callAndApplyHttpReward(input, userId, profile);
                } catch (httpFallbackError) {
                    LogService.error(
                        'EconomyService',
                        'Echec du fallback HTTP local processMatchReward, retour au calcul local :',
                        httpFallbackError
                    );
                }
            }


            const { RewardEngine } = require('../RewardEngine');
            const reward = RewardEngine.calculate(input);
            await this.applyReward(reward, userId, profile);
            return reward;
        }
    }


    /**
     * Déduit le buy-in avant le début d'une partie.
     * Retourne `false` si le joueur n'a pas assez de coins.
     */
    async deductBuyIn(buyIn: number, userId?: string, profile?: EconomyProfileInfo): Promise<boolean> {
        const current = await this.getEconomy();

        if (current.coins < buyIn) {
            LogService.warn('EconomyService', `Not enough coins. Have: ${current.coins}, Need: ${buyIn}`);
            return false;
        }

        const updated: PlayerEconomy = { ...current, coins: current.coins - buyIn };
        this.cached = updated;
        await this.persistLocal();

        if (userId && !userId.startsWith('guest_')) {
            await this.pushToFirebase(userId, updated, profile);
        }

        LogService.debug('EconomyService', `Buy-in of ${buyIn} coins deducted. Remaining: ${updated.coins}`);
        return true;
    }

    // ─── Cadeau Quotidien & Bienvenue ─────────────────────────────────────────

    /**
     * Vérifie si le joueur a déjà réclamé son cadeau de bienvenue (nouveau joueur).
     */
    async hasClaimedWelcomeGift(): Promise<boolean> {
        const eco = await this.getEconomy();
        return eco.welcomeGiftClaimed ?? false;
    }

    /**
     * Marque le cadeau de bienvenue comme réclamé.
     */
    async claimWelcomeGift(): Promise<void> {
        const eco = await this.getEconomy();
        if (eco.welcomeGiftClaimed) {
            LogService.warn('EconomyService', 'Welcome gift already claimed');
            return;
        }

        // Le montant (NEW_PLAYER_COINS) est déjà dans l'économie par défaut.
        // On ne fait que mettre à jour le flag.
        this.cached = {
            ...eco,
            welcomeGiftClaimed: true
        };
        await this.persistLocal();
        await this.pushToFirebase(auth.currentUser?.uid || 'guest_temp', this.cached);
        LogService.info('EconomyService', 'Welcome gift marked as claimed');
    }

    /**
     * Vérifie si le joueur peut réclamer sa récompense quotidienne sans la créditer.
     * @returns true si la récompense est disponible (24h écoulées ou jamais réclamée)
     */
    async isDailyRewardAvailable(): Promise<boolean> {
        const current = await this.getEconomy();
        if (!current.lastDailyRewardTimestamp) return true;
        const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
        return (Date.now() - current.lastDailyRewardTimestamp) >= TWENTY_FOUR_HOURS_MS;
    }

    /**
     * Équipe un cadre pour le joueur.
     * Met à jour localement et sur Firebase si authentifié.
     */
    async equipLeagueFrame(userId: string, frameId: LeagueFrameId | null): Promise<void> {
        const current = await this.getEconomy();
        
        // Vérification de sécurité (bien que l'UI empêche de cliquer)
        if (frameId && !(current.unlockedFrames || []).includes(frameId)) {
            LogService.warn('EconomyService', `Tentative d'équipement d'un cadre non débloqué: ${frameId}`);
            return;
        }

        const updated: PlayerEconomy = { ...current, activeFrame: frameId };
        this.cached = updated;
        await this.persistLocal();

        if (userId && !userId.startsWith('guest_')) {
            await this.pushToFirebase(userId, updated);

            // Propagate active frame to monthly leaderboard document
            try {
                const { statsService } = require('./stats.service');
                const { leaderboardService } = require('./leaderboard.service');
                const stats = await statsService.getStats();
                await leaderboardService.updateMonthlyStats(userId, stats, { activeFrame: frameId });
            } catch (err) {
                LogService.error('EconomyService', 'Failed to propagate frame to monthly stats', err);
            }
        }

        LogService.debug('EconomyService', `Cadre équipé avec succès : ${frameId}`);
    }

    /**
     * Vérifie si le joueur peut réclamer sa récompense quotidienne (200 coins).
     * @returns Le montant gagné ou null si déjà réclamé dans les 24h.
     */
    async checkAndClaimDailyReward(userId?: string, profile?: EconomyProfileInfo, dynamicAmount?: number): Promise<number | null> {
        const current = await this.getEconomy();
        const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

        const shouldReward = !current.lastDailyRewardTimestamp ||
            (Date.now() - current.lastDailyRewardTimestamp) >= TWENTY_FOUR_HOURS_MS;

        if (shouldReward) {
            const rewardAmount = dynamicAmount ?? DAILY_REWARD_COINS;

            const updated: PlayerEconomy = {
                ...current,
                coins: current.coins + rewardAmount,
                lastDailyRewardTimestamp: Date.now()
            };

            this.cached = updated;
            await this.persistLocal();

            if (userId && !userId.startsWith('guest_')) {
                await this.pushToFirebase(userId, updated, profile);
            }

            LogService.info('EconomyService', `Daily reward of ${rewardAmount} coins claimed!`);
            return rewardAmount;
        }

        return null;
    }

    /**
     * [R3-B9] Crédite la récompense quotidienne directement, sans re-vérifier les 24h.
     * À appeler UNIQUEMENT après confirmation que isDailyRewardAvailable() === true.
     * Evite la race condition entre l'affichage du modal et le clic sur "Réclamer".
     */
    async claimDailyRewardNow(userId?: string, profile?: EconomyProfileInfo, dynamicAmount?: number): Promise<number> {
        const current = await this.getEconomy();
        const rewardAmount = dynamicAmount ?? DAILY_REWARD_COINS;

        const updated: PlayerEconomy = {
            ...current,
            coins: current.coins + rewardAmount,
            lastDailyRewardTimestamp: Date.now(),
        };

        this.cached = updated;
        await this.persistLocal();

        if (userId && !userId.startsWith('guest_')) {
            await this.pushToFirebase(userId, updated, profile);
        }

        LogService.info('EconomyService', `[R3-B9] Daily reward of ${rewardAmount} coins claimed (force).`);
        return rewardAmount;
    }

    /**
     * [ADS-REWARD] Crédite le gain fixe post-match après visionnage volontaire d'une pub.
     * Montant fixe : AD_REWARD_COINS (100 coins).
     * Ne passe PAS par la Cloud Function — montant non critique, non manipulable via le jeu.
     * À appeler UNE seule fois par match (la guard est gérée côté UI via l'état adWatched).
     */
    async creditAdReward(userId?: string, profile?: EconomyProfileInfo, dynamicAmount?: number): Promise<number> {
        const current = await this.getEconomy();
        const rewardAmount = dynamicAmount ?? AD_REWARD_COINS;

        const updated: PlayerEconomy = {
            ...current,
            coins: current.coins + rewardAmount,
        };

        this.cached = updated;
        await this.persistLocal();

        if (userId && !userId.startsWith('guest_')) {
            await this.pushToFirebase(userId, updated, profile);
        }

        LogService.info('EconomyService', `[ADS-REWARD] +${rewardAmount} coins credited after ad view.`);
        return rewardAmount;
    }

    /**
     * [STORE-AD] Crédite la récompense après visionnage d'une pub dans la boutique.
     * Montant fixe : 100 coins. Met à jour le timestamp de cooldown.
     */
    async claimStoreAdReward(userId?: string, profile?: EconomyProfileInfo): Promise<number> {
        const current = await this.getEconomy();
        const rewardAmount = 100;

        const updated: PlayerEconomy = {
            ...current,
            coins: current.coins + rewardAmount,
            lastStoreAdTimestamp: Date.now(),
        };

        this.cached = updated;
        await this.persistLocal();

        if (userId && !userId.startsWith('guest_')) {
            await this.pushToFirebase(userId, updated, profile);
        }

        LogService.info('EconomyService', `[STORE-AD] +${rewardAmount} coins credited after store ad view.`);
        return rewardAmount;
    }

    /**
     * Force une mise à jour directe de l'économie (utile pour les tests ou migrations).
     */
    async setEconomy(economy: Partial<PlayerEconomy>, userId?: string, profile?: EconomyProfileInfo): Promise<void> {
        const current = await this.getEconomy();
        const updated = this.mergeWithDefaults({ ...current, ...economy });
        this.cached = updated;
        await this.persistLocal();

        if (userId && !userId.startsWith('guest_')) {
            await this.pushToFirebase(userId, updated, profile);
        }
    }

    /**
     * Écrit displayName et avatarId dans Firestore pour que le leaderboard
     * puisse afficher le vrai nom et l'avatar du joueur.
     * À appeler après signIn() ou signUp().
     * ⚠️ N'écrit JAMAIS les données économiques — Firestore est la source de vérité.
     */
    async syncProfileMetadata(uid: string, displayName: string, avatarId: string): Promise<void> {
        if (uid.startsWith('guest_')) return;
        try {
            const userRef = doc(db, 'users', uid);
            await setDoc(userRef, { displayName, avatarId, lastActiveAt: Date.now() }, { merge: true });
            LogService.info('EconomyService', 'Profile metadata synced.', displayName);

            // Propagate profile metadata to monthly leaderboard document
            try {
                const { statsService } = require('./stats.service');
                const { leaderboardService } = require('./leaderboard.service');
                const stats = await statsService.getStats();
                await leaderboardService.updateMonthlyStats(uid, stats, { displayName, avatarId });
            } catch (err) {
                LogService.error('EconomyService', 'Failed to propagate profile metadata to monthly stats', err);
            }
        } catch (e) {
            LogService.error('EconomyService', 'syncProfileMetadata error:', e);
        }
    }

    /**
     * Ouvre un écouteur temps réel sur l'économie du joueur dans Firestore.
     * Met à jour le cache local et notifie le callback à chaque changement.
     * Retourne la fonction d'unsubscribe — à appeler au logout ou unmount.
     *
     * ⚠️ Cet écouteur est STRICTEMENT en lecture. Il n'écrit jamais dans Firestore.
     *    Toute écriture depuis ici recréerait la race condition qu'on vient de corriger.
     */
    listenToEconomy(uid: string, onUpdate: (economy: PlayerEconomy) => void): () => void {
        if (uid.startsWith('guest_')) return () => {};

        const userRef = doc(db, 'users', uid);
        const unsubscribe = onSnapshot(
            userRef,
            async (snap) => {
                if (!snap.exists()) return;
                const remoteEconomy = snap.data().economy as Partial<PlayerEconomy> | undefined;
                if (!remoteEconomy) return;

                // 🛡️ pendingWrites : si un push est en cours, on ne laisse pas le snapshot
                // Firestore (potentiellement périmé) écraser le cache local.
                if (this.pendingWrites > 0) {
                    LogService.info('EconomyService', 'onSnapshot ignoré : écriture en cours (pendingWrites > 0).');
                    return;
                }

                // [R3-B9] FIX : fusionner remote + local pour ne pas perdre lastDailyRewardTimestamp
                // mergeWithDefaults(remote) seul écrasait le timestamp local si Firestore était en retard.
                const local = await this.getEconomy();
                const merged = this.mergeEconomies(local, remoteEconomy);
                this.cached = merged;
                this.persistLocal();
                onUpdate({ ...merged });
                LogService.info('EconomyService', 'onSnapshot: economy updated in real-time.');
            },
            (error) => {
                LogService.error('EconomyService', 'listenToEconomy error:', error);
            }
        );

        return unsubscribe;
    }

    /**
     * Invalide le cache en mémoire (utile après déconnexion).
     */
    clearCache(): void {
        this.cached = null;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers privés
    // ──────────────────────────────────────────────────────────────────────────

    private async persistLocal(): Promise<void> {
        if (!this.cached) return;
        try {
            await AsyncStorage.setItem(this.storageKey, JSON.stringify(this.cached));
        } catch (e) {
            LogService.error('EconomyService', 'persistLocal error:', e);
        }
    }

    async pushToFirebase(uid: string, economy: PlayerEconomy, profile?: EconomyProfileInfo): Promise<void> {
        this.pendingWrites++;
        try {
            const userRef = doc(db, 'users', uid);

            // 🔑 Nettoyage GÉNÉRIQUE de tous les champs undefined/null-undefined.
            // Firestore v9 modular SDK rejette TOUTE écriture si un champ vaut `undefined`.
            // Les anciens fix ponctuels (lastDailyRewardTimestamp, chatInventoryMigratedAt)
            // étaient insuffisants — les champs optionnels comme lastStoreAdTimestamp,
            // unlockedChatItems, etc. provoquaient un silent-fail (catch interne).
            const cleanEconomy: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(economy)) {
                if (value !== undefined) {
                    cleanEconomy[key] = value;
                }
            }

            const payload: Record<string, unknown> = { economy: cleanEconomy };
            // Écrire displayName et avatarId si fournis, pour que le leaderboard
            // puisse afficher le vrai nom et l'avatar du joueur
            if (profile) {
                payload.displayName = profile.displayName;
                payload.avatarId = profile.avatarId;
            }
            await setDoc(userRef, payload, { merge: true });
            LogService.info('EconomyService', 'Economy pushed to Firebase.', profile ? `(with profile: ${profile.displayName})` : '');
        } catch (e) {
            LogService.error('EconomyService', 'pushToFirebase error:', e);
        } finally {
            this.pendingWrites--;
        }
    }

    /**
     * Fallback Firestore : si leagueGrade est un ancien grade (4 paliers) ou invalide,
     * on le recalcule depuis cochonsGiven.
     */
    private migrateGrade(raw: string | undefined, leaguePoints: number): LeagueGrade | null {
        const VALID: string[] = [
            'DEBUTANT',
            'APPRENTI_1', 'APPRENTI_2', 'APPRENTI_3',
            'MAITRE_1', 'MAITRE_2', 'MAITRE_3',
            'ROI', 'LEGENDE',
        ];
        if (raw && VALID.includes(raw)) return raw as LeagueGrade;
        return getLeagueGrade(leaguePoints); // peut retourner null
    }

    /**
     * Fusionne deux économies.
     * Pour les pièces/diamants, on fait confiance au serveur (SEC-3).
     * Pour l'XP/Points de ligue, on prend le maximum pour éviter la frustration.
     */
    private mergeEconomies(local: PlayerEconomy, remote: Partial<PlayerEconomy>): PlayerEconomy {
        const mergedXP = Math.max(local.xp, remote.xp ?? 0);
        const mergedLeaguePoints = Math.max(local.leaguePoints, remote.leaguePoints ?? 0);
        
        return {
            // SEC-3 : Ne pas utiliser Math.max sur les pièces/diamants pour éviter la triche côté client via AsyncStorage
            coins: remote.coins !== undefined ? remote.coins : local.coins,
            diamonds: remote.diamonds !== undefined ? remote.diamonds : local.diamonds,
            xp: mergedXP,
            level: getLevelFromXP(mergedXP),
            leaguePoints: mergedLeaguePoints,
            leagueGrade: getLeagueGrade(mergedLeaguePoints),
            // ─── Ligue des Cochons (conservation des champs) ───
            // [TECH-DEBT-COCHONS] Firestore = source de vérité unique. On NE prend PLUS le max
            // entre local et remote pour éviter qu'un cache obsolète fige une valeur ancienne
            // après une migration ou un fix admin.
            cochonsGiven: remote.cochonsGiven ?? local.cochonsGiven ?? 0,
            unlockedFrames: remote.unlockedFrames ?? local.unlockedFrames ?? [],
            activeFrame: remote.activeFrame !== undefined ? remote.activeFrame : local.activeFrame ?? null,
            lastDailyRewardTimestamp: Math.max(
                local.lastDailyRewardTimestamp ?? 0,
                remote.lastDailyRewardTimestamp ?? 0
            ) || undefined,
            lastStoreAdTimestamp: Math.max(
                local.lastStoreAdTimestamp ?? 0,
                remote.lastStoreAdTimestamp ?? 0
            ) || undefined,
            // ─── Tchat (inventaire consommable) ───
            unlockedChatItems: remote.unlockedChatItems ?? local.unlockedChatItems ?? [],
            chatInventory: remote.chatInventory ?? local.chatInventory ?? {},
            chatInventoryMigratedAt: remote.chatInventoryMigratedAt ?? local.chatInventoryMigratedAt,
            welcomeGiftClaimed: remote.welcomeGiftClaimed ?? local.welcomeGiftClaimed ?? false,
        };
    }

    /**
     * Assure que tous les champs sont présents (migration des anciens profils).
     */
    private mergeWithDefaults(partial: Partial<PlayerEconomy>): PlayerEconomy {
        const xp = partial.xp ?? DEFAULT_ECONOMY.xp;
        const leaguePoints = partial.leaguePoints ?? DEFAULT_ECONOMY.leaguePoints;
        return {
            coins: partial.coins ?? DEFAULT_ECONOMY.coins,
            xp,
            level: partial.level ?? getLevelFromXP(xp),
            diamonds: partial.diamonds ?? DEFAULT_ECONOMY.diamonds,
            leaguePoints,
            leagueGrade: this.migrateGrade(partial.leagueGrade ?? undefined, leaguePoints),
            // ─── Ligue des Cochons (migration: valeurs par défaut pour les anciens profils) ───
            cochonsGiven: partial.cochonsGiven ?? 0,
            unlockedFrames: (partial.unlockedFrames as LeagueFrameId[]) ?? [],
            activeFrame: (partial.activeFrame as LeagueFrameId | null) ?? null,
            lastDailyRewardTimestamp: partial.lastDailyRewardTimestamp,
            lastStoreAdTimestamp: partial.lastStoreAdTimestamp,
            // ─── Tchat (inventaire consommable) ───
            unlockedChatItems: partial.unlockedChatItems ?? [],
            chatInventory: partial.chatInventory ?? {},
            chatInventoryMigratedAt: partial.chatInventoryMigratedAt,
        };
    }
}

export const economyService = new EconomyService();
