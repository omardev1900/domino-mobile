import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { getAvatarImage, hasAvatarImage } from '../../core/avatars';
import { StoreItem, SkinConfig } from '../../core/store.types';

type StoreItemPreviewProps = {
    item: StoreItem;
    height?: number;
};

const DEFAULT_TABLE_COLOR = '#105B3A';
const DEFAULT_BOARD_COLOR = '#1B5E20';

function resolveAvatarKey(item: StoreItem) {
    return item.imageUrl || item.assetId || item.id;
}

function resolveSkinConfig(item: StoreItem): SkinConfig {
    return {
        tableBackgroundColor: item.skinConfig?.tableBackgroundColor ?? DEFAULT_TABLE_COLOR,
        boardColor: item.skinConfig?.boardColor ?? DEFAULT_BOARD_COLOR,
        dominoBackgroundColor: item.skinConfig?.dominoBackgroundColor ?? '#FFFFFF',
        dominoDotColor: item.skinConfig?.dominoDotColor ?? '#000000',
        dominoLineColor: item.skinConfig?.dominoLineColor ?? '#000000',
    };
}

function DominoPip({ color }: { color: string }) {
    return <View style={[styles.pip, { backgroundColor: color }]} />;
}

function DominoHalf({ color, value }: { color: string; value: 0 | 5 }) {
    if (value === 0) {
        return <View style={styles.dominoHalf} />;
    }

    return (
        <View style={styles.dominoHalf}>
            <View style={[styles.pipSlot, styles.pipTopLeft]}><DominoPip color={color} /></View>
            <View style={[styles.pipSlot, styles.pipTopRight]}><DominoPip color={color} /></View>
            <View style={[styles.pipSlot, styles.pipCenter]}><DominoPip color={color} /></View>
            <View style={[styles.pipSlot, styles.pipBottomLeft]}><DominoPip color={color} /></View>
            <View style={[styles.pipSlot, styles.pipBottomRight]}><DominoPip color={color} /></View>
        </View>
    );
}

function SingleDominoPreview({ skin }: { skin: SkinConfig }) {
    return (
        <View
            style={[
                styles.domino,
                {
                    backgroundColor: skin.dominoBackgroundColor,
                },
            ]}
        >
            <DominoHalf color={skin.dominoDotColor} value={5} />
            <View style={[styles.divider, { backgroundColor: skin.dominoLineColor }]} />
            <DominoHalf color={skin.dominoDotColor} value={0} />
        </View>
    );
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
                    <SingleDominoPreview skin={skin} />
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
        padding: 2,
    },
    board: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    domino: {
        width: '74%',
        maxWidth: 132,
        aspectRatio: 2,
        flexDirection: 'row',
        alignItems: 'stretch',
        justifyContent: 'center',
        borderRadius: 4,
    },
    dominoHalf: {
        flex: 1,
        position: 'relative',
    },
    divider: {
        width: 2,
        marginVertical: 6,
    },
    pip: {
        width: 8,
        height: 8,
        borderRadius: 8,
    },
    pipSlot: {
        position: 'absolute',
    },
    pipTopLeft: {
        left: '22%',
        top: '18%',
    },
    pipTopRight: {
        right: '22%',
        top: '18%',
    },
    pipCenter: {
        left: '50%',
        top: '50%',
        marginLeft: -4,
        marginTop: -4,
    },
    pipBottomLeft: {
        left: '22%',
        bottom: '18%',
    },
    pipBottomRight: {
        right: '22%',
        bottom: '18%',
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
