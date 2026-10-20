import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { getAvatarImage, hasAvatarImage } from '../../core/avatars';
import { StoreItem, SkinConfig } from '../../core/store.types';
import { DominoTile } from '../DominoTile';

type StoreItemPreviewProps = {
    item: StoreItem;
    height?: number;
};

const DEFAULT_TABLE_COLOR = '#105B3A';
const DEFAULT_BOARD_COLOR = '#1B5E20';

function resolveAvatarKey(item: StoreItem) {
    // Les avatars Premium sont embarqués dans l'APK. Les autres avatars de
    // boutique peuvent n'avoir qu'une URL Storage : cette URL doit alors
    // rester prioritaire sur l'asset fallback par défaut.
    if (item.isPremium && item.assetId && hasAvatarImage(item.assetId)) return item.assetId;
    return item.imageUrl || item.assetId || item.id;
}

function resolveSkinConfig(item: StoreItem): SkinConfig {
    return {
        tableBackgroundColor: item.skinConfig?.tableBackgroundColor ?? DEFAULT_TABLE_COLOR,
        boardColor: item.skinConfig?.boardColor ?? DEFAULT_BOARD_COLOR,
        dominoBackgroundColor: item.skinConfig?.dominoBackgroundColor ?? '#FFFFFF',
        dominoDotColor: item.skinConfig?.dominoDotColor ?? '#000000',
        dominoLineColor: item.skinConfig?.dominoLineColor ?? '#000000',
        dominoValueBackgroundColors: item.skinConfig?.dominoValueBackgroundColors,
        dominoValueDotColors: item.skinConfig?.dominoValueDotColors,
    };
}

export function StoreItemPreview({ item, height = 100 }: StoreItemPreviewProps) {
    if (item.type === 'AVATAR') {
        const avatarKey = resolveAvatarKey(item);
        const canRenderAvatar = !!item.imageUrl || hasAvatarImage(avatarKey);

        return (
            <View style={[styles.frame, { height }]}>
                {canRenderAvatar ? (
                    <Image
                        source={getAvatarImage(avatarKey)}
                        style={styles.avatarImage}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                    />
                ) : (
                    <View style={styles.avatarFallback}>
                        <Ionicons name="person" size={30} color="rgba(255,255,255,0.72)" />
                        <Text style={styles.avatarFallbackText} numberOfLines={1}>
                            {item.name}
                        </Text>
                    </View>
                )}
            </View>
        );
    }

    if (item.type === 'SKIN') {
        const skin = resolveSkinConfig(item);
        return (
            <View style={[styles.frame, styles.skinFrame, { height, backgroundColor: skin.tableBackgroundColor }]}>
                <View style={[styles.board, { backgroundColor: skin.boardColor ?? skin.tableBackgroundColor }]}>
                    <DominoTile
                        left={5}
                        right={0}
                        size={Math.max(30, Math.min(44, height * 0.36))}
                        orientation="horizontal"
                        skinConfig={skin}
                        noMargin
                        animateOnMount={false}
                        disablePressScale
                    />
                </View>
            </View>
        );
    }

    if (item.type === 'CURRENCY_PACK' && item.imageUrl) {
        return (
            <View style={[styles.frame, { height }]}>
                <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.avatarImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                />
                {item.rewards?.coins ? (
                    <Text style={styles.currencyOverlayText}>{item.rewards.coins.toLocaleString('fr-FR')}</Text>
                ) : null}
            </View>
        );
    }

    return (
        <View style={[styles.frame, styles.iconFallback, { height }]}>
            <Ionicons
                name={item.type === 'CURRENCY_PACK' ? 'diamond' : 'cube'}
                size={34}
                color="rgba(255,255,255,0.55)"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    frame: {
        width: '100%',
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: 'rgba(0,0,0,0.22)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarFallback: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 10,
    },
    avatarFallbackText: {
        color: 'rgba(255,255,255,0.68)',
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'center',
    },
    skinFrame: {
        borderRadius: 0,
        padding: 2,
    },
    board: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    iconFallback: {
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    currencyOverlayText: {
        position: 'absolute',
        color: '#FFD700',
        fontSize: 24,
        fontWeight: '900',
        textShadowColor: 'rgba(0, 0, 0, 0.85)',
        textShadowOffset: { width: 2, height: 2 },
        textShadowRadius: 4,
    },
});
