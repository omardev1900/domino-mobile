import React, { useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, useWindowDimensions, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';

import { StoreItemPreview } from '../src/components/store/StoreItemPreview';
import { storeService } from '../src/core/services/store.service';
import { StoreItem, StoreItemType, PlayerInventory } from '../src/core/store.types';

type TabType = 'ALL' | StoreItemType;

export default function CollectionScreen() {
    const { width, height } = useWindowDimensions();
    const isLandscape = width > height;

    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabType>('ALL');
    const [inventory, setInventory] = useState<PlayerInventory | null>(null);
    const [ownedItems, setOwnedItems] = useState<StoreItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingEquip, setProcessingEquip] = useState<string | null>(null);

    const loadData = async () => {
        try {
            const [inv, cat] = await Promise.all([
                storeService.getInventory(),
                storeService.getCatalog(),
            ]);
            setInventory(inv);
            setOwnedItems(
                cat.filter(item => item.type !== 'CURRENCY_PACK' && inv.ownedItems.includes(item.id))
            );
        } catch (error) {
            console.error('Failed to load collection data', error);
        } finally {
            setLoading(false);
        }
    };

    const dynamicTabs = useMemo(() => {
        const types = Array.from(new Set(ownedItems.map(item => item.type)));
        const tabs: { id: TabType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
            { id: 'ALL', label: 'Tout', icon: 'grid' },
        ];

        if (types.includes('AVATAR')) tabs.push({ id: 'AVATAR', label: 'Avatars', icon: 'person' });
        if (types.includes('SKIN')) tabs.push({ id: 'SKIN', label: 'Skins', icon: 'color-palette' });
        if (types.includes('EMOTE')) tabs.push({ id: 'EMOTE', label: 'Emotions', icon: 'happy' });

        return tabs;
    }, [ownedItems]);


    useFocusEffect(
        useCallback(() => {
            loadData();

        }, [])
    );

    const handleEquip = async (itemId: string) => {
        setProcessingEquip(itemId);
        const result = await storeService.equipItem(itemId);

        if (result.success) {
            await loadData();
        } else if (Platform.OS === 'web') {
            window.alert(result.message || "Impossible d'équiper cet objet.");
        } else {
            Alert.alert('Erreur', result.message || "Impossible d'équiper cet objet.");
        }

        setProcessingEquip(null);
    };

    const filteredItems = activeTab === 'ALL'
        ? ownedItems
        : ownedItems.filter(item => item.type === activeTab);

    const CollectionItem = ({
        item,
        isEquipped,
        onEquip,
        isProcessing,
    }: {
        item: StoreItem;
        isEquipped: boolean;
        onEquip: (id: string) => void;
        isProcessing: boolean;
    }) => {
        const { width: currentWidth, height: currentHeight } = useWindowDimensions();
        const cardLandscape = currentWidth > currentHeight;
        const [isExpanded, setIsExpanded] = useState(false);

        return (
            <Animated.View
                entering={FadeIn}
                key={item.id}
                style={[
                    styles.card,
                    cardLandscape && styles.cardLandscape,
                    isEquipped && styles.cardEquipped,
                    cardLandscape && { width: currentWidth * 0.24 },
                ]}
            >
                <View style={{ flex: 1 }}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.cardRarity}>{item.rarity}</Text>
                    </View>

                    <View style={styles.cardImagePlaceholder}>
                        <StoreItemPreview item={item} height={100} />
                    </View>

                    <View style={styles.descriptionRow}>
                        <Text style={styles.cardDescription} numberOfLines={isExpanded ? undefined : 2}>
                            {item.description}
                        </Text>
                        {item.description && item.description.length > 40 ? (
                            <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)} style={styles.collapseBtn}>
                                <Text style={styles.collapseBtnText}>{isExpanded ? '<<' : '>>'}</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>

                <View style={styles.cardFooter}>
                    {isProcessing ? (
                        <ActivityIndicator color="#FFD700" size="small" />
                    ) : isEquipped ? (
                        <View style={styles.equippedBadge}>
                            <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                            <Text style={styles.equippedText}>Utilisé</Text>
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.equipButton} onPress={() => onEquip(item.id)}>
                            <Text style={styles.equipButtonText}>UTILISER</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </Animated.View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient colors={['#0F2027', '#203A43', '#2C5364']} style={StyleSheet.absoluteFillObject} />

            <View style={styles.header}>
                <View style={styles.headerTabsContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.headerTabsScroll}>
                        {dynamicTabs.map(tab => {
                            const isActive = activeTab === tab.id;
                            return (
                                <TouchableOpacity
                                    key={tab.id}
                                    style={[styles.headerTab, isActive && styles.activeHeaderTab]}
                                    onPress={() => setActiveTab(tab.id)}
                                >
                                    <Ionicons name={tab.icon} size={14} color={isActive ? '#1A0E2E' : '#FFF'} />
                                    {isLandscape ? (
                                        <Text style={[styles.headerTabText, isActive && styles.activeHeaderTabText]}>
                                            {tab.label}
                                        </Text>
                                    ) : null}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            </View>

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#FFD700" />
                </View>
            ) : ownedItems.length === 0 ? (
                <View style={styles.centerContainer}>
                    <Ionicons name="sad-outline" size={64} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.emptyText}>Votre vestiaire est vide.</Text>
                    <Text style={styles.emptySubText}>Visitez la boutique pour acquérir de nouveaux objets !</Text>
                    <TouchableOpacity style={styles.goToStoreButton} onPress={() => router.push('/store')}>
                        <Text style={styles.goToStoreText}>Aller à la Boutique</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[styles.grid, isLandscape && styles.gridLandscape]}
                    snapToInterval={width * 0.24 + 16}
                    decelerationRate="fast"
                >
                    {filteredItems.map(item => {
                        const isEquipped = inventory
                            ? item.type === 'AVATAR'
                                ? inventory.equipped.avatar === item.id
                                : item.type === 'SKIN'
                                    ? inventory.equipped.skin === item.id
                                    : false
                            : false;

                        return (
                            <CollectionItem
                                key={item.id}
                                item={item}
                                isEquipped={!!isEquipped}
                                onEquip={handleEquip}
                                isProcessing={processingEquip === item.id}
                            />
                        );
                    })}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F2027',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 5,
    },
    headerTabsContainer: {
        flex: 1,
        maxWidth: '65%',
    },
    headerTabsScroll: {
        paddingRight: 10,
        gap: 8,
        alignItems: 'center',
    },
    headerTab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        gap: 6,
    },
    activeHeaderTab: {
        backgroundColor: '#FFD700',
        borderColor: '#FFD700',
    },
    headerTabText: {
        color: '#FFF',
        fontWeight: '600',
        fontSize: 12,
    },
    activeHeaderTabText: {
        color: '#1A0E2E',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 20,
    },
    emptySubText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 16,
        textAlign: 'center',
        marginTop: 10,
        marginBottom: 30,
    },
    goToStoreButton: {
        backgroundColor: '#FFD700',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 25,
    },
    goToStoreText: {
        color: '#1A0E2E',
        fontWeight: 'bold',
        fontSize: 16,
    },
    grid: {
        paddingHorizontal: 20,
        paddingBottom: 20,
        gap: 16,
    },
    gridLandscape: {
        flexDirection: 'row',
        flexWrap: 'nowrap',
        alignItems: 'center',
    },
    card: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
    },
    cardEquipped: {
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
    },
    cardLandscape: {
        height: 250,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    cardTitle: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: 'bold',
        flex: 1,
    },
    cardRarity: {
        color: '#A020F0',
        fontSize: 9,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    cardImagePlaceholder: {
        height: 100,
        marginBottom: 8,
    },
    cardDescription: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        marginBottom: 16,
        lineHeight: 20,
        flex: 1,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        paddingTop: 12,
        minHeight: 48,
    },
    equipButton: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#FFD700',
    },
    equipButtonText: {
        color: '#FFD700',
        fontWeight: 'bold',
        fontSize: 14,
    },
    equippedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(76, 175, 80, 0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 6,
    },
    equippedText: {
        color: '#4CAF50',
        fontWeight: 'bold',
        fontSize: 14,
    },
    descriptionRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 4,
    },
    collapseBtn: {
        paddingHorizontal: 4,
    },
    collapseBtnText: {
        color: '#FFD700',
        fontSize: 12,
        fontWeight: 'bold',
    },
});
