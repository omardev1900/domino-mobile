import { StoreItem } from './store.types';

export const STORE_CATALOG: StoreItem[] = [
    // --- AVATARS ---
    {
        id: 'avatar_classic',
        name: 'Classique',
        description: 'L\'avatar par défaut de tous les joueurs.',
        type: 'AVATAR',
        rarity: 'COMMON',
        priceCoins: 0,
        assetId: 'default'
    },
    {
        id: 'avatar_pig_mask',
        name: 'Cochon Masqué',
        description: 'Un avatar pour ceux qui bluffent bien.',
        type: 'AVATAR',
        rarity: 'RARE',
        priceCoins: 1500,
        assetId: 'pig_mask' // Map this to a local require() in the UI
    },
    {
        id: 'avatar_king',
        name: 'Roi Domino',
        description: 'Seulement pour la vraie noblesse.',
        type: 'AVATAR',
        rarity: 'EPIC',
        priceDiamonds: 50,
        assetId: 'king'
    },
    {
        id: 'avatar_legend',
        name: 'Légende Dorée',
        description: 'L\'ultime marque de prestige.',
        type: 'AVATAR',
        rarity: 'LEGENDARY',
        priceDiamonds: 250,
        assetId: 'legend_gold'
    },

    // --- SKINS (Dominos) ---
    {
        id: 'skin_classic',
        name: 'Standard',
        description: 'Les dominos traditionnels.',
        type: 'SKIN',
        rarity: 'COMMON',
        priceCoins: 0,
        assetId: 'classic'
    },
    {
        id: 'skin_ivory_pure',
        name: 'Ivoire Pur',
        description: 'Blanc cassé lumineux, points noirs profonds.',
        type: 'SKIN',
        rarity: 'COMMON',
        priceCoins: 0,
        assetId: 'ivory_pure',
        skinConfig: {
            tableBackgroundColor: '#2C4A2E',
            boardColor: '#7B3434',
            dominoBackgroundColor: '#f8f4e8',
            dominoDotColor: '#1a1a1a',
            dominoLineColor: 'rgba(0,0,0,0.2)'
        }
    },
    {
        id: 'skin_darkwood_free',
        name: 'Bois Sombre',
        description: 'Acajou foncé avec points ivoire.',
        type: 'SKIN',
        rarity: 'COMMON',
        priceCoins: 0,
        assetId: 'darkwood_free',
        skinConfig: {
            tableBackgroundColor: '#1a0f08',
            boardColor: '#1B5E20',
            dominoBackgroundColor: '#3a2515',
            dominoDotColor: '#f5ecd5',
            dominoLineColor: 'rgba(245,236,213,0.25)'
        }
    },
    {
        id: 'skin_bone',
        name: 'Os & Charbon',
        description: 'Os naturel, points charbon doux. Look moderne.',
        type: 'SKIN',
        rarity: 'COMMON',
        priceCoins: 0,
        assetId: 'bone',
        skinConfig: {
            tableBackgroundColor: '#2C4A2E',
            boardColor: '#1C2333',
            dominoBackgroundColor: '#ebe3d0',
            dominoDotColor: '#2d2a24',
            dominoLineColor: 'rgba(0,0,0,0.18)'
        }
    },
    {
        id: 'skin_neon',
        name: 'Cyber Néon',
        description: 'Des dominos brillants pour la nuit.',
        type: 'SKIN',
        rarity: 'RARE',
        priceCoins: 5000,
        assetId: 'neon'
    },
    {
        id: 'skin_wood',
        name: 'Bois Sombre',
        description: 'Élégance et tradition.',
        type: 'SKIN',
        rarity: 'EPIC',
        priceCoins: 12000,
        assetId: 'wood'
    },
    {
        id: 'skin_gold',
        name: 'Or Massif',
        description: 'Faites briller vos victoires.',
        type: 'SKIN',
        rarity: 'LEGENDARY',
        priceDiamonds: 500,
        assetId: 'gold'
    },

    // --- PACKS DE DEVISE (Diamants -> Coins) ---
    {
        id: 'pack_coins_small',
        name: 'Poignée de Coins',
        description: 'Obtenez 1 500 Coins.',
        type: 'CURRENCY_PACK',
        rarity: 'COMMON',
        priceDiamonds: 10,
        rewards: { coins: 1500 },
        assetId: 'coins_pile'
    },
    {
        id: 'pack_coins_medium',
        name: 'Sac de Coins',
        description: 'Obtenez 8 000 Coins.',
        type: 'CURRENCY_PACK',
        rarity: 'RARE',
        priceDiamonds: 50,
        rewards: { coins: 8000 },
        assetId: 'coins_bag'
    },
    {
        id: 'pack_coins_large',
        name: 'Coffre de Coins',
        description: 'Obtenez 20 000 Coins.',
        type: 'CURRENCY_PACK',
        rarity: 'EPIC',
        priceDiamonds: 100,
        rewards: { coins: 20000 },
        assetId: 'coins_chest'
    }
];

// Helper pour récupérer rapidement les items par défaut offerts à tous
export const DEFAULT_OWNED_ITEMS = ['avatar_classic', 'skin_classic', 'skin_ivory_pure', 'skin_darkwood_free', 'skin_bone'];

export const DEFAULT_INVENTORY = {
    ownedItems: DEFAULT_OWNED_ITEMS,
    equipped: {
        avatar: 'avatar_classic',
        skin: 'skin_classic'
    }
};
