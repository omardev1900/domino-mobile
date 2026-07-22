import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, query, where, limit } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Load env vars
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

const LOCAL_BOTS_FALLBACK = {
    'TI_MANMAY': [
        { name: 'Ti-Sonson', avatarId: 'avatar_ti_sonson', difficulty: 'TI_MANMAY' },
        { name: 'Man-Yaya', avatarId: 'avatar_man_yaya', difficulty: 'TI_MANMAY' },
        { name: 'Doudou', avatarId: 'avatar_doudou', difficulty: 'TI_MANMAY' },
        { name: 'Chabin', avatarId: 'avatar_chabin', difficulty: 'TI_MANMAY' },
        { name: 'Fifine', avatarId: 'avatar_fifine', difficulty: 'TI_MANMAY' }
    ],
    'MAPIPI': [
        { name: 'Dédé', avatarId: 'avatar_dede', difficulty: 'MAPIPI' },
        { name: 'Maxime', avatarId: 'avatar_maxime', difficulty: 'MAPIPI' },
        { name: 'Tatie', avatarId: 'avatar_tatie', difficulty: 'MAPIPI' },
        { name: 'Jojo', avatarId: 'avatar_jojo', difficulty: 'MAPIPI' },
        { name: 'Béké', avatarId: 'avatar_beke', difficulty: 'MAPIPI' }
    ],
    'GRAN_MOUN': [
        { name: 'Tonton-Léon', avatarId: 'avatar_tonton_leon', difficulty: 'GRAN_MOUN' },
        { name: 'Eudorge', avatarId: 'avatar_eudorge', difficulty: 'GRAN_MOUN' },
        { name: 'Man-Zouzou', avatarId: 'avatar_man_zouzou', difficulty: 'GRAN_MOUN' },
        { name: 'Papi-Jo', avatarId: 'avatar_papi_jo', difficulty: 'GRAN_MOUN' },
        { name: 'Tante-Rose', avatarId: 'avatar_tante_rose', difficulty: 'GRAN_MOUN' }
    ]
};

async function seedBots() {
    try {
        console.log("Starting to seed bots into Firestore...");

        const botsRef = collection(db, 'bots');
        let count = 0;

        for (const [level, bots] of Object.entries(LOCAL_BOTS_FALLBACK)) {
            for (const bot of bots) {
                const q = query(botsRef, where('name', '==', bot.name), limit(1));
                const snapshot = await getDocs(q);
                if (snapshot.empty) {
                    await addDoc(botsRef, bot);
                    console.log(`Added bot: ${bot.name} (${level})`);
                    count++;
                } else {
                    console.log(`Bot already exists, skipping: ${bot.name}`);
                }
            }
        }

        console.log(`Seeding complete! Added ${count} new bots.`);
        process.exit(0);
    } catch (e) {
        fs.writeFileSync(path.join(__dirname, 'bots_error.json'), JSON.stringify(e, Object.getOwnPropertyNames(e), 2));
        process.exit(1);
    }
}

seedBots();
