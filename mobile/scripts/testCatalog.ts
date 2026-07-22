import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { StoreService } from '../src/core/services/store.service';
import * as fs from 'fs';
import * as path from 'path';

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
const app = initializeApp({
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
});
const db = getFirestore(app);

// Quick test to see if fetching catalog works
async function run() {
    const store = new StoreService();
    console.log("Fetching catalog...");
    const catalog = await store.getCatalog();
    console.log(`Found ${catalog.length} items.`);

    // We cannot easily test purchase logic outside the RN environment without mocking AsyncStorage and Auth.
}

run().catch(console.error);
