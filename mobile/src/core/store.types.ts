import { DominoSide } from './types';

export type StoreItemType = 'SKIN' | 'AVATAR' | 'CURRENCY_PACK' | 'EMOTE';
export type StoreItemRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
export type StoreAccess = 'PUBLIC' | 'PREMIUM_ONLY';

export interface SkinConfig {
    tableBackgroundColor: string;
    boardColor?: string;          // Couleur du plateau de jeu (fallback sur tableBackgroundColor)
    dominoBackgroundColor: string;
    dominoDotColor: string;
    dominoLineColor: string;
    /** Optional per-value palette. When absent, legacy skins use one color for every half. */
    dominoValueBackgroundColors?: Partial<Record<DominoSide, string>>;
    dominoValueDotColors?: Partial<Record<DominoSide, string>>;
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
    /** Reserved for subscriber-only catalogue items. */
    isPremium?: boolean;
    access?: StoreAccess;
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
    /** Five Premium workshop designs at most; stored with the player, never as images. */
    customPremiumSkins?: { id: string; name: string; skinConfig: SkinConfig; buttonColor: string; updatedAt: number }[];
}
