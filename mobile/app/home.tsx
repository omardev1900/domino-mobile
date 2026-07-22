
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    View,
    StyleSheet,
    Text,
    TouchableOpacity,
    ScrollView,
    useWindowDimensions,
    Modal,
    Alert,
    Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeInRight, ZoomIn } from 'react-native-reanimated';
import { authService } from '../src/core/services/auth.service';
import { statsService } from '../src/core/services/stats.service';
import { economyService } from '../src/core/services/economy.service';
import { PlayerProfile } from '../src/core/types';
import { DAILY_REWARD_COINS, LEAGUE_GRADE_COLORS, NEW_PLAYER_COINS } from '../src/core/economy.constants';
import { LeagueGrade } from '../src/core/economy.types';
import { getAvatarImage } from '../src/core/avatars';
import { EconomyHeader } from '../src/components/EconomyHeader';
import { DailyRewardModal } from '../src/components/DailyRewardModal';
import { HelpOverlay } from '../src/components/HelpOverlay';
import { LeagueProgressWidget } from '../src/components/LeagueProgressWidget';
import { ShareTextButton } from '../src/components/ShareButton';
import { NewsService, NewsItem } from '../src/core/services/news.service';
import { useRewardedAd, useAppOpenAd, AdMobIds } from '../src/core/services/AdMobAdapter';
import { USE_NEW_SIDEBAR } from '../src/core/config/navigation.config';
import { getLeagueProgress, getMonthlyCochonsFromHistory } from '../src/core/leagueProgress';
import { deleteWaitingRoomIfOwner, findActiveRoomForUser, findHostedWaitingRoom } from '../src/core/services/firebase';
import { PremiumButton } from '../src/components/common/PremiumButton';

let hasShownAppOpenAd = false;

export default function HomeScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const [user, setUser] = useState<PlayerProfile | null>(null);
    const dailyClaimTriggerRef = useRef<(() => void) | null>(null);
    const [showHelp, setShowHelp] = useState(false);
    const [newsList, setNewsList] = useState<NewsItem[]>([]);
    const [currentNewsIndex, setCurrentNewsIndex] = useState(0);
    const [reconnectRoomId, setReconnectRoomId] = useState<string | null>(null);
    const [hostedWaitingRoomId, setHostedWaitingRoomId] = useState<string | null>(null);
    const [economyRefresh, setEconomyRefresh] = useState(0);
    const [cochonsGiven, setCochonsGiven] = useState(0);
    const [myLeagueGrade, setMyLeagueGrade] = useState<LeagueGrade | null>(null);
    const [showDailyReward, setShowDailyReward] = useState(false);
    const [showWelcomeReward, setShowWelcomeReward] = useState(false);
    const [dailyRewardAmount, setDailyRewardAmount] = useState(0);
    const [isProcessingRewardAd, setIsProcessingRewardAd] = useState(false);
    const { isLoaded: isRewardLoaded, isClosed: isRewardClosed, isEarnedReward, error: rewardError, load: loadReward, show: showReward } = useRewardedAd(AdMobIds.REWARDED_FIN_PARTIE);
    const { isLoaded: isAppOpenLoaded, load: loadAppOpen, show: showAppOpen } = useAppOpenAd(AdMobIds.APP_OPEN);

    const AD_FALLBACK_TIMEOUT_MS = 8000;
    const adFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isProcessingRewardAdRef = useRef(false);

    useEffect(() => {
        isProcessingRewardAdRef.current = isProcessingRewardAd;
    }, [isProcessingRewardAd]);

    // Initialiser la pub d'ouverture d'app (une seule fois par session)
    useEffect(() => {
        if (Platform.OS !== 'web' && !hasShownAppOpenAd) {
            loadAppOpen();
        }
    }, [loadAppOpen]);

    useEffect(() => {
        if (isAppOpenLoaded && !hasShownAppOpenAd) {
            hasShownAppOpenAd = true;
            try {
                showAppOpen();
            } catch (error) {
                console.warn('Erreur affichage pub App Open:', error);
            }
        }
    }, [isAppOpenLoaded, showAppOpen]);
    useEffect(() => {
        loadReward();
    }, [loadReward]);

    useEffect(() => {
        if (isRewardClosed) {
            if (adFallbackTimerRef.current) {
                clearTimeout(adFallbackTimerRef.current);
                adFallbackTimerRef.current = null;
            }
            if (isEarnedReward && isProcessingRewardAd) {
                dailyClaimTriggerRef.current?.();
            }
            setIsProcessingRewardAd(false);
            loadReward(); // preload next
        }
    }, [isRewardClosed, isEarnedReward, loadReward, isProcessingRewardAd]);

    // Ref pour l'unsubscribe du listener Firestore — nettoyé au démontage du composant
    const economyListenerRef = useRef<(() => void) | null>(null);

    const refreshMonthlyLeague = useCallback(async () => {
        const stats = await statsService.getStats();
        const monthlyCochons = getMonthlyCochonsFromHistory(stats.matchHistory);
        setCochonsGiven(monthlyCochons);
        setMyLeagueGrade(getLeagueProgress(monthlyCochons).grade);
    }, []);

    // Lance le listener temps réel une seule fois au montage.
    // Firestore est la source de vérité : le callback met à jour le state local sans jamais écrire dans Firestore.
    useEffect(() => {
        authService.getCurrentUser().then(u => {
            setUser(u);
            if (u && !u.uid.startsWith('guest_')) {
                // Profil uniquement (displayName, avatarId) — jamais les données économiques
                economyService.syncProfileMetadata(
                    u.uid,
                    u.displayName,
                    u.avatarId || u.avatarUrl || 'avatar_default'
                );
                // Listener temps réel : Firestore → cache local → UI
                economyListenerRef.current = economyService.listenToEconomy(u.uid, (eco) => {
                    setEconomyRefresh(v => v + 1);
                });
                refreshMonthlyLeague().catch(console.error);
            }
        });

        return () => {
            economyListenerRef.current?.();
            economyListenerRef.current = null;
        };
    }, [refreshMonthlyLeague]);



    // Au focus : sync stats + pub HOME (avant cadeau) + vérification cadeau quotidien + news.
    // Aucune écriture economy ici — le listener onSnapshot s'en charge.
    useFocusEffect(
        useCallback(() => {
            let cancelled = false;

            authService.getCurrentUser().then(async u => {
                if (cancelled) return;
                if (u && !u.uid.startsWith('guest_')) {
                    // 1. Vérifier si une partie est en cours AVANT d'afficher les modales pour éviter les flashs
                    try {
                        const firestoreActiveRoomId = await findActiveRoomForUser(u.uid);
                        const hostedRoomId = await findHostedWaitingRoom(u.uid);
                        if (cancelled) return;

                        if (firestoreActiveRoomId) {
                            await AsyncStorage.setItem('active_roomId', firestoreActiveRoomId);
                            setReconnectRoomId(firestoreActiveRoomId);
                            setHostedWaitingRoomId(hostedRoomId);
                            return; // On stoppe l'évaluation des cadeaux : on va rediriger vers le jeu
                        } else {
                            await AsyncStorage.removeItem('active_roomId');
                            setReconnectRoomId(null);
                            setHostedWaitingRoomId(hostedRoomId);
                        }
                    } catch (e) {
                        console.error('Error checking active room', e);
                    }

                    // 2. Synchronisation
                    // [R3-B12] syncFromFirebase AVANT isDailyRewardAvailable — sinon le timestamp
                    // n'est pas encore chargé depuis Firestore et le cadeau réapparaît à chaque connexion
                    await Promise.all([
                        statsService.syncWithFirebase(u.uid),
                        economyService.syncFromFirebase(u.uid),
                    ]);

                    if (cancelled) return;
                    await refreshMonthlyLeague();
                    if (cancelled) return;

                    // 3. Évaluation des cadeaux (base serveur fiable)
                    const isNewAccount = !(await economyService.hasClaimedWelcomeGift());
                    const dailyAvailable = await economyService.isDailyRewardAvailable();
                    if (cancelled) return;

                    if (isNewAccount) {
                        setTimeout(() => {
                            if (!cancelled) setShowWelcomeReward(true);
                        }, 1000);
                    } else if (dailyAvailable) {
                        setDailyRewardAmount(DAILY_REWARD_COINS);
                        setTimeout(() => {
                            if (!cancelled) setShowDailyReward(true);
                        }, 500);
                    }
                }
            });
            NewsService.getFeaturedNews(5).then(setNewsList);

            return () => {
                cancelled = true;

            };
        }, [refreshMonthlyLeague])
    );

    // Carousel Timer: Alterner les news toutes les 5 secondes
    useEffect(() => {
        if (newsList.length <= 1) return;

        const timer = setInterval(() => {
            setCurrentNewsIndex(prev => (prev + 1) % newsList.length);
        }, 5000);

        return () => clearInterval(timer);
    }, [newsList]);

    const currentNews = newsList[currentNewsIndex];



    // Appelé par DailyRewardModal après la fin de l'animation compteur
    const handleClaimDailyReward = async () => {
        // [R3-B9] FIX : claimDailyRewardNow() évite la race condition avec le listener Firestore
        await economyService.claimDailyRewardNow(user?.uid, undefined, dailyRewardAmount);
        setShowDailyReward(false);
        setEconomyRefresh(v => v + 1);
    };

    // Appelé si le joueur ferme le modal de cadeau quotidien (skip)
    const handleSkipDailyReward = () => {
        setShowDailyReward(false);
    };

    // Appelé pour récupérer le bonus de bienvenue
    const handleClaimWelcomeReward = async () => {
        await economyService.claimWelcomeGift();
        setShowWelcomeReward(false);
        
        // Si le cadeau quotidien est aussi dispo, on l'affiche juste après avec un délai
        const dailyAvailable = await economyService.isDailyRewardAvailable();
        if (dailyAvailable) {
            setDailyRewardAmount(DAILY_REWARD_COINS);
            setTimeout(() => {
                setShowDailyReward(true);
            }, 500);
        }
    };

    // Helper pour le fallback
    const _grantDailyRewardFallback = async () => {
        if (adFallbackTimerRef.current) {
            clearTimeout(adFallbackTimerRef.current);
            adFallbackTimerRef.current = null;
        }
        dailyClaimTriggerRef.current?.();
        setIsProcessingRewardAd(false);
    };

    // Appelé quand le joueur clique "Voir une pub → +300 🪙" dans le modal cadeau
    const handleWatchAdForReward = async () => {
        if (isProcessingRewardAd) return;
        setIsProcessingRewardAd(true);
        
        if (Platform.OS === 'web') {
            await _grantDailyRewardFallback();
            return;
        }
        
        if (isRewardLoaded) {
            showReward();
            return;
        }
        
        loadReward(); // retenter
        const fallbackTimer = setTimeout(async () => {
            if (isProcessingRewardAdRef.current) {
                await _grantDailyRewardFallback();
            }
        }, AD_FALLBACK_TIMEOUT_MS);
        adFallbackTimerRef.current = fallbackTimer;
    };

    const handleReconnect = useCallback(() => {
        if (reconnectRoomId) {
            router.push({
                pathname: '/game/[id]',
                params: {
                    id: reconnectRoomId,
                    userId: user?.uid || 'guest'
                }
            });
            setReconnectRoomId(null);
        }
    }, [reconnectRoomId, user, router]);

    const handleCancelReconnect = async () => {
        try {
            await AsyncStorage.removeItem('active_roomId');
            setReconnectRoomId(null);
        } catch (e) {
            console.error('Error clearing active room', e);
        }
    };

    const handleDeleteHostedRoom = async () => {
        if (!hostedWaitingRoomId || !user?.uid) return;
        try {
            const deleted = await deleteWaitingRoomIfOwner(hostedWaitingRoomId, user.uid);
            if (deleted) {
                setHostedWaitingRoomId(null);
                if (Platform.OS === 'web') {
                    window.alert("La table a été supprimée avec succès.");
                } else {
                    Alert.alert("Succès", "La table a été supprimée avec succès.");
                }
            }
        } catch (e: any) {
            console.error('Error deleting hosted room', e);
            if (Platform.OS === 'web') {
                window.alert(e.message || "Impossible de supprimer la table.");
            } else {
                Alert.alert('Suppression impossible', e.message || 'Impossible de supprimer cette table.');
            }
        }
    };

    return (
        <LinearGradient
            colors={['#2D1B4E', '#1A0E2E']}
            style={styles.container}
        >
            {/* Header Area */}
            <View style={[styles.header, { paddingTop: insets.top || 20 }, USE_NEW_SIDEBAR && styles.headerCentered]}>
                {/* Top Left: Help (Visible on all devices) */}
                <View style={[styles.headerTopLeft, { top: (insets.top || 20) + 12 }]}>
                    {!USE_NEW_SIDEBAR && (
                        <TouchableOpacity
                            style={styles.helpButton}
                            onPress={() => setShowHelp(true)}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name="help-circle-outline"
                                size={24}
                                color="#FFD700"
                            />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Right Side: Economy — centré quand sidebar active */}
                <Animated.View entering={FadeInRight.duration(400)} style={[styles.headerRight, USE_NEW_SIDEBAR && styles.headerRightCentered]}>
                    <EconomyHeader refreshTrigger={economyRefresh} />

                    {!USE_NEW_SIDEBAR && <View style={styles.headerActions}>
                        <PremiumButton
                            style={styles.settingsButton}
                            onPress={() => router.push('/store')}
                            soundName="clack1"
                        >
                            <Text style={styles.settingsIcon}>🛒</Text>
                        </PremiumButton>
                        <PremiumButton
                            style={styles.settingsButton}
                            onPress={() => router.push('/collection')}
                            soundName="clack1"
                        >
                            <Text style={styles.settingsIcon}>🎒</Text>
                        </PremiumButton>
                        <PremiumButton
                            style={styles.settingsButton}
                            onPress={() => router.push('/leaderboard')}
                            soundName="clack1"
                        >
                            <Text style={styles.settingsIcon}>🏆</Text>
                        </PremiumButton>
                        <PremiumButton
                            style={styles.settingsButton}
                            onPress={() => router.push('/stats')}
                            soundName="clack1"
                        >
                            <Text style={styles.settingsIcon}>📈</Text>
                        </PremiumButton>
                        <PremiumButton
                            style={styles.userBadge}
                            onPress={() => router.push('/modal')}
                            soundName="clack1"
                        >
                            <View style={[
                                styles.avatarCircle,
                                myLeagueGrade && {
                                    borderWidth: 2,
                                    borderColor: LEAGUE_GRADE_COLORS[myLeagueGrade],
                                    backgroundColor: 'transparent',
                                },
                            ]}>
                                <Image
                                    source={getAvatarImage(user?.avatarUrl)}
                                    style={styles.avatarImage}
                                    contentFit="cover"
                                    cachePolicy="memory-disk"
                                />
                            </View>
                        </PremiumButton>
                    </View>}
                </Animated.View>
            </View>

            {/* Main Content Area */}
            <ScrollView
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: insets.bottom + 20 }
                ]}
                showsVerticalScrollIndicator={false}
            >
                {!reconnectRoomId && hostedWaitingRoomId ? (
                    <View style={styles.sessionNoticeCard}>
                        <Text style={styles.sessionNoticeTitle}>Table en attente détectée</Text>
                        <Text style={styles.sessionNoticeText}>
                            Vous avez une table multijoueur encore vide. Retournez-y directement ou supprimez-la avant de lancer autre chose.
                        </Text>
                        <View style={styles.sessionNoticeActions}>
                            <TouchableOpacity
                                style={styles.sessionNoticeSecondary}
                                onPress={handleDeleteHostedRoom}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.sessionNoticeSecondaryText}>Supprimer</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.sessionNoticePrimary}
                                onPress={() => router.push({ pathname: '/lobby', params: { autoJoinRoomId: hostedWaitingRoomId } })}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.sessionNoticePrimaryText}>Retourner à ma table</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : null}

                <View style={styles.topCardsRow}>
                    {/* 1. Nouveau bloc Actualités - CAROUSEL */}
                    <Animated.View entering={FadeInUp.delay(200).duration(500)} style={[styles.topCardWrapper, { flex: 1.2 }]}>
                        <TouchableOpacity 
                            style={styles.newsContainerCompact}
                            onPress={() => router.push('/news/history')}
                            activeOpacity={0.7}
                        >
                            <LinearGradient
                                colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                                style={styles.newsGradientCompact}
                            >
                                {currentNews?.imageUrl && (
                                    <Image 
                                        source={{ uri: currentNews.imageUrl }} 
                                        style={StyleSheet.absoluteFill} 
                                        resizeMode="cover" 
                                    />
                                )}
                                <LinearGradient
                                    colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.7)']}
                                    style={StyleSheet.absoluteFill}
                                />
                                
                                <View style={styles.newsHeaderRow}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <Ionicons name="newspaper-outline" size={16} color="#FFD700" />
                                        <Text style={styles.newsTitleCompact}>ACTUS</Text>
                                    </View>
                                    {newsList.length > 1 && (
                                        <View style={styles.carouselIndicators}>
                                            {newsList.map((_, i) => (
                                                <View 
                                                    key={i} 
                                                    style={[
                                                        styles.indicator, 
                                                        i === currentNewsIndex && styles.indicatorActive
                                                    ]} 
                                                />
                                            ))}
                                        </View>
                                    )}
                                </View>
                                <Animated.View 
                                    key={currentNews?.id || 'empty'} 
                                    entering={FadeInUp.duration(400)}
                                    style={{ flex: 1 }}
                                >
                                    <Text style={styles.newsTextCompact} numberOfLines={3}>
                                        {currentNews ? currentNews.content : "Chargement des actualités..."}
                                    </Text>
                                </Animated.View>
                                <View style={styles.newsReadMore}>
                                    <Text style={[styles.newsReadMoreText, { fontSize: 11 }]}>
                                        Détails
                                    </Text>
                                    <Ionicons name="chevron-forward" size={10} color="#42A5F5" />
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>

                    {/* 2. Bloc Niveau Cochon - ENLARGED AGAIN */}
                    {user && (
                        <View style={[styles.topCardWrapper, { flex: 1.4 }]}>
                            <LeagueProgressWidget 
                                points={cochonsGiven} 
                                onInfoPress={() => router.push('/ligue-cochons')}
                                style={styles.leagueWidgetCompact}
                            />
                        </View>
                    )}

                    {/* 3. Section Action (Inviter + Jouer) */}
                    <Animated.View entering={FadeInUp.delay(400).duration(500)} style={[styles.topCardWrapper, { flex: 0.4 }]}>
                        <View style={{ flex: 1, flexDirection: 'column', gap: 8 }}>
                            {/* Bouton INVITER (haut) */}
                            <ShareTextButton 
                                text="Rejoins-moi sur Domino Martiniquais pour une petite partie ! Télécharge le jeu ici : https://play.domino-martinique.online/"
                                label="INVITER"
                                iconSize={24}
                                iconColor="#1A0E2E"
                                wrapperStyle={{ flex: 1, alignSelf: 'stretch' }}
                                buttonStyle={{
                                    flex: 1,
                                    width: '100%',
                                    borderRadius: 12,
                                    backgroundColor: '#42A5F5',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexDirection: 'column',
                                    gap: 2,
                                    elevation: 4,
                                    shadowColor: '#42A5F5',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 3,
                                }}
                            />

                            {/* Bouton JOUER (bas) */}
                            <PremiumButton
                                style={{
                                    flex: 1,
                                    borderRadius: 12,
                                    overflow: 'hidden',
                                    elevation: 8,
                                    shadowColor: '#FF9800',
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.4,
                                    shadowRadius: 5,
                                }}
                                onPress={() => router.push('/game-modes')}
                                soundName="notify"
                            >
                                <LinearGradient
                                    colors={['#FFD700', '#FF8C00']}
                                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    <Ionicons name="game-controller" size={24} color="#1A0E2E" />
                                    <Text style={{ color: '#1A0E2E', fontSize: 13, fontWeight: '900', letterSpacing: 1 }}>JOUER</Text>
                                </LinearGradient>
                            </PremiumButton>
                        </View>
                    </Animated.View>
                </View>
            </ScrollView>

            {/* Help Overlay */}
            <HelpOverlay 
                visible={showHelp} 
                onClose={() => setShowHelp(false)} 
            />



            {/* Welcome Reward Modal — Nouveau joueur */}
            <DailyRewardModal
                visible={showWelcomeReward && !reconnectRoomId}
                amount={NEW_PLAYER_COINS}
                isWelcome={true}
                onClaim={handleClaimWelcomeReward}
                onWatchAd={handleClaimWelcomeReward} // Même bouton pour récupérer
                onSkip={handleClaimWelcomeReward} // S'ils skippent, ils récupèrent quand même car c'est un don
            />

            {/* Daily Reward Modal — affiché uniquement si aucun modal de reconnexion */}
            <DailyRewardModal
                visible={showDailyReward && !reconnectRoomId}
                amount={dailyRewardAmount}
                onClaim={handleClaimDailyReward}
                onWatchAd={handleWatchAdForReward}
                onSkip={handleSkipDailyReward}
                claimTriggerRef={dailyClaimTriggerRef}
            />



            {/* Reconnection Modal */}
            <Modal
                visible={!!reconnectRoomId}
                transparent={true}
                animationType="fade"
            >
                <View style={styles.modalOverlay}>
                    <Animated.View entering={ZoomIn.duration(400)} style={styles.modalContent}>
                        <LinearGradient
                            colors={['#2D1B4E', '#422770']}
                            style={styles.modalGradient}
                        >
                            <Text style={styles.modalIcon}>📡</Text>
                            <Text style={styles.modalTitle}>Match en cours détecté</Text>
                            <Text style={styles.modalDescription}>
                                Vous avez une partie multijoueur toujours active. Rejoignez-la directement pour reprendre la main.
                            </Text>

                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    style={styles.modalButtonSecondary}
                                    onPress={handleCancelReconnect}
                                >
                                    <Text style={styles.modalButtonTextSecondary}>Ignorer</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.modalButtonPrimary}
                                    onPress={handleReconnect}
                                >
                                    <LinearGradient
                                        colors={['#FFD700', '#FFA500']}
                                        style={styles.modalButtonGradient}
                                    >
                                        <Text style={styles.modalButtonTextPrimary}>REJOINDRE LE MATCH</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </LinearGradient>
                    </Animated.View>
                </View>
            </Modal>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        height: 60,
        zIndex: 10,
    },
    headerCentered: {
        justifyContent: 'center',
    },
    headerTopLeft: {
        position: 'absolute',
        left: 20,
        zIndex: 100,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    headerShareBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFD700',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    headerLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
    },
    headerRightCentered: {
        justifyContent: 'center',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    helpButton: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: 'rgba(255,215,0,0.1)',
        borderWidth: 1.5,
        borderColor: 'rgba(255,215,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    userBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        padding: 4,
        paddingLeft: 12,
        borderRadius: 20,
        maxWidth: 160,
    },
    userName: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 14,
        marginRight: 8,
        flexShrink: 1,
    },
    avatarCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FFD700',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    avatarImage: {
        width: 32 * 1.6,
        height: 32 * 1.6,
        position: 'absolute',
        top: -(32 * 1.6 - 32) * 0.25,
    },
    avatarText: {
        color: '#1A0E2E',
        fontWeight: 'bold',
        fontSize: 18,
    },
    settingsButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    settingsIcon: {
        fontSize: 22,
    },
    cardsContainer: {
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12, // Reduced from 20
        paddingVertical: 8, // Reduced from 20
    },
    cardsContainerLandscape: {
        flexDirection: 'row',
        justifyContent: 'center',
        paddingHorizontal: '6%',
        gap: 16,
    },
    cardWrapper: {
        width: '100%',
        maxWidth: 280,
    },
    cardWrapperLandscape: {
        flex: 1,
        maxWidth: 300,
        minWidth: 160,
    },
    modeCard: {
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
    },
    cardGradient: {
        paddingVertical: 12, // Reduced from 24
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 100, // Reduced from 120
    },
    cardIcon: {
        fontSize: 32, // Reduced from 40
        marginBottom: 4, // Reduced from 8
    },
    cardTitle: {
        fontSize: 18, // Reduced from 20
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 2, // Reduced from 4
        textAlign: 'center',
    },
    cardDesc: {
        fontSize: 12, // Reduced from 13
        color: 'rgba(255,255,255,0.85)',
        textAlign: 'center',
    },
    lockOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.25)',
    },
    comingSoonBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#FF9800',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    comingSoonText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#fff',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        maxWidth: 400,
        borderRadius: 24,
        overflow: 'hidden',
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
    },
    modalGradient: {
        padding: 30,
        alignItems: 'center',
    },
    modalIcon: {
        fontSize: 50,
        marginBottom: 15,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#FFFFFF',
        marginBottom: 10,
        textAlign: 'center',
    },
    modalDescription: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 25,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 15,
        width: '100%',
    },
    modalButtonSecondary: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    modalButtonTextSecondary: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    modalButtonPrimary: {
        flex: 1,
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 4,
    },
    modalButtonGradient: {
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalButtonTextPrimary: {
        color: '#1A0E2E',
        fontSize: 14,
        fontWeight: '900',
    },
    newsContainer: {
        width: '100%',
        marginTop: 15,
        marginBottom: 30,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.3)',
    },
    newsGradient: {
        padding: 18,
    },
    newsHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    carouselIndicators: {
        flexDirection: 'row',
        gap: 3,
    },
    indicator: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    indicatorActive: {
        backgroundColor: '#FFD700',
        width: 8,
    },
    newsTitle: {
        color: '#FFD700',
        fontWeight: 'bold',
        fontSize: 14,
        letterSpacing: 1,
    },
    newsText: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 13,
        lineHeight: 20,
        marginBottom: 12,
    },
    newsReadMore: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    newsReadMoreText: {
        color: '#42A5F5',
        fontSize: 13,
        fontWeight: '600',
    },
    playButtonWrapper: {
        alignItems: 'center',
        marginTop: '5%',
        marginBottom: 20,
    },
    playButton: {
        borderRadius: 35,
        overflow: 'hidden',
        elevation: 12,
        shadowColor: '#FF9800',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        width: '80%',
        maxWidth: 300,
    },
    playButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        gap: 12,
    },
    playButtonIcon: {
        fontSize: 28,
    },
    playButtonText: {
        color: '#1A0E2E',
        fontSize: 24,
        fontWeight: '900',
        letterSpacing: 2,
    },
    topCardsRow: {
        flexDirection: 'row',
        width: '100%',
        gap: 8,
        paddingHorizontal: 10,
        marginTop: 15,
        marginBottom: 20,
        alignItems: 'stretch',
        height: 160,
    },
    sessionNoticeCard: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.18)',
        padding: 16,
        marginHorizontal: 10,
        marginTop: 6,
        marginBottom: 14,
    },
    sessionNoticeTitle: {
        color: '#FFD700',
        fontSize: 16,
        fontWeight: '900',
    },
    sessionNoticeText: {
        color: 'rgba(255,255,255,0.78)',
        fontSize: 13,
        lineHeight: 19,
        marginTop: 8,
    },
    sessionNoticeActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 14,
    },
    sessionNoticePrimary: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFD700',
        borderRadius: 14,
        paddingVertical: 12,
    },
    sessionNoticePrimaryText: {
        color: '#1A0E2E',
        fontSize: 13,
        fontWeight: '900',
    },
    sessionNoticeSecondary: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
        paddingVertical: 12,
    },
    sessionNoticeSecondaryText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '800',
    },
    topCardWrapper: {
        flex: 1,
        height: '100%',
        alignSelf: 'stretch',
    },
    leagueWidgetCompact: {
        maxWidth: '100%',
        marginBottom: 0,
        height: '100%',
    },
    newsContainerCompact: {
        flex: 1,
        height: '100%',
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.3)',
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    newsGradientCompact: {
        flex: 1,
        padding: 10,
    },
    newsTitleCompact: {
        color: '#FFD700',
        fontWeight: 'bold',
        fontSize: 11,
        letterSpacing: 1,
    },
    newsTextCompact: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 6,
    },
    playCardCompact: {
        flex: 1,
        height: '100%',
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#FF9800',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 5,
    },
    playGradientCompact: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
        gap: 5,
    },
    playIconCompact: {
        fontSize: 24,
    },
    playTextCompact: {
        color: '#1A0E2E',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 1,
    },
});
