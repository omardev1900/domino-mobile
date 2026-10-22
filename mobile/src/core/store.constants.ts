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
        id: 'skin_premium_spectrum',
        name: 'Spectre Premium',
        description: 'Chaque valeur colore son fond pour lire la partie d’un coup d’œil.',
        type: 'SKIN',
        rarity: 'LEGENDARY',
        priceCoins: 1000,
        assetId: 'premium_spectrum',
        isPremium: true,
        skinConfig: {
            tableBackgroundColor: '#1D2A44',
            boardColor: '#1B4332',
            dominoBackgroundColor: '#F4F4F6',
            dominoDotColor: '#1E1E1E',
            dominoLineColor: '#1E1E1E',
            dominoValueBackgroundColors: {
                0: '#F4F4F6',
                1: '#FFD166',
                2: '#118AB2',
                3: '#EF476F',
                4: '#06D6A0',
                5: '#F77F00',
                6: '#732C7B',
            },
            dominoValueDotColors: {
                0: '#1E1E1E',
                1: '#1E1E1E',
                2: '#1E1E1E',
                3: '#1E1E1E',
                4: '#1E1E1E',
                5: '#1E1E1E',
                6: '#FFFFFF',
            },
        },
    },
    {
        id: 'skin_premium_atelier',
        name: 'Skin Creator',
        description: 'Crée et enregistre jusqu’à cinq plateaux, tuiles et boutons à ton style.',
        type: 'SKIN',
        rarity: 'LEGENDARY',
        priceCoins: 2000,
        assetId: 'premium_workshop',
        isPremium: true,
        skinConfig: {
            tableBackgroundColor: '#21143A', boardColor: '#4B2C70', dominoBackgroundColor: '#F8F3FF', dominoDotColor: '#2B173D', dominoLineColor: '#B68CFF',
        },
    },
    {
        id: 'skin_premium_terre_ambre',
        name: 'Mosaïque Terre Ambrée',
        description: 'Plateau umber brun et une palette pastel unique pour chaque valeur.',
        type: 'SKIN',
        rarity: 'LEGENDARY',
        priceCoins: 1000,
        assetId: 'premium_umber_earth',
        isPremium: true,
        skinConfig: {
            tableBackgroundColor: '#5B3328',
            boardColor: '#A6674C',
            dominoBackgroundColor: '#F8E9D2',
            dominoDotColor: '#3B2B24',
            dominoLineColor: '#5A3529',
            dominoValueBackgroundColors: { 0: '#F8E9D2', 1: '#F5C7B8', 2: '#F0D3A6', 3: '#D5E4C0', 4: '#BFDDE0', 5: '#D8C4E8', 6: '#F1B9B7' },
            dominoValueDotColors: { 0: '#3B2B24', 1: '#4A2926', 2: '#4A3420', 3: '#24412B', 4: '#173F45', 5: '#38254C', 6: '#54272B' },
        },
    },
    {
        id: 'skin_premium_jardin_nocturne',
        name: 'Mosaïque Jardin Nocturne',
        description: 'Vert profond et tuiles lumineuses aux couleurs variées.',
        type: 'SKIN',
        rarity: 'LEGENDARY',
        priceCoins: 1000,
        assetId: 'premium_night_garden',
        isPremium: true,
        skinConfig: {
            tableBackgroundColor: '#0E2412',
            boardColor: '#18391E',
            dominoBackgroundColor: '#F4F1DE',
            dominoDotColor: '#19311D',
            dominoLineColor: '#A9C98A',
            dominoValueBackgroundColors: { 0: '#F4F1DE', 1: '#D9ED92', 2: '#BDE0FE', 3: '#CDEAC0', 4: '#FFD6A5', 5: '#E4C1F9', 6: '#FFCAD4' },
            dominoValueDotColors: { 0: '#19311D', 1: '#304A13', 2: '#173B5A', 3: '#1D4A2A', 4: '#5A3214', 5: '#492461', 6: '#61243E' },
        },
    },
    {
        id: 'skin_premium_madras',
        name: 'Madras',
        description: 'Une table éclatante inspirée des couleurs du madras.',
        type: 'SKIN',
        rarity: 'LEGENDARY',
        priceCoins: 500,
        assetId: 'premium_madras',
        isPremium: true,
        skinConfig: {
            tableBackgroundColor: '#7C1D35',
            boardColor: '#174B42',
            dominoBackgroundColor: '#FFF4D6',
            dominoDotColor: '#7C1D35',
            dominoLineColor: '#D9A21B',
        },
    },
    {
        id: 'skin_premium_or_royal',
        name: 'Or Royal',
        description: 'Ivoire, or et velours pour les grandes victoires.',
        type: 'SKIN',
        rarity: 'LEGENDARY',
        priceCoins: 500,
        assetId: 'premium_royal_gold',
        isPremium: true,
        skinConfig: {
            tableBackgroundColor: '#30134D',
            boardColor: '#51286F',
            dominoBackgroundColor: '#FFF8E8',
            dominoDotColor: '#3A1B52',
            dominoLineColor: '#D4AF37',
        },
    },
    {
        id: 'skin_premium_nuit_caraibe',
        name: 'Nuit Caraïbe',
        description: 'Bleu profond et reflets turquoise sous les étoiles.',
        type: 'SKIN',
        rarity: 'EPIC',
        priceCoins: 500,
        assetId: 'premium_caribbean_night',
        isPremium: true,
        skinConfig: {
            tableBackgroundColor: '#071C3B',
            boardColor: '#073F52',
            dominoBackgroundColor: '#E7F6F5',
            dominoDotColor: '#0A3559',
            dominoLineColor: '#2AC5C5',
        },
    },
    {
        id: 'avatar_premium_cochon_dore',
        name: 'Avatar Cochon Doré Premium',
        description: 'Le souverain espiègle de la table.',
        type: 'AVATAR',
        rarity: 'LEGENDARY',
        priceCoins: 1000,
        assetId: 'avatar_premium_cochon_dore',
        isPremium: true,
    },
    {
        id: 'avatar_premium_reine_domino',
        name: 'Avatar Reine Domino Premium',
        description: 'Élégance, stratégie et couronne de dominos.',
        type: 'AVATAR',
        rarity: 'LEGENDARY',
        priceCoins: 1000,
        assetId: 'avatar_premium_reine_domino',
        isPremium: true,
    },
    {
        id: 'avatar_premium_champion_madras',
        name: 'Avatar Champion Madras Premium',
        description: 'Prêt à jouer le coup décisif avec style.',
        type: 'AVATAR',
        rarity: 'EPIC',
        priceCoins: 1000,
        assetId: 'avatar_premium_champion_madras',
        isPremium: true,
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
