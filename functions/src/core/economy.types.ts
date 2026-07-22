/**
 * economy.types.ts
 *
 * Tous les types du système d'économie et de progression.
 * Ce fichier est la source de vérité des structures de données économiques.
 * Il ne contient AUCUNE logique métier — uniquement des interfaces et types.
 */

// ─── Ligue des Cochons — Cadres ─────────────────────────────────────────────────

/** Identifiant unique d'un cadre d'avatar débloqué par la Ligue des Cochons */
export type LeagueFrameId =
    | 'frame_apprenti_1' | 'frame_apprenti_2' | 'frame_apprenti_3'
    | 'frame_maitre_1'   | 'frame_maitre_2'   | 'frame_maitre_3'
    | 'frame_roi'
    | 'frame_legende';

/** Événement de déblocage d'un palier de la Ligue — déclenche la modal de récompense */
export interface FrameUnlockEvent {
    grade: LeagueFrameGrade;
    frameId: LeagueFrameId;
    coinsBonus: number;       // Coins offerts en récompense du palier
    cochonsAtUnlock: number;  // Nombre de cochons donnés au moment du déblocage
}

// ─── Monnaies & Progression ───────────────────────────────────────────────────

/** État économique complet d'un joueur */
export interface PlayerEconomy {
    coins: number;         // 🪙 Monnaie de flux
    xp: number;            // ⭐ Expérience cumulée totale
    level: number;         // Niveau courant dérivé de l'XP
    diamonds: number;      // 💎 Monnaie premium
    leaguePoints: number;        // 🐷 Total cochons infligés (alias cochonsGiven — source de la ligue)
    leagueGrade: LeagueGrade | null; // null = joueur sans grade (0 cochon)
    // ─── Ligue des Cochons ───
    cochonsGiven?: number;           // 🐖 Compteur lifetime de cochons DONNÉS (by this player)
    unlockedFrames?: LeagueFrameId[]; // Cadres avatar débloqués (liste des paliers atteints)
    activeFrame?: LeagueFrameId | null; // Cadre actuellement équipé
    lastDailyRewardTimestamp?: number; // 📅 Dernier cadeau reçu (pour check quotidien)
    lastStoreAdTimestamp?: number;     // 📺 Dernier visionnage de pub boutique (cooldown 3min)
    unlockedChatItems?: string[];      // IDs Firestore des items de tchat achetés à vie (usagesPerPurchase === 0)
    chatInventory?: Record<string, { remaining: number }>; // Compteur d'usages restants par item consommable
    chatInventoryMigratedAt?: number;  // Timestamp de migration one-shot (prévient double-crédit)
    welcomeGiftClaimed?: boolean;      // 🎁 True si le joueur a réclamé son cadeau de bienvenue initial (500 pièces)
}

export type LeagueGrade =
    | 'DEBUTANT'
    | 'APPRENTI_1' | 'APPRENTI_2' | 'APPRENTI_3'
    | 'MAITRE_1'   | 'MAITRE_2'   | 'MAITRE_3'
    | 'ROI'
    | 'LEGENDE';

export type LeagueFrameGrade = Exclude<LeagueGrade, 'DEBUTANT'>;

// ─── Tables ───────────────────────────────────────────────────────────────────

export type TableTier = 'DEBUTANT' | 'EXPERT' | 'LEGENDE';

export interface TableConfig {
    tier: TableTier;
    buyIn: number;
    label: string;
    icon: string;
}

// ─── Calcul des Récompenses ───────────────────────────────────────────────────

/**
 * Entrée pour le calcul des récompenses.
 * Le RewardEngine consomme ce contexte et produit un MatchReward.
 */
export interface RewardCalculationInput {
    /** L'état du jeu finalisé (phase === 'MATCH_END') */
    playerFinalStats: PlayerMatchSnapshot;
    /** Classement final (du meilleur au pire) */
    finalRanking: PlayerMatchSnapshot[];
    /** Résumé des manches (source de vérité pour cochons/manches) */
    mancheHistory: MancheRewardEvent[];
    /** Niveau actuel du joueur (pour le multiplicateur de coins) */
    currentLevel: number;
    /** Points de ligue actuels du joueur (pour calcul du nouveau grade) */
    currentLeaguePoints: number;
    /** XP total actuel du joueur (pour calcul du nouveau niveau) */
    currentXP: number;
    /** Mode de jeu */
    gameMode: string;
    /** Configuration de la table (buy-in) */
    tableTier: TableTier;
    /** Nombre de joueurs dans la partie */
    playerCount: number;
    /** Nombre de cochons donné à vie AVANT ce match (pour calcul du déblocage) */
    currentCochonsGiven?: number;
    /** Cadres déjà débloqués (pour ne pas redonner la récompense) */
    unlockedFrames?: LeagueFrameId[];
    /** ID du tournoi actif (optionnel — uniquement en contexte tournoi) */
    tournamentId?: string;
}

/** Snapshot des stats finales d'un joueur pour le calcul des rewards */
export interface PlayerMatchSnapshot {
    playerId: string;
    totalPoints: number;
    totalCochons: number;
    mancheWins: number;
    totalRoundWins: number;
    rank: number; // 1 = vainqueur
}

/** Événement de manche extrait de mancheHistory pour le calcul des rewards */
export interface MancheRewardEvent {
    mancheNumber: number;
    resultType: 'NORMAL' | 'CHIRE' | 'COCHON';
    cochonCount: number;
    isWinner: boolean;
    isCochonne: boolean; // Le joueur était à 0 étoiles (cochonné)
    pointsEarned: number; // Points obtenus par le joueur dans cette manche
}

// ─── Résultat du Calcul ───────────────────────────────────────────────────────

/**
 * Résultat complet du calcul des récompenses pour un match.
 * Ce type est la "sortie" du RewardEngine et l'entrée de l'EconomyService et du RewardOverlay.
 */
export interface MatchReward {
    // ─ Totaux
    coinsEarned: number;
    xpEarned: number;
    diamondsEarned: number;
    leaguePointsEarned: number;
    isWinner: boolean;

    // ─ Progression
    previousLevel: number;
    newLevel: number;
    leveledUp: boolean;
    previousXP: number;
    newXP: number;
    xpToNextLevel: number;

    // ─ Ligue
    previousGrade: LeagueGrade | null;
    newGrade: LeagueGrade | null;
    gradeUp: boolean;
    previousLeaguePoints: number;
    newLeaguePoints: number;
    nextGradeThreshold: number | null; // null si grade max
    // ─ Ligue des Cochons — Cadres
    newCochonsGiven: number;                     // Nouveau total de cochons donnés
    newlyUnlockedFrames: FrameUnlockEvent[];     // Paliers débloqués durant ce match (peut en avoir plusieurs)
    frameCoinsBonus: number;                     // Total des coins offerts par les paliers débloqués

    // ─ Détail animable ligne par ligne (pour le rolling counter)
    breakdown: RewardBreakdown[];
}

/** Ligne de détail d'une récompense — utilisée par le RewardOverlay pour l'animation */
export interface RewardBreakdown {
    id: string;           // Clé unique pour l'animation
    label: string;        // "Victoire de Manche", "Bonus Cochon x2", etc.
    coins: number;
    xp: number;
    diamonds: number;
    leaguePoints: number;
}

// ─── Coffres de Niveau ────────────────────────────────────────────────────────

/** Coffre obtenu lors d'un passage de niveau */
export interface LevelUpChest {
    level: number;
    coinsReward: number;
    diamondReward: number; // 0 si pas de diamond à ce niveau
}
