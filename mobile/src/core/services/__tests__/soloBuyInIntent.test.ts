import AsyncStorage from '@react-native-async-storage/async-storage';
import { SoloBuyInIntentStore } from '../soloBuyInIntent';

jest.mock('@react-native-async-storage/async-storage', () => {
    const values = new Map<string, string>();
    return { __esModule: true, default: {
        getItem: jest.fn(async (key: string) => values.get(key) ?? null),
        setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
        removeItem: jest.fn(async (key: string) => { values.delete(key); }),
        clear: jest.fn(async () => { values.clear(); }),
    } };
});

describe('identité de mise solo', () => {
    beforeEach(async () => { await AsyncStorage.clear(); });
    it('réutilise la même tentative après redémarrage et appels concurrents', async () => {
        const first = new SoloBuyInIntentStore();
        const [a, b] = await Promise.all([first.getOrCreate('joueur'), first.getOrCreate('joueur')]);
        expect(a).toBe(b);
        expect(await new SoloBuyInIntentStore().getOrCreate('joueur')).toBe(a);
    });
    it('sépare les comptes et ne supprime pas une autre tentative', async () => {
        const store = new SoloBuyInIntentStore();
        const a = await store.getOrCreate('joueur-a');
        const b = await store.getOrCreate('joueur-b');
        expect(a).not.toBe(b);
        await store.clear('joueur-a', 'ancienne-tentative');
        expect(await store.getOrCreate('joueur-a')).toBe(a);
        await store.clear('joueur-a', a);
        expect(await store.getOrCreate('joueur-a')).not.toBe(a);
        expect(await store.getOrCreate('joueur-b')).toBe(b);
    });
});
