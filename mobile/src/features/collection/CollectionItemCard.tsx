import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';

import { StoreItemPreview } from '../../components/store/StoreItemPreview';
import { StoreItem } from '../../core/store.types';

interface CollectionItemCardProps {
    canDelete: boolean;
    isEquipped: boolean;
    isProcessing: boolean;
    item: StoreItem;
    onDelete: (item: StoreItem) => void;
    onEquip: (id: string) => void;
}

export function CollectionItemCard({
    canDelete,
    isEquipped,
    isProcessing,
    item,
    onDelete,
    onEquip,
}: CollectionItemCardProps) {
    const { width, height } = useWindowDimensions();
    const isLandscape = width > height;
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <Animated.View
            entering={FadeIn}
            style={[
                styles.card,
                isLandscape && styles.cardLandscape,
                isEquipped && styles.cardEquipped,
                isLandscape && { width: width * 0.24 },
            ]}
        >
            <View style={styles.content}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.cardRarity}>{item.rarity}</Text>
                    {canDelete && (
                        <TouchableOpacity
                            accessibilityLabel={`Supprimer ${item.name}`}
                            disabled={isProcessing}
                            onPress={() => onDelete(item)}
                            style={styles.deleteButton}
                        >
                            <Ionicons name="trash-outline" size={17} color="#FF7A86" />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.preview}>
                    <StoreItemPreview item={item} height={100} />
                </View>

                <View style={styles.descriptionRow}>
                    <Text style={styles.description} numberOfLines={isExpanded ? undefined : 2}>{item.description}</Text>
                    {item.description.length > 40 && (
                        <TouchableOpacity onPress={() => setIsExpanded(value => !value)} style={styles.collapseButton}>
                            <Text style={styles.collapseText}>{isExpanded ? '<<' : '>>'}</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <View style={styles.footer}>
                {isProcessing ? (
                    <ActivityIndicator color="#FFD700" size="small" />
                ) : isEquipped ? (
                    <View style={styles.equippedBadge}>
                        <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                        <Text style={styles.equippedText}>Utilisé</Text>
                    </View>
                ) : (
                    <TouchableOpacity style={styles.equipButton} onPress={() => onEquip(item.id)}>
                        <Text style={styles.equipText}>UTILISER</Text>
                    </TouchableOpacity>
                )}
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden',
    },
    cardLandscape: { height: 250 },
    cardEquipped: { borderColor: '#4CAF50', backgroundColor: 'rgba(76,175,80,0.1)' },
    content: { flex: 1 },
    cardHeader: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    cardTitle: { flex: 1, color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' },
    cardRarity: { color: '#A020F0', fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase' },
    deleteButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: 'rgba(255,90,105,0.12)' },
    preview: { height: 100, marginBottom: 8 },
    descriptionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
    description: { flex: 1, color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 17 },
    collapseButton: { paddingHorizontal: 4 },
    collapseText: { color: '#FFD700', fontSize: 12, fontWeight: 'bold' },
    footer: { minHeight: 42, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 8 },
    equipButton: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 18, paddingVertical: 7, borderRadius: 18, borderWidth: 1, borderColor: '#FFD700' },
    equipText: { color: '#FFD700', fontWeight: 'bold', fontSize: 12 },
    equippedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(76,175,80,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 6 },
    equippedText: { color: '#4CAF50', fontWeight: 'bold', fontSize: 12 },
});
