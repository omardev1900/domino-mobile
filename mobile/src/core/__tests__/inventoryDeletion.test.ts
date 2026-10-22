import { removeInventoryEntry } from '../inventoryDeletion';
import { PlayerInventory } from '../store.types';

const inventory = (): PlayerInventory => ({
    ownedItems: ['avatar_classic', 'skin_classic', 'avatar_king', 'skin_premium_spectrum'],
    equipped: { avatar: 'avatar_king', skin: 'custom_premium_1' },
    customPremiumSkins: [{
        id: 'custom_premium_1',
        name: 'Madras',
        buttonColor: '#FFD700',
        updatedAt: 1,
        skinConfig: {
            tableBackgroundColor: '#18391E',
            dominoBackgroundColor: '#F8E9D2',
            dominoDotColor: '#1F2430',
            dominoLineColor: '#FFD700',
        },
    }],
});

describe('removeInventoryEntry', () => {
    it('removes a catalogue item and restores the default avatar when equipped', () => {
        const result = removeInventoryEntry(inventory(), 'avatar_king');

        expect(result.ownedItems).not.toContain('avatar_king');
        expect(result.equipped.avatar).toBe('avatar_classic');
    });

    it('removes a custom skin and restores the default skin when equipped', () => {
        const result = removeInventoryEntry(inventory(), 'custom_premium_1');

        expect(result.customPremiumSkins).toEqual([]);
        expect(result.equipped.skin).toBe('skin_classic');
    });

    it('does not mutate the original inventory', () => {
        const original = inventory();
        removeInventoryEntry(original, 'avatar_king');

        expect(original.ownedItems).toContain('avatar_king');
        expect(original.customPremiumSkins).toHaveLength(1);
    });
});
