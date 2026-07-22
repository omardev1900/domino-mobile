const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env if running from script
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
        assetId: 'default'
    },
    {
        id: 'avatar_pig_mask',
        name: 'Cochon Masqué',
        description: 'Un avatar pour ceux qui bluffent bien.',
        type: 'AVATAR',
        rarity: 'RARE',
        priceCoins: 1500,
        assetId: 'pig_mask'
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
        id: 'skin_royal',
        name: 'Skin Royal',
        description: 'Orné de dorures pour les champions.',
        type: 'SKIN',
        rarity: 'EPIC',
        priceCoins: 15000,
        priceDiamonds: 100,
        assetId: 'royal'
    },
    {
        id: 'skin_obsidian',
        name: 'Obsidienne',
        description: 'Sombre, lourd et mystérieux.',
        type: 'SKIN',
        rarity: 'LEGENDARY',
        priceDiamonds: 300,
        assetId: 'obsidian'
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
        rarity: 'RARE',
        priceCoins: 12000,
        assetId: 'wood'
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

async function seedStore() {
    console.log('Seeding store_catalog to Firestore...');
    const catalogRef = collection(db, 'store_catalog');

    let successCount = 0;
    let errorCount = 0;

    for (const item of STORE_CATALOG) {
        try {
            // Document ID matches the item ID for consistency
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
