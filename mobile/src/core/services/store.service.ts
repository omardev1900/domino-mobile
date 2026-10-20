import { db } from './firebase';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StoreItem, PlayerInventory, StoreItemType, StoreItemRarity } from '../store.types';
import { economyService } from './economy.service';
import { authService } from './auth.service';
import { DEFAULT_INVENTORY, STORE_CATALOG } from '../store.constants';
import { premiumService } from './premium.service';
import { hasAvatarImage } from '../avatars';

const STORE_COLLECTION = 'store_catalog';
const STORAGE_KEY_GUEST_INVENTORY = '@guest_inventory';
const IS_DEVELOPMENT = typeof __DEV__ !== 'undefined' && __DEV__;

/** Keep bundled Premium cosmetics visible while their Firestore record is being rolled out. */
function mergeBundledPremiumItems(catalog: StoreItem[]): StoreItem[] {
    const bundledPremiumById = new Map(
        STORE_CATALOG.filter(item => item.isPremium).map(item => [item.id, item]),
    );
    // Les tarifs et palettes Premium embarqués font autorité pendant le
    // déploiement Firestore, afin que tous les clients appliquent la même offre.
    const merged = catalog.map(item => bundledPremiumById.get(item.id) ?? item);
    const missingPremiumItems = [...bundledPremiumById.values()].filter(
        item => !catalog.some(catalogItem => catalogItem.id === item.id),
    );
    return [...merged, ...missingPremiumItems];
}

/**
 * Premium cosmetics remain in the player's inventory so they return after a
 * renewed subscription, but cannot be displayed or equipped while access is
 * inactive.
 */
export function getAccessibleInventory(
    inventory: PlayerInventory,
    catalog: StoreItem[],
    hasPremium: boolean,
): PlayerInventory {
    if (hasPremium) return inventory;

    const premiumItemIds = new Set(catalog.filter(item => item.isPremium).map(item => item.id));
    const accessibleInventory = structuredClone(inventory);
    accessibleInventory.ownedItems = accessibleInventory.ownedItems.filter(itemId => !premiumItemIds.has(itemId));

    if (premiumItemIds.has(accessibleInventory.equipped.avatar)) {
        accessibleInventory.equipped.avatar = DEFAULT_INVENTORY.equipped.avatar;
    }
    if (premiumItemIds.has(accessibleInventory.equipped.skin)) {
        accessibleInventory.equipped.skin = DEFAULT_INVENTORY.equipped.skin;
    }
    if (accessibleInventory.equipped.skin.startsWith('custom_premium_')) {
        accessibleInventory.equipped.skin = DEFAULT_INVENTORY.equipped.skin;
    }

    return accessibleInventory;
}

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
                    // Un avatar administré peut ne posséder qu'une image Storage.
                    // Ne pas injecter l'asset "default" : l'aperçu choisirait alors
                    // la silhouette noire au lieu de cette image distante valide.
                    assetId: typeof data.assetId === 'string' ? data.assetId : '',
                    imageUrl: data.imageUrl,
                    skinConfig: data.skinConfig,
                    isPremium: data.isPremium === true,
                });
            });
            return mergeBundledPremiumItems(catalog);
        } catch (error) {
            console.error("Error fetching catalog from Firestore:", error);
            return mergeBundledPremiumItems([]);
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
        // Les écrans de profil manipulent l'assetId pour afficher l'avatar,
        // tandis que la boutique utilise l'id de l'article. Accepter les deux
        // formes évite qu'un avatar Premium déjà acheté devienne inutilisable.
        const item = catalog.find(i => i.id === itemId || (i.type === 'AVATAR' && i.assetId === itemId));
        if (!item) return { success: false, message: "Item introuvable" };

        if (item.isPremium && !IS_DEVELOPMENT && !(await premiumService.hasActiveAccess(userId))) {
            return { success: false, message: 'Cet objet est réservé aux abonnés Premium.' };
        }

        const inventory = await this.getInventory();
        if (!inventory.ownedItems.includes(item.id)) {
            return { success: false, message: "Vous ne possédez pas cet objet." };
        }

        // Apply equipment mapping
        const newInventory = structuredClone(inventory);
        if (item.type === 'AVATAR') {
            newInventory.equipped.avatar = item.id;
            // Les avatars Premium sont embarqués pour être disponibles hors
            // ligne. Les avatars classiques de la boutique, eux, utilisent
            // leur image Storage (sinon un assetId vide tombait sur default).
            const photoToSync = item.isPremium && item.assetId && hasAvatarImage(item.assetId)
                ? item.assetId
                : (item.imageUrl || item.assetId || item.id);
            await authService.updateProfile({ photoURL: photoToSync });
        } else if (item.type === 'SKIN') {
            newInventory.equipped.skin = itemId;
        } else {
            return { success: false, message: "Cet objet ne peut pas être équipé." };
        }

        await this.saveInventory(newInventory, userId);
        return { success: true };
    }

    async savePremiumCustomSkin(
        design: { id?: string; name: string; skinConfig: StoreItem['skinConfig']; buttonColor: string },
        userId?: string,
    ): Promise<{ success: boolean; id?: string; message?: string }> {
        if (!design.skinConfig || !(await premiumService.hasActiveAccess(userId))) {
            return { success: false, message: 'L’Atelier est réservé aux membres Premium actifs.' };
        }
        const inventory = await this.getInventory(userId);
        if (!inventory.ownedItems.includes('skin_premium_atelier')) {
            return { success: false, message: 'Achète d’abord l’Atelier Premium.' };
        }
        const designs = inventory.customPremiumSkins ?? [];
        const id = design.id ?? `custom_premium_${Date.now()}`;
        const exists = designs.some(item => item.id === id);
        if (!exists && designs.length >= 5) {
            return { success: false, message: 'Tu peux enregistrer jusqu’à cinq créations.' };
        }
        const nextDesign = { id, name: design.name.trim() || `Création ${designs.length + 1}`, skinConfig: design.skinConfig, buttonColor: design.buttonColor, updatedAt: Date.now() };
        const nextInventory = structuredClone(inventory);
        nextInventory.customPremiumSkins = exists
            ? designs.map(item => item.id === id ? nextDesign : item)
            : [...designs, nextDesign];
        nextInventory.equipped.skin = id;
        await this.saveInventory(nextInventory, userId);
        return { success: true, id };
    }

    async equipPremiumCustomSkin(id: string, userId?: string): Promise<{ success: boolean; message?: string }> {
        if (!(await premiumService.hasActiveAccess(userId))) return { success: false, message: 'Cet objet est réservé aux abonnés Premium.' };
        const inventory = await this.getInventory(userId);
        if (!(inventory.customPremiumSkins ?? []).some(item => item.id === id)) return { success: false, message: 'Création introuvable.' };
        const nextInventory = structuredClone(inventory);
        nextInventory.equipped.skin = id;
        await this.saveInventory(nextInventory, userId);
        return { success: true };
    }

    /** Reset active Premium cosmetics when an entitlement expires, without deleting ownership. */
    async removeExpiredPremiumEquipment(userId?: string): Promise<void> {
        if (await premiumService.hasActiveAccess(userId)) return;

        const [catalog, inventory] = await Promise.all([
            this.getCatalog(),
            this.getInventory(userId),
        ]);
        const accessibleInventory = getAccessibleInventory(inventory, catalog, false);
        const resetInventory = {
            ...accessibleInventory,
            ownedItems: inventory.ownedItems,
        };
        const equipmentChanged = resetInventory.equipped.avatar !== inventory.equipped.avatar
            || resetInventory.equipped.skin !== inventory.equipped.skin;

        if (!equipmentChanged) return;

        await this.saveInventory(resetInventory, userId);
        if (resetInventory.equipped.avatar !== inventory.equipped.avatar) {
            await authService.updateProfile({ photoURL: 'avatar_default' });
        }
    }

    /**
     * Purchase an item (Cosmetic or Currency Pack)
     */
    async purchaseItem(itemId: string, userId?: string): Promise<{ success: boolean; message?: string }> {
        const catalog = await this.getCatalog();
        const item = catalog.find(i => i.id === itemId);
        if (!item) return { success: false, message: "Item introuvable" };

        if (item.isPremium && !IS_DEVELOPMENT && !(await premiumService.hasActiveAccess(userId))) {
            return { success: false, message: "Cet objet est réservé aux abonnés Premium." };
        }

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
            const newInventory = structuredClone(inventory);
            newInventory.ownedItems.push(item.id);
            await this.saveInventory(newInventory, currentUserId);
        }

        return { success: true };
    }
}

export const storeService = new StoreService();
