/**
 * economy.constants.ts
 *
 * Toutes les constantes numériques du système d'économie.
 * RÈGLE : Modifier ce fichier suffit pour rééquilibrer tout le système.
 * Aucune constante économique ne doit être hardcodée ailleurs.
 */

import { TableConfig, LeagueFrameGrade, LeagueGrade, LevelUpChest } from './economy.types';

// ─── Matrice des Gains ────────────────────────────────────────────────────────

/** Gains par événement de jeu (avant multiplicateur de niveau) */
export const BASE_REWARDS = {
    ROUND_WIN: {
        coins: 0,
        xp: 10,
        diamonds: 0,
        leaguePoints: 0,
    },
    MANCHE_WIN: {
        coins: 0,
        xp: 100,
        diamonds: 0,
        leaguePoints: 0,
    },
    /** Cochon infligé à 1 adversaire (3-étoiles vs 0 étoile) */
    COCHON_BONUS: {
        coins: 0,
        xp: 150,
        diamonds: 0,
        leaguePoints: 1,
    },
    /** Double Cochon : 2 adversaires à 0 étoile = 3-0-0 */
    DOUBLE_COCHON: {
        coins: 0,
        xp: 300,
        diamonds: 0,
        leaguePoints: 2,
    },
    /** Vainqueur du Match (Podium 1er) */
    MATCH_WIN: {
        coins: 0,     // Déterminé par le Pot
        xp: 500,
        diamonds: 1,
        leaguePoints: 0,
    },
    /** Participer au match (non vainqueur) */
    MATCH_FINISH: {
        coins: 0,
        xp: 100,
        diamonds: 0,
        leaguePoints: 0,
    },
    /** Le joueur a été cochonné (0 étoile) */
    MATCH_COCHONNE: {
        coins: 0,
        xp: 10,
        diamonds: 0,
        leaguePoints: 0,
    },
} as const;

// ─── Tables de jeu ───────────────────────────────────────────────────────────

export const TABLE_CONFIGS: Record<string, TableConfig> = {
    DEBUTANT: { tier: 'DEBUTANT', buyIn: 100, label: 'Table Débutant', icon: '🌱' },
    EXPERT: { tier: 'EXPERT', buyIn: 1000, label: 'Table Expert', icon: '⚔️' },
    LEGENDE: { tier: 'LEGENDE', buyIn: 10000, label: 'Table Légende', icon: '👑' },
};

/** Taxe de table prélevée sur le pot total — 0% (vainqueur prend tout) */
export const RAKE_PERCENT = 0.00; // 0% — pas de taxe

/** Distribution du pot : le vainqueur remporte tout le pot, les autres perdent leur mise */
export const POT_DISTRIBUTION = {
    FIRST: 1.00,  // 100% au 1er (gagne 300 coins sur Table Débutant à 3 joueurs)
    SECOND: 0.00, // 2ème — perd sa mise
    THIRD: 0.00,  // 3ème — perd sa mise
};

/** Gain fixe en Solo (pas de pot car pas de buy-in PvP) */
export const SOLO_WIN_FLAT_REWARD = 300; // 🪙

// ─── Cadeau de bienvenue ─────────────────────────────────────────────────────

export const NEW_PLAYER_COINS = 300; // 🪙 donné à la création du compte

/** Coins offerts chaque jour à la connexion */
export const DAILY_REWARD_COINS = 200; // 🎁

/** Coins crédités après visionnage volontaire d'une pub post-match */
export const AD_REWARD_COINS = 100; // 📺

// ─── XP et Niveaux ───────────────────────────────────────────────────────────

/** XP requis pour passer du niveau 1 au niveau 2 */
export const XP_PER_LEVEL_BASE = 500;

/** Facteur de croissance exponentielle de l'XP par niveau */
export const XP_GROWTH_RATE = 1.15;

/**
 * Bonus de Coins en % par niveau franchi.
 * Niveau 10 = +50% de coins sur tous les gains.
 */
export const COIN_MULTIPLIER_PER_LEVEL = 0.05; // +5% par niveau

/** Niveau maximum jouable */
export const MAX_LEVEL = 100;

/**
 * Coffres de niveau — doublons de paliers (niveau 5, 10, 15, …)
 * Les autres niveaux donnent uniquement des coins.
 */
export const LEVEL_UP_CHESTS: LevelUpChest[] = [
    { level: 1, coinsReward: 200, diamondReward: 0 },
    { level: 5, coinsReward: 500, diamondReward: 0 },
    { level: 10, coinsReward: 1000, diamondReward: 1 },
    { level: 20, coinsReward: 2000, diamondReward: 2 },
    { level: 50, coinsReward: 5000, diamondReward: 5 },
    { level: 100, coinsReward: 10000, diamondReward: 10 },
];

/** Bonus de coins au passage de chaque niveau (si pas dans LEVEL_UP_CHESTS) */
export const DEFAULT_LEVEL_UP_COINS = 100;

// ─── Ligue des Cochons (8 paliers — décision client 22/04/2026) ──────────────

/**
 * Seuils de cochons DONNÉS pour atteindre chaque grade.
 * Le grade est recalculé depuis cochonsGiven à chaque mise à jour.
 */
export const LEAGUE_THRESHOLDS: Record<LeagueGrade, number> = {
    DEBUTANT: 1,
    APPRENTI_1: 10,
    APPRENTI_2: 20,
    APPRENTI_3: 30,
    MAITRE_1:   60,
    MAITRE_2:   90,
    MAITRE_3:   120,
    ROI:        250,
    LEGENDE:    500,
};

/**
 * Seuils de cochons pour le DÉBLOCAGE du cadre associé à chaque grade.
 * Franchir ce seuil = recevoir le cadre en récompense.
 */
export const LEAGUE_FRAME_THRESHOLDS: Record<LeagueFrameGrade, number> = {
    APPRENTI_1: 10,
    APPRENTI_2: 20,
    APPRENTI_3: 30,
    MAITRE_1:   60,
    MAITRE_2:   90,
    MAITRE_3:   120,
    ROI:        250,
    LEGENDE:    500,
};

/** Récompenses associées à chaque palier (cadre + coins) */
export const LEAGUE_FRAME_REWARDS: Record<LeagueFrameGrade, { frameId: string; coinsBonus: number }> = {
    APPRENTI_1: { frameId: 'frame_apprenti_1', coinsBonus: 200 },
    APPRENTI_2: { frameId: 'frame_apprenti_2', coinsBonus: 300 },
    APPRENTI_3: { frameId: 'frame_apprenti_3', coinsBonus: 500 },
    MAITRE_1:   { frameId: 'frame_maitre_1',   coinsBonus: 600 },
    MAITRE_2:   { frameId: 'frame_maitre_2',   coinsBonus: 800 },
    MAITRE_3:   { frameId: 'frame_maitre_3',   coinsBonus: 1000 },
    ROI:        { frameId: 'frame_roi',         coinsBonus: 5000 },
    LEGENDE:    { frameId: 'frame_legende',     coinsBonus: 10000 },
};

/** Les cadres de ligue ne sont plus utilisés dans le modèle mensuel. */
export const LEAGUE_FRAMES_ENABLED = false;

/** Ordre des grades du plus faible au plus fort */
export const LEAGUE_GRADE_ORDER: LeagueGrade[] = [
    'DEBUTANT',
    'APPRENTI_1', 'APPRENTI_2', 'APPRENTI_3',
    'MAITRE_1',   'MAITRE_2',   'MAITRE_3',
    'ROI',        'LEGENDE',
];

export const LEAGUE_FRAME_GRADE_ORDER: LeagueFrameGrade[] = [
    'APPRENTI_1', 'APPRENTI_2', 'APPRENTI_3',
    'MAITRE_1',   'MAITRE_2',   'MAITRE_3',
    'ROI',        'LEGENDE',
];

/** Labels affichés dans l'UI (R2-M6) */
export const LEAGUE_LABELS: Record<LeagueGrade, string> = {
    DEBUTANT: 'Debutant',
    APPRENTI_1: 'Apprenti 1',
    APPRENTI_2: 'Apprenti 2',
    APPRENTI_3: 'Apprenti 3',
    MAITRE_1:   'Maître Saucissier 1',
    MAITRE_2:   'Maître Saucissier 2',
    MAITRE_3:   'Maître Saucissier 3',
    ROI:        'Roi du Boudin',
    LEGENDE:    'Légende du Grouin',
};

/** Emojis des grades */
export const LEAGUE_ICONS: Record<LeagueGrade, string> = {
    DEBUTANT: '🌱',
    APPRENTI_1: '🥈',
    APPRENTI_2: '🥈',
    APPRENTI_3: '🥈',
    MAITRE_1:   '🥇',
    MAITRE_2:   '🥇',
    MAITRE_3:   '🥇',
    ROI:        '👑',
    LEGENDE:    '🔥',
};

/**
 * Couleur du cadre d'avatar en jeu par grade (R2-M3).
 * Utilisé dans PlayerAvatar pour encadrer l'icône joueur.
 */
export const LEAGUE_GRADE_COLORS: Record<LeagueGrade, string> = {
    DEBUTANT: '#7CB342',
    APPRENTI_1: '#C8C8C8', // Gris clair
    APPRENTI_2: '#909090', // Gris
    APPRENTI_3: '#505050', // Gris foncé
    MAITRE_1:   '#FFE066', // Jaune clair
    MAITRE_2:   '#FFD700', // Jaune
    MAITRE_3:   '#B8860B', // Jaune foncé
    ROI:        '#3A86FF', // Bleu
    LEGENDE:    '#DC143C', // Rouge
};
