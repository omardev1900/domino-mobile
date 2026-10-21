import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, useWindowDimensions, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { EconomyHeader } from '../src/components/EconomyHeader';
import { PurchaseSuccessModal } from '../src/components/PurchaseSuccessModal';
import { StoreItemPreview } from '../src/components/store/StoreItemPreview';
import { SkinPreviewModal } from '../src/components/store/SkinPreviewModal';
import { economyService } from '../src/core/services/economy.service';
import { getAccessibleInventory, storeService } from '../src/core/services/store.service';
import { StoreItem, StoreItemType, PlayerInventory } from '../src/core/store.types';
import { useRewardedAd, AdMobIds } from '../src/core/services/AdMobAdapter';
import { authService } from '../src/core/services/auth.service';
import { RewardOverlay } from '../src/components/RewardOverlay';
import { premiumService } from '../src/core/services/premium.service';

type TabType = 'PREMIUM' | 'WORKSHOP' | StoreItemType;
const SKIN_WORKSHOP_ID = 'skin_premium_atelier';
const AVATAR_WORKSHOP_IMAGE = require('../src/assets/images/store/atelier-des-avatars.jpg');

export default function StoreScreen() {
    const router = useRouter();
    const { tab } = useLocalSearchParams<{ tab?: string }>();
    const { width, height } = useWindowDimensions();
    const isLandscape = width > height;

    const [activeTab, setActiveTab] = useState<TabType>('WORKSHOP');
    const [inventory, setInventory] = useState<PlayerInventory | null>(null);
    const [catalog, setCatalog] = useState<StoreItem[]>([]);
    const [economy, setEconomy] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [processingPurchase, setProcessingPurchase] = useState<string | null>(null);
    const [economyRefresh, setEconomyRefresh] = useState(0);
    const [purchaseSuccessItem, setPurchaseSuccessItem] = useState<{ id: string; name: string } | null>(null);
    const [hasPremium, setHasPremium] = useState(false);
    const [premiumStatusResolved, setPremiumStatusResolved] = useState(false);
    const [previewedSkin, setPreviewedSkin] = useState<StoreItem | null>(null);

    const loadData = async () => {
        try {
            setPremiumStatusResolved(false);
            const [inv, cat, eco, premiumActive] = await Promise.all([
                storeService.getInventory(),
                storeService.getCatalog(),
                economyService.getEconomy(),
                premiumService.hasActiveAccess(),
            ]);
            const visibleCatalog = premiumActive ? cat : cat.filter(item => !item.isPremium);
            setInventory(getAccessibleInventory(inv, cat, premiumActive));
            setCatalog(visibleCatalog);
            setEconomy(eco);
            setHasPremium(premiumActive);
        } catch (error) {
            console.error('Failed to load store data', error);
        } finally {
            setPremiumStatusResolved(true);
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );


    const dynamicTabs = useMemo(() => {
        const types = Array.from(new Set(catalog.map(item => item.type)));
        const tabs: { id: TabType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [];

        // Les créations Premium sont regroupées à part des objets à équiper.
        if (hasPremium && catalog.some(item => item.id === SKIN_WORKSHOP_ID)) tabs.push({ id: 'WORKSHOP', label: 'Atelier', icon: 'color-wand' });
        if (hasPremium && catalog.some(item => item.isPremium && item.id !== SKIN_WORKSHOP_ID)) tabs.push({ id: 'PREMIUM', label: 'Premium', icon: 'star' });
        if (types.includes('AVATAR')) tabs.push({ id: 'AVATAR', label: 'Avatars', icon: 'person' });
        if (types.includes('SKIN')) tabs.push({ id: 'SKIN', label: 'Skins', icon: 'color-palette' });
        if (types.includes('CURRENCY_PACK')) tabs.push({ id: 'CURRENCY_PACK', label: 'Devises', icon: 'diamond' });
        if (types.includes('EMOTE')) tabs.push({ id: 'EMOTE', label: 'Emotions', icon: 'happy' });
        return tabs;
    }, [catalog, hasPremium]);

    const { isLoaded, isClosed, isEarnedReward, error: rewardError, load, show } = useRewardedAd(AdMobIds.REWARDED_FIN_PARTIE);
    const [pendingStoreAdReward, setPendingStoreAdReward] = useState(false);
    const [isProcessingAd, setIsProcessingAd] = useState(false);
    const [showRewardOverlay, setShowRewardOverlay] = useState(false);

    useEffect(() => {
        if (premiumStatusResolved && !hasPremium) {
            load();
        }
    }, [hasPremium, load, premiumStatusResolved]);

    useEffect(() => {
        if (!dynamicTabs.some(tab => tab.id === activeTab)) {
            setActiveTab(dynamicTabs[0]?.id ?? 'AVATAR');
        }
    }, [activeTab, dynamicTabs]);

    useEffect(() => {
        if (tab === 'PREMIUM' && hasPremium) setActiveTab('PREMIUM');
    }, [hasPremium, tab]);

    useEffect(() => {
        if (isClosed) {
            if (isEarnedReward && pendingStoreAdReward) {
                const claim = async () => {
                    const user = await authService.getCurrentUser();
                    await economyService.claimStoreAdReward(user?.uid);
                    setEconomyRefresh(prev => prev + 1);
                    await loadData();
                    setShowRewardOverlay(true);
                };
                claim();
            }
            setPendingStoreAdReward(false);
            setIsProcessingAd(false);
            if (!hasPremium) load(); // preload next only for non-Premium players
        }
    }, [hasPremium, isClosed, isEarnedReward, load, pendingStoreAdReward]);

    const handleWatchStoreAd = async () => {
        setIsProcessingAd(true);
        if (Platform.OS === 'web') {
            Alert.alert("Information", "Les publicités ne sont disponibles que sur mobile.");
            setIsProcessingAd(false);
        } else if (isLoaded) {
            setPendingStoreAdReward(true);
            show();
        } else {
            // Pub non chargée
            setIsProcessingAd(false);
            Alert.alert(
                "Publicité indisponible",
                `Aucune publicité n'est prête pour le moment. Veuillez réessayer dans quelques instants.\n\n(Info: ${rewardError ? rewardError.message : 'Chargement en cours'})`
            );
            load(); // retenter le chargement
        }
    };

    const handlePurchase = async (item: StoreItem) => {
        const isFreeItem = !item.isPremium
            && item.type !== 'CURRENCY_PACK'
            && item.priceCoins === 0
            && item.priceDiamonds === undefined;

        const processPurchase = async (equipImmediately = false) => {
            setProcessingPurchase(item.id);
            const result = await storeService.purchaseItem(item.id);

            if (result.success) {
                setEconomyRefresh(prev => prev + 1);

                if (equipImmediately) {
                    const equipResult = await storeService.equipItem(item.id);
                    if (!equipResult.success) {
                        if (Platform.OS === 'web') {
                            window.alert(equipResult.message || "Impossible d'activer cet objet.");
                        } else {
                            Alert.alert('Erreur', equipResult.message || "Impossible d'activer cet objet.");
                        }
                    }
                } else if (item.type !== 'CURRENCY_PACK') {
                    setPurchaseSuccessItem({ id: item.id, name: item.name });
                } else if (Platform.OS === 'web') {
                    window.alert('Devises ajoutées avec succès !');
                } else {
                    Alert.alert('Succès', 'Devises ajoutées avec succès !');
                }

                await loadData();
            } else if (Platform.OS === 'web') {
                window.alert(result.message || 'Une erreur est survenue.');
            } else {
                Alert.alert('Erreur', result.message || 'Une erreur est survenue.');
            }

            setProcessingPurchase(null);
        };

        if (isFreeItem) {
            await processPurchase(true);
            return;
        }

        if (Platform.OS === 'web') {
            const confirmed = window.confirm(`Voulez-vous acheter ${item.name} ?`);
            if (confirmed) {
                await processPurchase();
            }
            return;
        }

        Alert.alert(
            "Confirmer l'achat",
            `Voulez-vous acheter ${item.name} ?`,
            [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Acheter', style: 'default', onPress: processPurchase },
            ]
        );
    };

    const handleEquip = async (itemId: string) => {
        if (itemId === SKIN_WORKSHOP_ID) {
            router.push('/premium-workshop' as never);
            return;
        }
        setProcessingPurchase(itemId);
        const result = await storeService.equipItem(itemId);

        if (result.success) {
            await loadData();
            setPurchaseSuccessItem(null);
        } else if (Platform.OS === 'web') {
            window.alert(result.message || "Impossible d'équiper cet objet.");
        } else {
            Alert.alert('Erreur', result.message || "Impossible d'équiper cet objet.");
        }

        setProcessingPurchase(null);
    };

    const filteredCatalog = activeTab === 'WORKSHOP'
        ? catalog.filter(item => item.id === SKIN_WORKSHOP_ID)
        : activeTab === 'PREMIUM'
            ? catalog.filter(item => item.isPremium && item.id !== SKIN_WORKSHOP_ID)
            : catalog.filter(item => item.type === activeTab && item.id !== SKIN_WORKSHOP_ID);

    const StoreAdCard = ({ playerEconomy }: { playerEconomy: any }) => {
        const { width: currentWidth, height: currentHeight } = useWindowDimensions();
        const cardLandscape = currentWidth > currentHeight;
        
        const [remainingSeconds, setRemainingSeconds] = useState(0);

        useEffect(() => {
            if (!playerEconomy) return;
            const updateTimer = () => {
                const lastAd = playerEconomy.lastStoreAdTimestamp || 0;
                const diff = 120000 - (Date.now() - lastAd); // cooldown 2 minutes
                setRemainingSeconds(diff > 0 ? Math.ceil(diff / 1000) : 0);
            };
            updateTimer();
            const interval = setInterval(updateTimer, 1000);
            return () => clearInterval(interval);
        }, [playerEconomy]);

        const formatTime = (secs: number) => {
            const m = Math.floor(secs / 60);
            const s = secs % 60;
            return `${m}:${s < 10 ? '0' : ''}${s}`;
        };

        const isAvailable = remainingSeconds === 0;

        return (
            <Animated.View entering={FadeIn} style={[styles.card, cardLandscape && styles.cardLandscape, cardLandscape && { width: currentWidth * 0.24 }]}>
                <View style={{ flex: 1 }}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle} numberOfLines={1}>Vidéo Récompensée</Text>
                        <Text style={styles.cardRarity}>GRATUIT</Text>
                    </View>

                    <View style={[styles.cardImagePlaceholder, { justifyContent: 'center', alignItems: 'center' }]}>
                        <Ionicons name="play-circle" size={60} color="#FFD700" />
                    </View>

                    <View style={styles.descriptionRow}>
                        <Text style={styles.cardDescription} numberOfLines={2}>
                            Regardez une vidéo pour gagner 100 Coins.
                        </Text>
                    </View>
                </View>

                <View style={styles.cardFooter}>
                    <View style={styles.priceContainer}>
                        <Text style={styles.priceText}>🪙 100</Text>
                    </View>

                    {isProcessingAd ? (
                        <ActivityIndicator color="#FFD700" size="small" />
                    ) : isAvailable ? (
                        <TouchableOpacity style={styles.buyButton} onPress={handleWatchStoreAd}>
                            <Text style={styles.buyButtonText}>Voir</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={[styles.buyButton, { backgroundColor: 'gray' }]}>
                            <Text style={styles.buyButtonText}>{formatTime(remainingSeconds)}</Text>
                        </View>
                    )}
                </View>
            </Animated.View>
        );
    };

    const StoreItemCard = ({
        item,
        inventory: playerInventory,
        playerEconomy,
        onPurchase,
        onEquip,
        isProcessing,
    }: {
        item: StoreItem;
        inventory: PlayerInventory;
        playerEconomy: any;
        onPurchase: (item: StoreItem) => void;
        onEquip: (id: string) => void;
        isProcessing: boolean;
    }) => {
        const { width: currentWidth, height: currentHeight } = useWindowDimensions();
        const cardLandscape = currentWidth > currentHeight;
        const [isExpanded, setIsExpanded] = useState(false);
        const isWorkshop = item.id === SKIN_WORKSHOP_ID;
        const isOwned = isWorkshop || (item.type !== 'CURRENCY_PACK' && playerInventory.ownedItems.includes(item.id));
        const isEquipped = !isWorkshop && (item.type === 'AVATAR'
            ? playerInventory.equipped.avatar === item.id
            : item.type === 'SKIN'
                ? playerInventory.equipped.skin === item.id
                : false);

        const canAffordCoins = item.priceCoins ? (playerEconomy?.coins ?? 0) >= item.priceCoins : true;
        const canAffordDiamonds = item.priceDiamonds ? (playerEconomy?.diamonds ?? 0) >= item.priceDiamonds : true;
        const canAfford = canAffordCoins && canAffordDiamonds;
        const isFreeItem = !item.isPremium
            && item.type !== 'CURRENCY_PACK'
            && item.priceCoins === 0
            && item.priceDiamonds === undefined;

        return (
            <Animated.View entering={FadeIn} key={item.id} style={[styles.card, cardLandscape && styles.cardLandscape, cardLandscape && { width: currentWidth * 0.24 }]}>
                <View style={{ flex: 1 }}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.cardRarity}>{item.isPremium ? 'PREMIUM' : item.rarity}</Text>
                    </View>

                    <TouchableOpacity
                        style={styles.cardImagePlaceholder}
                        activeOpacity={item.type === 'SKIN' ? 0.78 : 1}
                        onPress={() => isWorkshop ? onEquip(item.id) : item.type === 'SKIN' && setPreviewedSkin(item)}
                        disabled={item.type !== 'SKIN'}
                        accessibilityLabel={item.type === 'SKIN' ? (isWorkshop ? `Lancer ${item.name}` : `Prévisualiser ${item.name}`) : undefined}
                    >
                        <StoreItemPreview item={item} height={100} />
                        {item.type === 'SKIN' && !isWorkshop && <View style={styles.previewBadge}><Ionicons name="expand-outline" size={15} color="#FFF" /></View>}
                    </TouchableOpacity>

                    <View style={styles.descriptionRow}>
                        <Text style={styles.cardDescription} numberOfLines={isExpanded ? undefined : 2}>
                            {item.description}
                        </Text>
                        {item.description && item.description.length > 35 ? (
                            <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)} style={styles.collapseBtn}>
                                <Text style={styles.collapseBtnText}>{isExpanded ? '<<' : '>>'}</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>

                <View style={styles.cardFooter}>
                    {!isOwned ? (
                        <View style={styles.priceContainer}>
                            {item.isPremium ? <Text style={[styles.priceText, styles.premiumText]}>PREMIUM</Text> : null}
                            {item.priceCoins !== undefined && item.priceCoins > 0 ? (
                                <Text style={styles.priceText}>🪙 {item.priceCoins}</Text>
                            ) : null}
                            {item.priceDiamonds !== undefined && item.priceDiamonds > 0 ? (
                                <Text style={[styles.priceText, { color: '#60DCFF' }]}>💎 {item.priceDiamonds}</Text>
                            ) : null}
                            {!item.isPremium && item.priceCoins === 0 && item.priceDiamonds === undefined ? (
                                <Text style={[styles.priceText, { color: '#4CAF50' }]}>GRATUIT</Text>
                            ) : null}
                        </View>
                    ) : null}

                    {isProcessing ? (
                        <ActivityIndicator color="#FFD700" size="small" />
                    ) : isEquipped ? (
                        <View style={styles.equippedBadge}>
                            <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                            <Text style={styles.equippedText}>Équipé</Text>
                        </View>
                    ) : isOwned ? (
                        <TouchableOpacity style={styles.equipButton} onPress={() => onEquip(item.id)}>
                            <Text style={styles.equipButtonText}>{isWorkshop ? 'LANCER' : 'UTILISER'}</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={[styles.buyButton, !canAfford && { opacity: 0.5 }]}
                            onPress={() => onPurchase(item)}
                            disabled={!canAfford}
                        >
                            <Text style={styles.buyButtonText}>{isFreeItem ? '+' : 'Acheter'}</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </Animated.View>
        );
    };

    const AvatarWorkshopComingSoonCard = () => (
        <Animated.View entering={FadeIn} style={[styles.card, isLandscape && styles.cardLandscape, isLandscape && { width: width * 0.24 }]}>
            <View style={{ flex: 1 }}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle} numberOfLines={1}>Atelier des avatars</Text>
                    <Text style={styles.cardRarity}>BIENTÔT</Text>
                </View>

                <View style={[styles.cardImagePlaceholder, styles.comingSoonPreview]}>
                    <Image source={AVATAR_WORKSHOP_IMAGE} style={styles.workshopImage} resizeMode="cover" />
                </View>

                <View style={styles.descriptionRow}>
                    <Text style={styles.cardDescription} numberOfLines={2}>
                        Crée bientôt un avatar unique aux couleurs de Domino Martinique.
                    </Text>
                </View>
            </View>

            <View style={styles.cardFooter}>
                <Text style={[styles.priceText, styles.premiumText]}>BIENTÔT DISPONIBLE</Text>
            </View>
        </Animated.View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient colors={['#1A0E2E', '#0A0514']} style={StyleSheet.absoluteFillObject} />

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
                <EconomyHeader refreshTrigger={economyRefresh} hideXp={true} />
            </View>

            <PurchaseSuccessModal
                visible={!!purchaseSuccessItem}
                itemName={purchaseSuccessItem?.name || ''}
                onClose={() => setPurchaseSuccessItem(null)}
                onEquip={() => purchaseSuccessItem && handleEquip(purchaseSuccessItem.id)}
            />
            <SkinPreviewModal item={previewedSkin} visible={previewedSkin !== null} onClose={() => setPreviewedSkin(null)} />

            <RewardOverlay
                visible={showRewardOverlay}
                reward={{
                    coinsEarned: 100, // Le montant fixé de la récompense boutique
                    xpEarned: 0,
                    leaguePointsEarned: 0,
                    diamondsEarned: 0,
                    previousLevel: 0,
                    newLevel: 0,
                    leveledUp: false,
                    newLeaguePoints: 0,
                    breakdown: [{ id: 'store_ad', label: 'Récompense publicitaire', coins: 100, xp: 0, leaguePoints: 0, diamonds: 0 }]
                }}
                isWinner={false}
                onContinue={() => {
                    setShowRewardOverlay(false);
                    Alert.alert(
                        'Encore plus de coins',
                        'Vous pourrez gagner encore des coins en regardant d’autres vidéos dans la boutique.'
                    );
                }}
            />
            
            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#FFD700" />
                </View>
            ) : (
                <>
                    {activeTab === 'CURRENCY_PACK' && !hasPremium && inventory && economy && (
                        <StoreAdCard playerEconomy={economy} />
                    )}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={[styles.catalogGrid, isLandscape && styles.catalogGridLandscape]}
                        snapToInterval={width * 0.24 + 16}
                        decelerationRate="fast"
                    >
                        {filteredCatalog.length > 0 ? (
                            <>
                                {filteredCatalog.map(item => (
                                inventory ? (
                                    <StoreItemCard
                                        key={item.id}
                                        item={item}
                                        inventory={inventory}
                                        playerEconomy={economy}
                                        onPurchase={handlePurchase}
                                        onEquip={handleEquip}
                                        isProcessing={processingPurchase === item.id}
                                    />
                                ) : null
                                ))}
                                {activeTab === 'WORKSHOP' ? <AvatarWorkshopComingSoonCard /> : null}
                            </>
                        ) : (
                            <Text style={styles.emptyText}>Aucun article dans cette catégorie pour le moment.</Text>
                        )}
                    </ScrollView>
                </>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1A0E2E',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 20,
        zIndex: 10,
    },
    headerTabsContainer: {
        flex: 1,
        marginHorizontal: 10,
    },
    headerTabsScroll: {
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
    premiumText: {
        color: '#FFD700',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    catalogGrid: {
        paddingHorizontal: 20,
        paddingBottom: 20,
        gap: 16,
    },
    catalogGridLandscape: {
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
    },
    cardLandscape: {
        height: 280,
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
        color: 'rgba(255,255,255,0.5)',
        fontSize: 9,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    cardImagePlaceholder: {
        height: 100,
        marginBottom: 8,
        position: 'relative',
    },
    comingSoonPreview: {
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
        backgroundColor: 'rgba(255, 215, 0, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 215, 0, 0.22)',
    },
    workshopImage: {
        width: '100%',
        height: '100%',
        borderRadius: 11,
    },
    previewBadge: {
        position: 'absolute',
        top: 7,
        right: 7,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0,0,0,0.58)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardDescription: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 13,
        marginBottom: 8,
        lineHeight: 18,
        flex: 1,
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
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        paddingTop: 12,
        minHeight: 48,
    },
    priceContainer: {
        flexDirection: 'column',
        gap: 2,
    },
    priceText: {
        color: '#FFD700',
        fontWeight: 'bold',
        fontSize: 13,
    },
    buyButton: {
        backgroundColor: '#4CAF50',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
    },
    buyButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    equipButton: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
    },
    equipButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    equippedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    equippedText: {
        color: '#4CAF50',
        fontWeight: 'bold',
        fontSize: 13,
    },
    emptyText: {
        color: 'rgba(255,255,255,0.5)',
        textAlign: 'center',
        marginTop: 40,
    },
});
