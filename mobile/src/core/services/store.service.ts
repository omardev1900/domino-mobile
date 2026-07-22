import { db } from './firebase';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StoreItem, PlayerInventory, StoreItemType, StoreItemRarity } from '../store.types';
import { economyService } from './economy.service';
import { authService } from './auth.service';
import { DEFAULT_INVENTORY } from '../store.constants';

const STORE_COLLECTION = 'store_catalog';
const STORAGE_KEY_GUEST_INVENTORY = '@guest_inventory';

export class StoreService {

    /**
     * Get the current player's inventory
     * Hybride : Firestore si connecté, AsyncStorage si invité.
     */
    async getInventory(uid?: string): Promise<PlayerInventory> {
        const currentUser = await authService.getCurrentUser();
        const userId = uid || currentUser?.uid;

        if (userId && !userId.startsWith('guest_')) {
            try {
                const userRef = doc(db, 'users', userId);
                const snap = await getDoc(userRef);
                if (snap.exists() && snap.data().inventory) {
                    return snap.data().inventory as PlayerInventory;
                }
            } catch (e) {
                console.error("Error reading inventory from Firebase", e);
            }
        }

        try {
            const json = await AsyncStorage.getItem(STORAGE_KEY_GUEST_INVENTORY);
            if (json) {
                return JSON.parse(json) as PlayerInventory;
            }
        } catch (e) {
            console.error("Error reading guest inventory", e);
        }

        return DEFAULT_INVENTORY;
    }

    /**
     * Save inventory to the correct storage (Hybrid)
     */
    private async saveInventory(inventory: PlayerInventory, uid?: string): Promise<void> {
        const currentUser = await authService.getCurrentUser();
        const userId = uid || currentUser?.uid;

        if (userId && !userId.startsWith('guest_')) {
            try {
                const userRef = doc(db, 'users', userId);
                await setDoc(userRef, { inventory }, { merge: true });
                console.log("☁️ Inventory saved to Firebase");
            } catch (e) {
                console.error("Error saving inventory to Firebase", e);
            }
        }

        try {
            await AsyncStorage.setItem(STORAGE_KEY_GUEST_INVENTORY, JSON.stringify(inventory));
        } catch (e) {
            console.error("Error saving guest inventory", e);
        }
    }

    async getCatalog(): Promise<StoreItem[]> {
        try {
            const querySnapshot = await getDocs(collection(db, STORE_COLLECTION));
            const catalog: StoreItem[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                catalog.push({
                    id: doc.id,
                    name: data.name || 'Unnamed Item',
                    description: data.description || '',
                    type: data.type as StoreItemType,
                    rarity: data.rarity as StoreItemRarity,
                    priceCoins: data.priceCoins,
                    priceDiamonds: data.priceDiamonds,
                    rewards: data.rewards,
                    assetId: data.assetId || 'default',
                    imageUrl: data.imageUrl,
                    skinConfig: data.skinConfig,
                });
            });
            return catalog;
        } catch (error) {
            console.error("Error fetching catalog from Firestore:", error);
            return []; // Fallback to empty if network issue
        }
    }

    /**
     * Check if an item is already owned
     */
    async isItemOwned(itemId: string): Promise<boolean> {
        const inventory = await this.getInventory();
        return inventory.ownedItems.includes(itemId);
    }

    /**
     * Equip an item that the player owns
     */
    async equipItem(itemId: string, userId?: string): Promise<{ success: boolean; message?: string }> {
        const catalog = await this.getCatalog();
        const item = catalog.find(i => i.id === itemId);
        if (!item) return { success: false, message: "Item introuvable" };

        const inventory = await this.getInventory();
        if (!inventory.ownedItems.includes(itemId)) {
            return { success: false, message: "Vous ne possédez pas cet objet." };
        }

        // Apply equipment mapping
        const newInventory = JSON.parse(JSON.stringify(inventory)) as PlayerInventory;
        if (item.type === 'AVATAR') {
            newInventory.equipped.avatar = itemId;
            // Sync with global auth profile to update everywhere. Prefer imageUrl if available (remote), fallback to assetId (local string)
            const photoToSync = item.imageUrl ? item.imageUrl : item.assetId;
            await authService.updateProfile({ photoURL: photoToSync });
        } else if (item.type === 'SKIN') {
            newInventory.equipped.skin = itemId;
        } else {
            return { success: false, message: "Cet objet ne peut pas être équipé." };
        }

        await this.saveInventory(newInventory, userId);
        return { success: true };
    }

    /**
     * Purchase an item (Cosmetic or Currency Pack)
     */
    async purchaseItem(itemId: string, userId?: string): Promise<{ success: boolean; message?: string }> {
        const catalog = await this.getCatalog();
        const item = catalog.find(i => i.id === itemId);
        if (!item) return { success: false, message: "Item introuvable" };

        // 1. Check if already owned for non-consumables
        if (item.type !== 'CURRENCY_PACK') {
            const isOwned = await this.isItemOwned(item.id);
            if (isOwned) {
                return { success: false, message: "Vous possédez déjà cet objet." };
            }
        }

        // 2. Check funds
        const economy = await economyService.getEconomy();

        if (item.priceCoins && economy.coins < item.priceCoins) {
            return { success: false, message: "Fonds insuffisants (Coins)." };
        }
        if (item.priceDiamonds && economy.diamonds < item.priceDiamonds) {
            return { success: false, message: "Fonds insuffisants (Diamants)." };
        }

        // 3. Deduct funds
        const updatedEconomy = { ...economy };
        if (item.priceCoins) updatedEconomy.coins -= item.priceCoins;
        if (item.priceDiamonds) updatedEconomy.diamonds -= item.priceDiamonds;

        const currentUserId = userId || (await authService.getCurrentUser())?.uid;

        try {
            // 4. Save updated economy FIRST (transactional priority)
            await economyService.setEconomy(updatedEconomy, currentUserId);
        } catch (e) {
            console.error("Erreur lors du débit pour l'achat :", e);
            return { success: false, message: "Erreur lors de la transaction financière." };
        }

        // 5. Apply rewards and grants ONLY IF economy deduction succeeded
        if (item.type === 'CURRENCY_PACK' && item.rewards) {
            // Re-fetch economy as it was just updated above
            const currentEconomy = await economyService.getEconomy();
            const packEconomy = { ...currentEconomy };
            if (item.rewards.coins) packEconomy.coins += item.rewards.coins;
            if (item.rewards.diamonds) packEconomy.diamonds += item.rewards.diamonds;
            await economyService.setEconomy(packEconomy, currentUserId);
        } else {
            // Add to inventory
            const inventory = await this.getInventory();
            const newInventory = JSON.parse(JSON.stringify(inventory)) as PlayerInventory;
            newInventory.ownedItems.push(item.id);
            await this.saveInventory(newInventory, currentUserId);
        }

        return { success: true };
    }
}

export const storeService = new StoreService();
