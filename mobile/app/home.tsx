
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    View,
    StyleSheet,
    Text,
    TouchableOpacity,
    ScrollView,
    Modal,
    Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeInRight, ZoomIn } from 'react-native-reanimated';
import { authService } from '../src/core/services/auth.service';
import { statsService } from '../src/core/services/stats.service';
import { economyService } from '../src/core/services/economy.service';
import { PlayerProfile } from '../src/core/types';
import { DAILY_REWARD_COINS, LEAGUE_GRADE_COLORS, LOW_COINS_PROMPT_THRESHOLD, NEW_PLAYER_COINS } from '../src/core/economy.constants';
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
import { PremiumButton } from '../src/components/common/PremiumButton';
import { premiumService } from '../src/core/services/premium.service';

let hasShownAppOpenAd = false;

export default function HomeScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [user, setUser] = useState<PlayerProfile | null>(null);
    const dailyClaimTriggerRef = useRef<(() => void) | null>(null);
    const [showHelp, setShowHelp] = useState(false);
    const [newsList, setNewsList] = useState<NewsItem[]>([]);
    const [currentNewsIndex, setCurrentNewsIndex] = useState(0);
    const [economyRefresh, setEconomyRefresh] = useState(0);
    const [cochonsGiven, setCochonsGiven] = useState(0);
    const [myLeagueGrade, setMyLeagueGrade] = useState<LeagueGrade | null>(null);
    const [showDailyReward, setShowDailyReward] = useState(false);
    const [showWelcomeReward, setShowWelcomeReward] = useState(false);
    const [showLowCoinsPrompt, setShowLowCoinsPrompt] = useState(false);
    const [dailyRewardAmount, setDailyRewardAmount] = useState(0);
    const [isProcessingRewardAd, setIsProcessingRewardAd] = useState(false);
    const [hasPremium, setHasPremium] = useState(false);
    const [premiumStatusResolved, setPremiumStatusResolved] = useState(false);
    const { isLoaded: isRewardLoaded, isClosed: isRewardClosed, isEarnedReward, load: loadReward, show: showReward } = useRewardedAd(AdMobIds.REWARDED_FIN_PARTIE);
    const { isLoaded: isAppOpenLoaded, load: loadAppOpen, show: showAppOpen } = useAppOpenAd(AdMobIds.APP_OPEN);

    const AD_FALLBACK_TIMEOUT_MS = 8000;
    const adFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isProcessingRewardAdRef = useRef(false);
    const lowCoinsPromptShownRef = useRef(false);

    useEffect(() => {
        isProcessingRewardAdRef.current = isProcessingRewardAd;
    }, [isProcessingRewardAd]);

    useFocusEffect(
        useCallback(() => {
        let active = true;
        premiumService.hasActiveAccess().then((activeAccess) => {
            if (active) setHasPremium(activeAccess);
        }).finally(() => {
            if (active) setPremiumStatusResolved(true);
        });
        return () => {
            active = false;
        };
        }, [])
    );

    // Initialiser la pub d'ouverture d'app (une seule fois par session)
    useEffect(() => {
        if (premiumStatusResolved && !hasPremium && user && Platform.OS !== 'web' && !hasShownAppOpenAd) {
            loadAppOpen();
        }
    }, [hasPremium, loadAppOpen, premiumStatusResolved, user]);

    useEffect(() => {
        if (premiumStatusResolved && !hasPremium && user && isAppOpenLoaded && !hasShownAppOpenAd) {
            hasShownAppOpenAd = true;
            try {
                showAppOpen();
            } catch (error) {
                console.warn('Erreur affichage pub App Open:', error);
            }
        }
    }, [hasPremium, isAppOpenLoaded, premiumStatusResolved, showAppOpen, user]);
    useEffect(() => {
        if (premiumStatusResolved && !hasPremium) {
            loadReward();
        }
    }, [hasPremium, loadReward, premiumStatusResolved]);

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
            if (!hasPremium) loadReward(); // preload next only for non-Premium players
        }
    }, [hasPremium, isRewardClosed, isEarnedReward, loadReward, isProcessingRewardAd]);

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
                    // La reprise d'une partie multijoueur est contrôlée une seule fois
                    // par useMultiResume dans le layout global.

                    // 1. Synchronisation
                    // [R3-B12] syncFromFirebase AVANT isDailyRewardAvailable — sinon le timestamp
                    // n'est pas encore chargé depuis Firestore et le cadeau réapparaît à chaque connexion
                    await Promise.all([
                        statsService.syncWithFirebase(u.uid),
                        economyService.syncFromFirebase(u.uid),
                    ]);

                    if (cancelled) return;
                    await refreshMonthlyLeague();
                    if (cancelled) return;

                    // 2. Évaluation des cadeaux (base serveur fiable)
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
                    } else {
                        const economy = await economyService.getEconomy();
                        if (
                            !cancelled
                            && Platform.OS !== 'web'
                            && economy.coins <= LOW_COINS_PROMPT_THRESHOLD
                            && !lowCoinsPromptShownRef.current
                        ) {
                            lowCoinsPromptShownRef.current = true;
                            setTimeout(() => {
                                if (!cancelled) setShowLowCoinsPrompt(true);
                            }, 700);
                        }
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

    return (
        <LinearGradient
            colors={['#2D1B4E', '#1A0E2E']}
            style={styles.container}
        >
            {/* Header Area */}
            <View style={[styles.header, { paddingTop: insets.top || 20 }, USE_NEW_SIDEBAR && styles.headerCentered]}>
                {/* Top Left: Help (Visible on all devices) */}
                <View style={[styles.headerTopLeft, { top: (insets.top || 20) + 12 }]}>
                    <ShareTextButton
                        text="Rejoins-moi sur Domino Martiniquais pour une petite partie ! Télécharge le jeu ici : https://play.domino-martinique.online/"
                        iconOnly
                        iconSize={22}
                        iconColor="#FFD700"
                        buttonStyle={styles.inviteHeaderButton}
                        wrapperStyle={styles.inviteHeaderWrapper}
                    />
                    {!USE_NEW_SIDEBAR && (
                        <>
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
                        </>
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
                <View style={styles.topCardsRow}>
                    {/* 1. Nouveau bloc Actualités - CAROUSEL */}
                    <Animated.View entering={FadeInUp.delay(200).duration(500)} style={[styles.topCardWrapper, styles.compactTopCard]}>
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

                    {/* 2. Bloc Niveau Cochon */}
                    {user && (
                        <View style={[styles.topCardWrapper, styles.compactTopCard]}>
                            <LeagueProgressWidget 
                                points={cochonsGiven} 
                                onInfoPress={() => router.push('/ligue-cochons')}
                                style={styles.leagueWidgetCompact}
                            />
                        </View>
                    )}

                    {/* 3. Premium — après Mon Grade */}
                    <Animated.View entering={FadeInUp.delay(320).duration(500)} style={[styles.topCardWrapper, styles.compactTopCard]}>
                        <TouchableOpacity style={styles.premiumHomeCard} onPress={() => router.push('/premium' as never)} activeOpacity={0.86}>
                            <LinearGradient colors={['#6A3C8F', '#36204F']} style={styles.premiumHomeGradient}>
                                <View style={styles.premiumHomeIcon}>
                                    <Ionicons name="star" size={22} color="#2D1B4E" />
                                </View>
                                <Text style={styles.premiumHomeTitle}>PREMIUM</Text>
                                <Text style={styles.premiumHomeText}>3 jours gratuits</Text>
                                <Ionicons name="chevron-forward" size={17} color="#FFD700" />
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>

                    {/* Section Action : S'entraîner + Jouer */}
                    <Animated.View entering={FadeInUp.delay(400).duration(500)} style={[styles.topCardWrapper, styles.actionsTopCard]}>
                        <View style={{ flex: 1, flexDirection: 'column', gap: 8 }}>
                            {/* Bouton S'ENTRAÎNER (haut) : conserve la taille d'Inviter */}
                            <PremiumButton
                                style={{
                                    flex: 1,
                                    width: '100%',
                                    borderRadius: 12,
                                    overflow: 'hidden',
                                    elevation: 4,
                                    shadowColor: '#4CAF50',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 3,
                                }}
                                onPress={() => router.push('/training')}
                                soundName="notify"
                            >
                                <LinearGradient
                                    colors={['#70B77E', '#2E7D32']}
                                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }}
                                >
                                    <Ionicons name="school" size={24} color="#F4FFF3" />
                                    <Text style={{ color: '#F4FFF3', fontSize: 11, fontWeight: '900', letterSpacing: 0.6 }}>S'ENTRAÎNER</Text>
                                </LinearGradient>
                            </PremiumButton>

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
                visible={showWelcomeReward}
                amount={NEW_PLAYER_COINS}
                isWelcome={true}
                onClaim={handleClaimWelcomeReward}
                onWatchAd={handleClaimWelcomeReward} // Même bouton pour récupérer
                onSkip={handleClaimWelcomeReward} // S'ils skippent, ils récupèrent quand même car c'est un don
                showAdReward={!hasPremium}
            />

            {/* Daily Reward Modal — affiché uniquement si aucun modal de reconnexion */}
            <DailyRewardModal
                visible={showDailyReward && premiumStatusResolved}
                amount={dailyRewardAmount}
                onClaim={handleClaimDailyReward}
                onWatchAd={handleWatchAdForReward}
                onSkip={handleSkipDailyReward}
                claimTriggerRef={dailyClaimTriggerRef}
                showAdReward={!hasPremium}
            />

            {/* Réserve basse : le bouton ouvre volontairement le flux vidéo unique de la boutique. */}
            <Modal
                visible={showLowCoinsPrompt && !showDailyReward && !showWelcomeReward}
                transparent
                animationType="fade"
                onRequestClose={() => setShowLowCoinsPrompt(false)}
            >
                <View style={styles.modalOverlay}>
                    <Animated.View entering={ZoomIn.duration(280)} style={styles.modalContent}>
                        <LinearGradient colors={['#2D1B4E', '#422770']} style={styles.modalGradient}>
                            <Text style={styles.modalIcon}>🪙</Text>
                            <Text style={styles.modalTitle}>Réserve de coins faible</Text>
                            <Text style={styles.modalDescription}>
                                Il vous reste peu de coins. Gardez au moins 100 coins pour pouvoir continuer à jouer.{"\n\n"}
                                Regardez une vidéo récompensée pour gagner 100 coins.
                            </Text>
                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    style={styles.modalButtonSecondary}
                                    onPress={() => setShowLowCoinsPrompt(false)}
                                >
                                    <Text style={styles.modalButtonTextSecondary}>PLUS TARD</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.modalButtonPrimary}
                                    onPress={() => {
                                        setShowLowCoinsPrompt(false);
                                        router.push('/store');
                                    }}
                                >
                                    <LinearGradient colors={['#FFD700', '#FFA500']} style={styles.modalButtonGradient}>
                                        <Text style={styles.modalButtonTextPrimary}>VOIR</Text>
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
    inviteHeaderWrapper: { alignItems: 'center' },
    inviteHeaderButton: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: 'rgba(255,215,0,0.1)',
        borderWidth: 1.5,
        borderColor: 'rgba(255,215,0,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
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
        marginBottom: 10,
        alignItems: 'stretch',
        height: 132,
    },
    compactTopCard: {
        flex: 1,
    },
    premiumHomeCard: {
        flex: 1,
        overflow: 'hidden',
        borderRadius: 13,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.52)',
    },
    premiumHomeGradient: {
        flex: 1,
        paddingHorizontal: 8,
        paddingVertical: 9,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    premiumHomeIcon: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFD700',
    },
    premiumHomeTitle: { color: '#FFD700', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
    premiumHomeText: { color: 'rgba(255,255,255,0.82)', fontSize: 10, fontWeight: '700', textAlign: 'center' },
    actionsTopCard: { flex: 0.55 },
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
    trainingHomeButton: {
        flex: 1,
        height: '100%',
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 7,
        shadowColor: '#4CAF50',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 5,
    },
    trainingHomeGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 4,
    },
    trainingHomeText: {
        color: '#F4FFF3',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.5,
        textAlign: 'center',
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
