import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    RefreshControl, ActivityIndicator, useWindowDimensions
} from 'react-native';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { leaderboardService, LeaderboardEntry, LeaderboardCategory } from '../src/core/services/leaderboard.service';
import { authService } from '../src/core/services/auth.service';
import { economyService } from '../src/core/services/economy.service';
import { statsService } from '../src/core/services/stats.service';
import { getAvatarImage } from '../src/core/avatars';
import { PlayerProfile } from '../src/core/types';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

export default function LeaderboardScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const [activeTab, setActiveTab] = useState<LeaderboardCategory>('COCHONS');
    const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
    const flatListRef = useRef<FlatList>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [currentUser, setCurrentUser] = useState<PlayerProfile | null>(null);
    /** Rang du joueur actuel si hors du Top 50 (null = dans le Top 50 ou invité) */
    const [playerOutsideRank, setPlayerOutsideRank] = useState<number | null>(null);
    const [playerLocalScore, setPlayerLocalScore] = useState<number>(0);

    const unsubscribeRef = useRef<(() => void) | null>(null);

    useFocusEffect(
        useCallback(() => {

        }, [])
    );

    // Charger le profil utilisateur et synchroniser les infos dans Firestore
    useEffect(() => {
        authService.getCurrentUser().then(u => {
            if (!u) return;
            setCurrentUser(u);
            // Sync le displayName et avatarId vers Firestore pour les joueurs
            // déjà connectés dont le document n'a jamais eu ces champs.
            if (!u.uid.startsWith('guest_')) {
                economyService.syncProfileMetadata(
                    u.uid,
                    u.displayName,
                    u.avatarId || u.avatarUrl || 'avatar_default'
                );
            }
        });
    }, []);

    // Charger le score local (pour les invités et le bandeau hors Top 50)
    useEffect(() => {
        if (activeTab === 'XP') {
            economyService.getEconomy().then(eco => setPlayerLocalScore(eco.xp));
        } else if (activeTab === 'COINS') {
            economyService.getEconomy().then(eco => setPlayerLocalScore(eco.coins));
        } else {
            statsService.getStats().then(stats => setPlayerLocalScore(stats.totalCochonsInflicted));
        }
    }, [activeTab]);

    // S'abonner au classement en temps réel
    useEffect(() => {
        // Nettoyer l'abonnement précédent
        if (unsubscribeRef.current) {
            unsubscribeRef.current();
        }

        setLoading(true);
        setLeaderboardData([]);
        setPlayerOutsideRank(null);

        const unsub = leaderboardService.subscribeLeaderboard(
            activeTab,
            100,
            (entries) => {
                setLeaderboardData(entries);
                setLoading(false);
                setRefreshing(false);
            }
        );
        unsubscribeRef.current = unsub;

        // Nettoyage au démontage
        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }
        };
    }, [activeTab]);

    // Calculer le rang du joueur s'il est hors du Top 50
    useEffect(() => {
        if (!currentUser || currentUser.uid.startsWith('guest_') || loading) return;

        const isInTopList = leaderboardData.some(e => e.uid === currentUser.uid);
        if (isInTopList) {
            setPlayerOutsideRank(null);
            return;
        }

        leaderboardService.getPlayerRank(currentUser.uid, activeTab, playerLocalScore)
            .then(rank => setPlayerOutsideRank(rank));
    }, [leaderboardData, currentUser, activeTab, playerLocalScore, loading]);

    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        // onSnapshot se mettra à jour automatiquement ; on simule juste le spinner
        setTimeout(() => setRefreshing(false), 800);
    }, []);

    const getRankColor = (rank: number) => {
        if (rank === 1) return '#FFD700';
        if (rank === 2) return '#C0C0C0';
        if (rank === 3) return '#CD7F32';
        return '#FFFFFF';
    };

    const getScoreForTab = (item: LeaderboardEntry) => {
        if (activeTab === 'XP') return item.xp;
        if (activeTab === 'COINS') return item.coins;
        return item.leaguePoints;
    };

    const renderItem = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
        const isCurrentUser = currentUser && item.uid === currentUser.uid;
        const rankColor = getRankColor(item.rank);
        const avatarSrc = getAvatarImage(item.avatarId || 'avatar_default');

        return (
            <Animated.View entering={FadeInUp.delay(50 + index * 40)} style={[styles.playerRow, isCurrentUser && styles.currentUserRow]}>

                {/* Rang */}
                <View style={styles.rankContainer}>
                    <Text style={[styles.rankText, { color: rankColor }]}>#{item.rank}</Text>
                </View>

                {/* Avatar */}
                <View style={styles.avatarContainer}>
                    <View style={{ width: '100%', height: '100%', borderRadius: 22, overflow: 'hidden', backgroundColor: 'rgba(255,215,0,0.2)' }}>
                        <Image
                            source={avatarSrc}
                            style={styles.avatarImage}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                        />
                    </View>
                </View>

                {/* Nom */}
                <View style={styles.nameContainer}>
                    <Text style={[styles.nameText, isCurrentUser && styles.currentUserName]} numberOfLines={1}>
                        {isCurrentUser ? `${item.displayName} (Vous)` : item.displayName}
                    </Text>
                </View>

                {/* Score */}
                <View style={styles.scoreContainer}>
                    {activeTab === 'XP' && (
                        <>
                            <Text style={styles.scoreText}>{item.xp.toLocaleString()}</Text>
                            <Text style={styles.scoreLabel}>XP (Niv.{item.level})</Text>
                        </>
                    )}
                    {activeTab === 'COINS' && (
                        <>
                            <Text style={styles.scoreText}>{item.coins.toLocaleString()} 🪙</Text>
                            <Text style={styles.scoreLabel}>Coins</Text>
                        </>
                    )}
                    {activeTab === 'COCHONS' && (
                        <>
                            <Text style={styles.scoreText}>{item.cochonsGiven.toLocaleString()} 🐷</Text>
                            <Text style={styles.scoreLabel}>Cochons</Text>
                        </>
                    )}
                </View>
            </Animated.View>
        );
    };

    /** Bandeau fixe affiché en bas (Sticky Banner) */
    const renderPlayerBanner = () => {
        const isGuest = !currentUser || currentUser.uid.startsWith('guest_');

        if (isGuest) {
            return (
                <View style={[styles.playerBanner, styles.stickyBanner]}>
                    <Ionicons name="person-outline" size={20} color="rgba(255,255,255,0.7)" />
                    <Text style={styles.playerBannerText}>
                        Votre position : Non classé{'\n'}
                        <Text style={styles.playerBannerSub}>Créez un compte pour apparaître dans le classement</Text>
                    </Text>
                    <Text style={styles.playerBannerScore}>
                        {playerLocalScore.toLocaleString()} {activeTab === 'COINS' ? '🪙' : activeTab === 'COCHONS' ? '🐷' : 'XP'}
                    </Text>
                </View>
            );
        }

        const playerIndex = leaderboardData.findIndex(e => e.uid === currentUser.uid);
        const inTopList = playerIndex !== -1;
        
        // S'il est dans la liste, son vrai rang est sa position dans la liste
        const displayRank = inTopList ? (playerIndex + 1) : (playerOutsideRank != null ? playerOutsideRank : '...');

        const handleBannerPress = () => {
            if (inTopList && flatListRef.current) {
                flatListRef.current.scrollToIndex({ index: playerIndex, animated: true, viewPosition: 0.5 });
            } else {
                Toast.show({
                    type: 'info',
                    text1: 'Classement',
                    text2: 'Atteignez le Top 100 pour apparaître dans la liste !',
                    position: 'bottom',
                    bottomOffset: 120
                });
            }
        };

        return (
            <TouchableOpacity 
                activeOpacity={0.8} 
                onPress={handleBannerPress}
                style={[styles.playerBanner, styles.playerBannerAuth, styles.stickyBanner]}
            >
                <View style={styles.avatarContainerBanner}>
                    <Image
                        source={getAvatarImage(currentUser.avatarId || currentUser.avatarUrl || 'avatar_default')}
                        style={styles.avatarImage}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                    />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.playerBannerText, { color: '#FFD700' }]}>
                        Votre position : #{displayRank}
                    </Text>
                    <Text style={styles.playerBannerSub}>
                        {inTopList ? 'Cliquez pour voir votre carte' : 'Hors du Top 100'}
                    </Text>
                </View>
                <Text style={styles.playerBannerScore}>
                    {playerLocalScore.toLocaleString()} {activeTab === 'COINS' ? '🪙' : activeTab === 'COCHONS' ? '🐷' : 'XP'}
                </Text>
                <Ionicons name="chevron-up" size={20} color="#FFD700" style={{ marginLeft: 5 }} />
            </TouchableOpacity>
        );
    };

    return (
        <LinearGradient colors={['#2D1B4E', '#1A0E2E']} style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Onglets */}
            <View style={styles.tabsContainer}>
                {(['COCHONS', 'COINS', 'XP'] as LeaderboardCategory[]).map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tabButton, activeTab === tab && styles.activeTabButton]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]} numberOfLines={1}>
                            {tab === 'XP' ? '🌟 XP' : tab === 'COINS' ? '💰 Coins' : '🐷 Cochons'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Liste */}
            {loading && !refreshing ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#FFD700" />
                    <Text style={styles.loadingText}>Recherche des légendes...</Text>
                </View>
            ) : (
                <View style={{ flex: 1 }}>
                    <FlatList
                        ref={flatListRef}
                        data={leaderboardData}
                        keyExtractor={(item) => item.uid}
                        renderItem={renderItem}
                        getItemLayout={(data, index) => ({
                            length: 80, // Hauteur exacte d'un élément (70px + 10px margin)
                            offset: 80 * index,
                            index,
                        })}
                        contentContainerStyle={styles.listContent}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#FFD700" />
                        }
                        ListEmptyComponent={
                            <View style={styles.centerContainer}>
                                <Text style={styles.emptyText}>Aucun joueur classé pour le moment.</Text>
                            </View>
                        }
                        // Important pour pouvoir scroller avec ScrollToIndex sans erreur de calcul
                        onScrollToIndexFailed={info => {
                            const wait = new Promise(resolve => setTimeout(resolve, 500));
                            wait.then(() => {
                                flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
                            });
                        }}
                    />
                    
                    {/* Sticky Banner rendue par dessus la liste */}
                    <View style={styles.stickyBannerContainer}>
                        {renderPlayerBanner()}
                    </View>
                </View>
            )}
            <Toast />
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 15,
        paddingTop: 40,
        paddingBottom: 15,
        gap: 10,
        backgroundColor: 'rgba(0,0,0,0.2)'
    },
    tabButton: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    activeTabButton: {
        backgroundColor: 'rgba(255, 215, 0, 0.15)',
        borderColor: '#FFD700',
    },
    tabText: {
        color: 'rgba(255,255,255,0.7)',
        fontWeight: 'bold',
        fontSize: 14
    },
    activeTabText: {
        color: '#FFD700',
    },
    listContent: {
        padding: 15,
        paddingBottom: 100, // Espace supplémentaire pour la Sticky Banner
    },
    playerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        marginBottom: 10,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)'
    },
    currentUserRow: {
        backgroundColor: 'rgba(255, 215, 0, 0.1)',
        borderColor: '#FFD700',
    },
    rankContainer: {
        width: 35,
        alignItems: 'center',
    },
    rankText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    avatarContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,215,0,0.2)',
        overflow: 'hidden',
        marginLeft: 10,
        marginRight: 15,
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    nameContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    nameText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    currentUserName: {
        color: '#FFD700',
    },
    leagueText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        fontWeight: '500',
    },
    scoreContainer: {
        alignItems: 'flex-end',
        minWidth: 80,
    },
    scoreText: {
        color: '#FFD700',
        fontSize: 15,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    scoreLabel: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 11,
        fontWeight: 'bold',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    loadingText: {
        color: '#FFD700',
        marginTop: 15,
        fontSize: 14,
        fontWeight: '600'
    },
    emptyText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 16,
        textAlign: 'center',
        marginTop: 50,
    },
    // ── Bandeau position joueur ──
    stickyBannerContainer: {
        position: 'absolute',
        bottom: 10,
        left: 10,
        right: 10,
        alignItems: 'center',
    },
    stickyBanner: {
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    playerBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 14,
        backgroundColor: 'rgba(30, 20, 55, 0.95)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    playerBannerAuth: {
        backgroundColor: 'rgba(40, 30, 0, 0.95)',
        borderColor: '#FFD700',
    },
    avatarContainerBanner: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,215,0,0.2)',
        overflow: 'hidden',
    },
    playerBannerText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        fontWeight: 'bold',
    },
    playerBannerSub: {
        fontSize: 11,
        fontWeight: '400',
        color: 'rgba(255,255,255,0.6)',
        marginTop: 2,
    },
    playerBannerScore: {
        color: '#FFD700',
        fontSize: 14,
        fontWeight: 'bold',
    },
});
