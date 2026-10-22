import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, useWindowDimensions, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';

import { getAccessibleInventory, storeService } from '../src/core/services/store.service';
import { premiumService } from '../src/core/services/premium.service';
import { StoreItem, StoreItemType, PlayerInventory } from '../src/core/store.types';
import { DEFAULT_OWNED_ITEMS } from '../src/core/store.constants';
import { CollectionItemCard } from '../src/features/collection/CollectionItemCard';

type TabType = 'ALL' | StoreItemType;
const SKIN_CREATOR_ID = 'skin_premium_atelier';

export default function CollectionScreen() {
    const { width, height } = useWindowDimensions();
    const isLandscape = width > height;

    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabType>('ALL');
    const [inventory, setInventory] = useState<PlayerInventory | null>(null);
    const [ownedItems, setOwnedItems] = useState<StoreItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingEquip, setProcessingEquip] = useState<string | null>(null);
    const [processingDelete, setProcessingDelete] = useState<string | null>(null);

    const loadData = async () => {
        try {
            const [inv, cat, hasPremium] = await Promise.all([
                storeService.getInventory(),
                storeService.getCatalog(),
                premiumService.hasActiveAccess(),
            ]);
            const accessibleInventory = getAccessibleInventory(inv, cat, hasPremium);
            const customSkins: StoreItem[] = hasPremium
                ? (accessibleInventory.customPremiumSkins ?? []).map(design => ({
                    id: design.id,
                    name: design.name,
                    description: 'Création du Skin Creator',
                    type: 'SKIN',
                    rarity: 'LEGENDARY',
                    assetId: 'premium_workshop',
                    isPremium: true,
                    skinConfig: design.skinConfig,
                }))
                : [];
            setInventory(accessibleInventory);
            setOwnedItems([
                ...cat.filter(item => item.id !== SKIN_CREATOR_ID && item.type !== 'CURRENCY_PACK' && accessibleInventory.ownedItems.includes(item.id)),
                ...customSkins,
            ]);
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
        const result = itemId.startsWith('custom_premium_')
            ? await storeService.equipPremiumCustomSkin(itemId)
            : await storeService.equipItem(itemId);

        if (result.success) {
            await loadData();
        } else if (Platform.OS === 'web') {
            window.alert(result.message || "Impossible d'équiper cet objet.");
        } else {
            Alert.alert('Erreur', result.message || "Impossible d'équiper cet objet.");
        }

        setProcessingEquip(null);
    };

    const removeItem = async (item: StoreItem) => {
        setProcessingDelete(item.id);
        const result = await storeService.removeOwnedItem(item.id);
        if (result.success) {
            await loadData();
        } else if (Platform.OS === 'web') {
            window.alert(result.message || 'Impossible de supprimer cet objet.');
        } else {
            Alert.alert('Erreur', result.message || 'Impossible de supprimer cet objet.');
        }
        setProcessingDelete(null);
    };

    const confirmDelete = (item: StoreItem) => {
        const message = `Supprimer « ${item.name} » du vestiaire ? Cette action ne rembourse pas son prix.`;
        if (Platform.OS === 'web') {
            if (window.confirm(message)) void removeItem(item);
            return;
        }
        Alert.alert('Supprimer cet objet ?', message, [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Supprimer', style: 'destructive', onPress: () => { void removeItem(item); } },
        ]);
    };

    const filteredItems = activeTab === 'ALL'
        ? ownedItems
        : ownedItems.filter(item => item.type === activeTab);

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
                            <CollectionItemCard
                                canDelete={!DEFAULT_OWNED_ITEMS.includes(item.id) && !item.id.startsWith('custom_premium_')}
                                key={item.id}
                                item={item}
                                isEquipped={!!isEquipped}
                                onEquip={handleEquip}
                                onDelete={confirmDelete}
                                isProcessing={processingEquip === item.id || processingDelete === item.id}
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
});
