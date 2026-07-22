export type StoreItemType = 'SKIN' | 'AVATAR' | 'CURRENCY_PACK' | 'EMOTE';
export type StoreItemRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

export interface SkinConfig {
    tableBackgroundColor: string;
    boardColor?: string;          // Couleur du plateau de jeu (fallback sur tableBackgroundColor)
    dominoBackgroundColor: string;
    dominoDotColor: string;
    dominoLineColor: string;
}

export interface StoreItem {
    id: string;
    name: string;
    description: string;
    type: StoreItemType;
    rarity: StoreItemRarity;
    // Costs - can be either coins or diamonds, or both (though usually one or the other)
    priceCoins?: number;
    priceDiamonds?: number;
    // For Currency Packs: how much it gives
    rewards?: {
        coins?: number;
        diamonds?: number;
    };
    // Visual representation identifier (used to map to local assets)
    assetId: string;
    // Remote image URL from Firestore (takes precedence over assetId)
    imageUrl?: string;
    // Configuration for dynamic rendering of skins
    skinConfig?: SkinConfig;
}

export interface PlayerInventory {
    // List of owned item IDs
    ownedItems: string[];

    // Active equipped items mapping by type
    equipped: {
        avatar: string; // ID of the equipped avatar
        skin: string;   // ID of the equipped domino skin
        // roomBg?: string; // Future: ID of the equipped room background
    };
}
