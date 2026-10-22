import { PlayerInventory } from './store.types';
import { DEFAULT_INVENTORY } from './store.constants';

/** Removes a cosmetic while keeping equipment references valid. */
export function removeInventoryEntry(inventory: PlayerInventory, itemId: string): PlayerInventory {
    const nextInventory = structuredClone(inventory);
    nextInventory.ownedItems = nextInventory.ownedItems.filter(id => id !== itemId);
    nextInventory.customPremiumSkins = nextInventory.customPremiumSkins?.filter(design => design.id !== itemId);

    if (nextInventory.equipped.avatar === itemId) {
        nextInventory.equipped.avatar = DEFAULT_INVENTORY.equipped.avatar;
    }
    if (nextInventory.equipped.skin === itemId) {
        nextInventory.equipped.skin = DEFAULT_INVENTORY.equipped.skin;
    }

    return nextInventory;
}
