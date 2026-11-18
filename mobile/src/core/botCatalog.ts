export type BotDifficulty = 'TI_MANMAY' | 'MAPIPI' | 'GRAN_MOUN' | 'METKAYALI';

export interface BotProfile {
    id: string;
    name: string;
    avatarId: string;
    imageUrl?: string;
    difficulty: BotDifficulty;
}

/** Catalogue versionné des bots du jeu. Source : catalogue Firestore validé le 2026-11-18. */
export const BOT_CATALOG: Record<BotDifficulty, readonly BotProfile[]> = {
    TI_MANMAY: [
        { id: 'bot_ti_3', name: 'Doudou', avatarId: 'Chip_1', difficulty: 'TI_MANMAY' },
        { id: 'bot_ti_2', name: 'Man-Yaya', avatarId: 'Zenith_4', difficulty: 'TI_MANMAY' },
        { id: 'bot_ti_1', name: 'Ti-Sonson', avatarId: 'bot_arrogante', difficulty: 'TI_MANMAY' },
    ],
    MAPIPI: [
        { id: 'bot_mapipi_1', name: 'Dédé', avatarId: 'bot_dede', difficulty: 'MAPIPI' },
        { id: 'bot_mapipi_4', name: 'Jojo', avatarId: 'bot_neg_gwo_siwo', difficulty: 'MAPIPI' },
        { id: 'bot_mapipi_2', name: 'Maxime', avatarId: 'bot_maxime', difficulty: 'MAPIPI' },
    ],
    GRAN_MOUN: [
        { id: 'bot_gran_3', name: 'Man-Zouzou', avatarId: 'bot_karnage', difficulty: 'GRAN_MOUN' },
        { id: 'bot_gran_1', name: 'Tonton-Léon', avatarId: 'bot_mariyan', difficulty: 'GRAN_MOUN' },
        { id: 'bot_gran_manoux', name: 'ManouX', avatarId: 'bot_manoux', difficulty: 'GRAN_MOUN' },
    ],
    METKAYALI: [
        { id: 'bot_mk_mariyan', name: 'Mariyan Lapo fig', avatarId: 'bot_mariyan', difficulty: 'METKAYALI' },
        { id: 'bot_mk_karnage', name: 'Mèt_KARNAGE', avatarId: 'bot_karnage', difficulty: 'METKAYALI' },
        { id: 'bot_mk_arrogante', name: "Mèt_L'ARROGANTE", avatarId: 'bot_arrogante', difficulty: 'METKAYALI' },
        { id: 'bot_mk_sylvestre', name: 'Mèt_SYLVESTRE', avatarId: 'bot_sylvestre', difficulty: 'METKAYALI' },
        { id: 'bot_mk_tontonalex', name: 'Mèt_TontonAlex', avatarId: 'bot_tontonalex', difficulty: 'METKAYALI' },
        { id: 'bot_mk_xena', name: 'Mèt_XENA', avatarId: 'bot_xena', difficulty: 'METKAYALI' },
        { id: 'bot_mk_neg_gwo_siwo', name: 'Nèg Gwo Siwo', avatarId: 'bot_neg_gwo_siwo', difficulty: 'METKAYALI' },
        { id: 'bot_mk_strangerx', name: 'StrangerX', avatarId: 'bot_dede', difficulty: 'METKAYALI' },
        { id: 'bot_mk_yoyo', name: 'Yoyo Ti Pwen', avatarId: 'bot_yoyo', difficulty: 'METKAYALI' },
    ],
};

export function selectBots(level: BotDifficulty, count: number): BotProfile[] {
    const pool = BOT_CATALOG[level];
    return [...pool].sort(() => 0.5 - Math.random()).slice(0, Math.min(count, pool.length));
}
