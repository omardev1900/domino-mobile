import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url'; // <-- Nouvel import obligatoire pour ESM

// 1. Recréer __dirname pour l'environnement ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. Load environment variables from .env if running from script
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, 'utf8').split('\n');
    env.forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value.length > 0) {
            process.env[key.trim()] = value.join('=').trim().replace(/['"]/g, '');
        }
    });
}

const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const STORE_CATALOG = [
    // --- AVATARS ---
    {
        id: 'avatar_classic',
        name: 'Classique',
        description: 'L\'avatar par défaut de tous les joueurs.',
        type: 'AVATAR',
        rarity: 'COMMON',
        priceCoins: 0,
        assetId: 'default',
        imageUrl: 'https://firebasestorage.googleapis.com/v0/b/domino-martinique-v1.firebasestorage.app/o/avatars%2Fclassic.jpg?alt=media'
    },
    {
        id: 'avatar_pig_mask',
        name: 'Cochon Masqué',
        description: 'Un avatar pour ceux qui bluffent bien.',
        type: 'AVATAR',
        rarity: 'RARE',
        priceCoins: 1500,
        assetId: 'pig_mask',
        imageUrl: 'https://firebasestorage.googleapis.com/v0/b/domino-martinique-v1.firebasestorage.app/o/avatars%2Fcochon_masquee.jpg?alt=media&token=ffde8d39-f41c-4275-b87e-71cf9ddffdd1'
    },
    {
        id: 'avatar_king',
        name: 'Roi Domino',
        description: 'Seulement pour la vraie noblesse.',
        type: 'AVATAR',
        rarity: 'EPIC',
        priceDiamonds: 50,
        assetId: 'king',
        imageUrl: 'https://firebasestorage.googleapis.com/v0/b/domino-martinique-v1.firebasestorage.app/o/avatars%2Froi_domino.jpg?alt=media&token=2b273d10-767c-4855-a439-8b5b9172125d'
    },
    {
        id: 'avatar_legend',
        name: 'Légende Dorée',
        description: 'L\'ultime marque de prestige.',
        type: 'AVATAR',
        rarity: 'LEGENDARY',
        priceDiamonds: 250,
        assetId: 'legend_gold',
        imageUrl: 'https://firebasestorage.googleapis.com/v0/b/domino-martinique-v1.firebasestorage.app/o/avatars%2Flegende_doree.jpg?alt=media&token=5deb771e-a4b1-4e1f-991e-60c70089849c'
    },
    {
        id: 'avatar_mystery',
        name: 'Soldat Mystère',
        description: 'Un joueur anonyme au regard perçant.',
        type: 'AVATAR',
        rarity: 'RARE',
        priceDiamonds: 25,
        assetId: 'mystery',
        imageUrl: 'https://firebasestorage.googleapis.com/v0/b/domino-martinique-v1.firebasestorage.app/o/avatars%2Fsoldat_mystere.jpg?alt=media&token=e778b05c-59c9-4cf0-a77e-884401f28db5'
    },

    // --- SKINS (Dominos) ---
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
        id: 'skin_classic',
        name: 'Standard',
        description: 'Les dominos traditionnels.',
        type: 'SKIN',
        rarity: 'COMMON',
        priceCoins: 0,
        assetId: 'classic',
        skinConfig: {
            tableBackgroundColor: '#105B3A', // Classic Green
            dominoBackgroundColor: '#FFFFFF',
            dominoDotColor: '#000000',
            dominoLineColor: '#000000'
        }
    },
    {
        id: 'skin_royal',
        name: 'Skin Royal',
        description: 'Orné de dorures pour les champions.',
        type: 'SKIN',
        rarity: 'EPIC',
        priceCoins: 15000,
        priceDiamonds: 100,
        assetId: 'royal',
        skinConfig: {
            tableBackgroundColor: '#4A1C40', // Deep Purple
            dominoBackgroundColor: '#F8F1E5', // Ivory
            dominoDotColor: '#D4AF37', // Gold
            dominoLineColor: '#D4AF37'
        }
    },
    {
        id: 'skin_obsidian',
        name: 'Obsidienne',
        description: 'Sombre, lourd et mystérieux.',
        type: 'SKIN',
        rarity: 'LEGENDARY',
        priceDiamonds: 300,
        assetId: 'obsidian',
        skinConfig: {
            tableBackgroundColor: '#1A1A1D', // Very Dark Grey
            dominoBackgroundColor: '#2C2C2C', // Obsidian
            dominoDotColor: '#E0E0E0', // Light Grey/Silver
            dominoLineColor: '#E0E0E0'
        }
    },
    {
        id: 'skin_neon',
        name: 'Cyber Néon',
        description: 'Des dominos brillants pour la nuit.',
        type: 'SKIN',
        rarity: 'RARE',
        priceCoins: 5000,
        assetId: 'neon',
        skinConfig: {
            tableBackgroundColor: '#0D0221', // Deep Space Blue
            dominoBackgroundColor: '#1E1E24', // Dark Grey
            dominoDotColor: '#00FF41', // Neon Green
            dominoLineColor: '#00FF41'
        }
    },
    {
        id: 'skin_wood',
        name: 'Bois Sombre',
        description: 'Élégance et tradition.',
        type: 'SKIN',
        rarity: 'RARE',
        priceCoins: 12000,
        assetId: 'wood',
        skinConfig: {
            tableBackgroundColor: '#2C1B12', // Dark Wood Table
            dominoBackgroundColor: '#8B5A2B', // Mahogany
            dominoDotColor: '#F5DEB3', // Wheat/Light Wood
            dominoLineColor: '#F5DEB3'
        }
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
        assetId: 'coins_pile',
        imageUrl: 'https://firebasestorage.googleapis.com/v0/b/domino-martinique-v1.firebasestorage.app/o/Devises%2Fcoins.png?alt=media&token=e95a2934-2613-4f22-9a1c-676697204d97'
    },
    {
        id: 'pack_coins_medium',
        name: 'Sac de Coins',
        description: 'Obtenez 8 000 Coins.',
        type: 'CURRENCY_PACK',
        rarity: 'RARE',
        priceDiamonds: 50,
        rewards: { coins: 8000 },
        assetId: 'coins_bag',
        imageUrl: 'https://firebasestorage.googleapis.com/v0/b/domino-martinique-v1.firebasestorage.app/o/Devises%2Fcoins.png?alt=media&token=e95a2934-2613-4f22-9a1c-676697204d97'
    },
    {
        id: 'pack_coins_large',
        name: 'Coffre de Coins',
        description: 'Obtenez 20 000 Coins.',
        type: 'CURRENCY_PACK',
        rarity: 'EPIC',
        priceDiamonds: 100,
        rewards: { coins: 20000 },
        assetId: 'coins_chest',
        imageUrl: 'https://firebasestorage.googleapis.com/v0/b/domino-martinique-v1.firebasestorage.app/o/Devises%2Fcoins.png?alt=media&token=e95a2934-2613-4f22-9a1c-676697204d97'
    }
];

async function seedStore() {
    console.log('Seeding store_catalog to Firestore...');
    const catalogRef = collection(db, 'store_catalog');

    let successCount = 0;
    let errorCount = 0;

    for (const item of STORE_CATALOG) {
        try {
            const docRef = doc(catalogRef, item.id);
            await setDoc(docRef, item);
            console.log(`✅ Injecté : ${item.name} (${item.id})`);
            successCount++;
        } catch (error) {
            console.error(`❌ Erreur pour ${item.name} :`, error);
            errorCount++;
        }
    }

    console.log(`\n🎉 Injection terminée ! Succès: ${successCount}, Erreurs: ${errorCount}`);
    process.exit(0);
}

seedStore();
