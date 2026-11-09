import AsyncStorage from '@react-native-async-storage/async-storage';

/** Stable local identity for retrying a single pending solo buy-in. */
export class SoloBuyInIntentStore {
    private readonly pending = new Map<string, Promise<string>>();
    private key(uid: string) { return `@solo_buyin_pending:${uid}`; }

    async getOrCreate(uid: string): Promise<string> {
        if (!uid) throw new Error('Connexion requise.');
        const existing = this.pending.get(uid);
        if (existing) return existing;
        const task = (async () => {
            const saved = await AsyncStorage.getItem(this.key(uid));
            if (saved) return saved;
            const id = `solo_${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
            await AsyncStorage.setItem(this.key(uid), id);
            return id;
        })();
        this.pending.set(uid, task);
        try { return await task; }
        finally { if (this.pending.get(uid) === task) this.pending.delete(uid); }
    }

    /** Only clear the intended attempt; never erase a more recent one. */
    async clear(uid: string, id: string): Promise<void> {
        if (!uid || !id) return;
        const pending = this.pending.get(uid);
        if (pending) await pending;
        if (await AsyncStorage.getItem(this.key(uid)) === id) await AsyncStorage.removeItem(this.key(uid));
    }
}
export const soloBuyInIntents = new SoloBuyInIntentStore();
