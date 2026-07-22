import React, { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, useWindowDimensions, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, FadeInLeft, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HAND_SIZE, TURN_DURATION_SECONDS } from '../src/core/constants';
import { authService } from '../src/core/services/auth.service';
import { PlayerProfile } from '../src/core/types';
import { economyService } from '../src/core/services/economy.service';
import { TABLE_CONFIGS } from '../src/core/economy.constants';
import { GameModeCard } from '../src/components/GameModeCard';
import { SelectedModeHeader } from '../src/components/SelectedModeHeader';
import { TableTier } from '../src/core/economy.types';
import { EconomyHeader } from '../src/components/EconomyHeader';
import { findActiveRoomForUser } from '../src/core/services/firebase';
import { BotDifficulty, getFloorLevel, isLevelAllowed } from '../src/core/services/bot.service';
import { useInterstitialAd, AdMobIds } from '../src/core/services/AdMobAdapter';

type Difficulty = BotDifficulty;
type GameMode = 'MANCHE' | 'SCORE' | 'COCHON' | 'VICTOIRE';

const MODE_LABELS: Record<GameMode, string> = {
    VICTOIRE: 'Victoire',
    MANCHE: 'Manche',
    SCORE: 'Score',
    COCHON: 'Cochon',
};

const MODE_UNIT_LABELS: Record<GameMode, string> = {
    VICTOIRE: 'Victoires',
    MANCHE: 'Manches',
    SCORE: 'Points',
    COCHON: 'Cochons',
};

export default function SoloScreen() {
    const router = useRouter();
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const isLandscape = width > height;

    const [difficulty, setDifficulty] = useState<Difficulty>('MAPIPI');
    const [playerGrade, setPlayerGrade] = useState<string | null>(null);
    const [gameMode, setGameMode] = useState<GameMode>('COCHON');
    const [winningCondition, setWinningCondition] = useState(__DEV__ ? 1 : 10);
    const [turnDuration, setTurnDuration] = useState(TURN_DURATION_SECONDS);
    const [startingHandSize, setStartingHandSize] = useState(HAND_SIZE);
    const [user, setUser] = useState<PlayerProfile | null>(null);
    const [tableTier] = useState<TableTier>('DEBUTANT');
    const [economyRefresh, setEconomyRefresh] = useState(0);
    const [debitFeedback, setDebitFeedback] = useState<string | null>(null);
    const [uiStep, setUiStep] = useState<'MODE' | 'CONFIG'>('MODE');
    const [pendingGameStart, setPendingGameStart] = useState(false);

    const { isLoaded: isAdLoaded, isClosed: isAdClosed, load: loadAd, show: showAd } = useInterstitialAd(AdMobIds.INTERSTITIAL_LIGUE);

    React.useEffect(() => {
        if (Platform.OS !== 'web') {
            loadAd();
        }
    }, [loadAd]);

    React.useEffect(() => {
        if (pendingGameStart && isAdClosed) {
            setPendingGameStart(false);
            executeGameLaunch();
        }
    }, [pendingGameStart, isAdClosed]);

    // --- Calculs de Scaling Dynamique (4 colonnes) ---
    const HORIZONTAL_PADDING = 48; // mainWrapper paddingHorizontal (24 * 2)
    const GAP = 10;
    const availableWidth = width - HORIZONTAL_PADDING - (GAP * 3);
    const colWidth = availableWidth / 4;

    // Ratios basés sur l'étalon Configuration (Icon 48, Title 16)
    // On utilise Math.max pour garantir une lisibilité minimale sur très petits écrans
    const dynamicEmojiSize = Math.max(colWidth * 0.35, 24);
    const dynamicTitleSize = Math.max(colWidth * 0.14, 11);

    useFocusEffect(
        React.useCallback(() => {
            authService.getCurrentUser().then(u => {
                setUser(u);
                // Charger le grade du joueur pour calculer le plancher de difficulté
                economyService.getEconomy().then(eco => {
                    const grade = eco?.leagueGrade ?? null;
                    setPlayerGrade(grade);
                    setDifficulty(d => isLevelAllowed(grade, d) ? d : getFloorLevel(grade));
                }).catch(() => {});
            });
            setEconomyRefresh(v => v + 1);

        }, [])
    );

    const handleGoHome = () => {
        router.replace('/home');
    };

    const handleStartGame = async () => {
        if (isAdLoaded && Platform.OS !== 'web') {
            setPendingGameStart(true);
            try {
                showAd();
            } catch (e) {
                console.warn('Erreur affichage interstitiel', e);
                setPendingGameStart(false);
                await executeGameLaunch();
            }
        } else {
            await executeGameLaunch();
        }
    };

    const executeGameLaunch = async () => {
        if (!user?.uid || user.uid.startsWith('guest_')) {
            Alert.alert(
                'Connexion requise',
                'Vous devez être connecté pour lancer une partie.'
            );
            return;
        }

        const activeRoomId = await findActiveRoomForUser(user.uid);
        if (activeRoomId) {
            Alert.alert(
                'Match multijoueur en cours',
                'Vous avez une partie multijoueur encore active. Rejoignez-la avant de lancer une partie solo.',
                [
                    { text: 'Plus tard', style: 'cancel' },
                    {
                        text: 'Rejoindre le match',
                        onPress: () => router.push({ pathname: '/game/[id]', params: { id: activeRoomId, userId: user.uid } })
                    }
                ]
            );
            return;
        }

        const tableConfig = TABLE_CONFIGS[tableTier];

        // ── ANTI-QUIT : Déduire le buy-in AVANT de lancer la partie ──
        if (tableConfig.buyIn > 0) {
            const success = await economyService.deductBuyIn(
                tableConfig.buyIn,
                user?.uid
            );
            if (!success) {
                Alert.alert(
                    'Coins insuffisants 🪙',
                    `Il vous faut ${tableConfig.buyIn} coins pour jouer à la ${tableConfig.label}.\n\nVous n'en avez pas assez.`,
                    [{ text: 'OK', style: 'cancel' }]
                );
                return; // ❌ Bloquer la navigation
            }
            // 💸 Feedback visuel de débit
            setDebitFeedback(`-${tableConfig.buyIn} 🪙`);
            setEconomyRefresh(v => v + 1); // met à jour le solde visible
            setTimeout(() => setDebitFeedback(null), 1800);
        }

        // ── Option A : gameId stable basé sur l'UID ──
        // Même joueur = même clé AsyncStorage = restauration garantie après interruption.
        const soloGameId = `solo-${user.uid}`;

        // Si une partie était en cours, on la purge avant d'en démarrer une nouvelle.
        // (L'utilisateur a explicitement lancé une nouvelle partie depuis solo.tsx.)
        await AsyncStorage.removeItem(`@solo_game_state:${soloGameId}`).catch(() => {});

        // ✅ Buy-in débité, lancer la partie
        router.push({
            pathname: '/game/[id]',
            params: {
                id: soloGameId,
                authUid: user.uid,
                mode: 'solo',
                difficulty: difficulty,
                gameMode: gameMode,
                winningCondition: winningCondition,
                turnDuration: turnDuration,
                startingHandSize: startingHandSize,
                tableTier: tableTier,  // Passé pour le calcul des récompenses au MATCH_END
            }
        });
    };

    const updateTarget = (delta: number) => {
        setWinningCondition(prev => {
            const max = gameMode === 'VICTOIRE' ? 15 : gameMode === 'SCORE' ? 25 : gameMode === 'COCHON' ? 10 : 15;
            return Math.max(1, Math.min(max, prev + delta));
        });
    };

    return (
        <LinearGradient
            colors={['#2D1B4E', '#1A0E2E']}
            style={[styles.container, { minHeight: height }]}
        >
            <View style={[styles.backContainer, { top: insets.top + (Platform.OS === 'ios' ? 0 : 10) }]}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity style={styles.backButton} onPress={() => {
                        if (uiStep === 'CONFIG') {
                            setUiStep('MODE');
                        } else {
                            router.replace('/home');
                        }
                    }}>
                        <Ionicons name={uiStep === 'CONFIG' ? "arrow-back" : "home"} size={24} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{uiStep === 'CONFIG' ? 'Configuration' : 'Solo Mode'}</Text>
                </View>

                <EconomyHeader refreshTrigger={economyRefresh} />
            </View>

            <ScrollView
                contentContainerStyle={[styles.mainWrapper, isLandscape && { paddingTop: 60 }, { paddingBottom: insets.bottom + 20 }]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <Animated.View entering={FadeInUp.delay(200)} style={{ width: '100%', alignItems: 'center' }}>
                    <View style={styles.contentContainer}>
                        {/* STEP 1: MODE SELECTION */}
                        {uiStep === 'MODE' && (
                            <Animated.View entering={FadeInUp.duration(400)} style={styles.stepContainer}>
                                <View style={styles.modesGrid}>
                                    <GameModeCard
                                        id="SCORE"
                                        title="Score"
                                        description="Atteins l'objectif de points pour gagner la partie."
                                        icon="🎯"
                                        colors={['#0288D1', '#26C6DA']}
                                        onPress={() => { setGameMode('SCORE'); setWinningCondition(__DEV__ ? 1 : 15); setUiStep('CONFIG'); }}
                                        delay={100}
                                    />
                                    <GameModeCard
                                        id="COCHON"
                                        title="Cochons"
                                        description="Évite de rester à zéro point pour ne pas être le cochon !"
                                        icon="🐷"
                                        colors={['#EC407A', '#FF7043']}
                                        onPress={() => { setGameMode('COCHON'); setWinningCondition(__DEV__ ? 1 : 5); setUiStep('CONFIG'); }}
                                        delay={200}
                                    />
                                    <GameModeCard
                                        id="MANCHE"
                                        title="Manches"
                                        description="Joue un nombre fixe de manches et gagne au total."
                                        icon="🎲"
                                        colors={['#FFA000', '#FFD54F']}
                                        onPress={() => { setGameMode('MANCHE'); setWinningCondition(__DEV__ ? 1 : 10); setUiStep('CONFIG'); }}
                                        delay={300}
                                    />

                                    
                                </View>
                            </Animated.View>
                        )}

                        {/* STEP 2: CONFIGURATION */}
                        {uiStep === 'CONFIG' && (
                            <Animated.View entering={FadeInUp.duration(400)} style={styles.stepContainer}>
                                <SelectedModeHeader
                                    title={MODE_LABELS[gameMode]}
                                    description={
                                        gameMode === 'VICTOIRE' ? 'Premier à gagner rounds' :
                                        gameMode === 'SCORE' ? 'Objectif de points' :
                                        gameMode === 'COCHON' ? 'Éviter les cochons' : 'Nombre de manches'
                                    }
                                    icon={gameMode === 'VICTOIRE' ? '🏆' : gameMode === 'SCORE' ? '🎯' : gameMode === 'COCHON' ? '🐷' : '🎲'}
                                    colors={
                                        gameMode === 'VICTOIRE' ? ['#388E3C', '#66BB6A'] :
                                        gameMode === 'SCORE' ? ['#0288D1', '#26C6DA'] :
                                        gameMode === 'COCHON' ? ['#EC407A', '#FF7043'] :
                                        ['#FFA000', '#FFD54F']
                                    }
                                    onBack={() => setUiStep('MODE')}
                                    onActionPress={handleStartGame}
                                    actionCost={TABLE_CONFIGS[tableTier].buyIn}
                                />

                                <View style={styles.configSplitOuter}>
                                    {/* Right Col: Settings (Now full width) */}
                                    <View style={styles.configRightCol}>
                                        <View style={styles.paramsHorizontalStack}>
                                            {/* 1. Difficulté adaptative */}
                                            <View style={styles.paramItemHorizontal}>
                                                <Text style={styles.paramLabelSmall}>DIFFICULTÉ</Text>
                                                <View style={styles.diffToggleSmall}>
                                                    {(['TI_MANMAY', 'MAPIPI', 'GRAN_MOUN', 'METKAYALI'] as BotDifficulty[]).map((d) => {
                                                        const allowed = isLevelAllowed(playerGrade, d);
                                                        const isFloor = d === getFloorLevel(playerGrade);
                                                        return (
                                                            <TouchableOpacity
                                                                key={d}
                                                                style={[
                                                                    styles.diffBtnSmall,
                                                                    difficulty === d && styles.activeDiffBtnSmall,
                                                                    !allowed && styles.diffBtnLocked,
                                                                ]}
                                                                onPress={() => allowed && setDifficulty(d)}
                                                                disabled={!allowed}
                                                            >
                                                                <Text style={[styles.diffIconSmall, !allowed && { opacity: 0.3 }]}>
                                                                    {d === 'TI_MANMAY' ? '🌱' : d === 'MAPIPI' ? '🌶️' : d === 'GRAN_MOUN' ? '👑' : '🧠'}
                                                                </Text>
                                                                {!allowed && (
                                                                    <Text style={styles.diffLockIcon}>🔒</Text>
                                                                )}
                                                                {isFloor && allowed && (
                                                                    <View style={styles.diffFloorDot} />
                                                                )}
                                                            </TouchableOpacity>
                                                        );
                                                    })}
                                                </View>
                                                <Text style={styles.paramSubtext}>
                                                    {difficulty === 'TI_MANMAY' ? 'Facile' :
                                                     difficulty === 'MAPIPI' ? 'Moyen' :
                                                     difficulty === 'GRAN_MOUN' ? 'Difficile' : '👑 Mèt Kayali'}
                                                </Text>
                                            </View>

                                            {/* 2. Objectif */}
                                            <View style={styles.paramItemHorizontal}>
                                                <Text style={styles.paramLabelSmall}>OBJECTIF</Text>
                                                <View style={styles.stepperSmall}>
                                                    <TouchableOpacity onPress={() => updateTarget(-1)} style={styles.stepBtnSmall}>
                                                        <Ionicons name="remove" size={18} color="#FFF" />
                                                    </TouchableOpacity>
                                                    <Text style={styles.stepValueSmall}>{winningCondition}</Text>
                                                    <TouchableOpacity onPress={() => updateTarget(1)} style={styles.stepBtnSmall}>
                                                        <Ionicons name="add" size={18} color="#FFF" />
                                                    </TouchableOpacity>
                                                </View>
                                                <Text style={styles.paramSubtext}>
                                                    {MODE_UNIT_LABELS[gameMode]}
                                                </Text>
                                            </View>

                                            {/* 3. Vitesse */}
                                            <View style={styles.paramItemHorizontal}>
                                                <Text style={styles.paramLabelSmall}>VITESSE</Text>
                                                <View style={styles.stepperSmall}>
                                                    <TouchableOpacity onPress={() => setTurnDuration(prev => {
                                                        const steps = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
                                                        const idx = steps.indexOf(prev);
                                                        return idx > 0 ? steps[idx - 1] : steps[0];
                                                    })} style={styles.stepBtnSmall}>
                                                        <Ionicons name="remove" size={18} color="#FFF" />
                                                    </TouchableOpacity>
                                                    <Text style={styles.stepValueSmall}>{turnDuration}</Text>
                                                    <TouchableOpacity onPress={() => setTurnDuration(prev => {
                                                        const steps = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
                                                        const idx = steps.indexOf(prev);
                                                        return idx < steps.length - 1 ? steps[idx + 1] : steps[steps.length - 1];
                                                    })} style={styles.stepBtnSmall}>
                                                        <Ionicons name="add" size={18} color="#FFF" />
                                                    </TouchableOpacity>
                                                </View>
                                                <Text style={styles.paramSubtext}>secondes</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>


                                {debitFeedback && (
                                    <Animated.Text entering={FadeInLeft.duration(200)} style={styles.debitFeedback}>
                                        {debitFeedback} débités
                                    </Animated.Text>
                                )}
                            </Animated.View>
                        )}
                    </View>
                </Animated.View>
            </ScrollView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    backContainer: {
        position: 'absolute',
        top: 40,
        left: 16,
        right: 16,
        zIndex: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#FFF',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    mainWrapper: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24, // Increased for airiness
        paddingTop: 80,
    },
    contentContainer: {
        width: '100%',
        maxWidth: 800,
        alignItems: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        color: '#FFF',
        marginBottom: 30,
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 3,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    stepContainer: {
        width: '100%',
        alignItems: 'center',
    },
    stepTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: 'rgba(255,255,255,0.6)',
        marginBottom: 20,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    modesGrid: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 4,
        alignItems: 'stretch',
    },
    largeModeCard: {
        borderRadius: 18,
        overflow: 'hidden',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
    },
    largeModeGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 4, // Reduced to maximize content space
        gap: 2,
    },
    largeModeEmoji: {
        // fontSize removed for dynamic style
        marginBottom: 2,
    },
    largeModeInfo: {
        alignItems: 'center',
        width: '100%',
    },
    largeModeTitle: {
        // fontSize removed for dynamic style
        fontWeight: '900',
        color: '#FFF',
        textTransform: 'uppercase',
        textAlign: 'center',
    },
    largeModeDesc: {
        display: 'none', // Hide description on mobile to save space
    },
    configHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginBottom: 30,
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 16,
        borderRadius: 20,
        width: '100%',
    },
    selectedModeEmoji: {
        fontSize: 40,
    },
    selectedModeTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: '#FFF',
        textTransform: 'uppercase',
    },
    changeModeLink: {
        fontSize: 14,
        color: '#FFD700',
        fontWeight: '700',
        textDecorationLine: 'underline',
        marginTop: 2,
    },
    scrollHint: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 4,
        paddingBottom: 10,
    },
    scrollHintText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.4)',
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    // Split View Config
    configSplitOuter: {
        flexDirection: 'row',
        width: '100%',
        alignItems: 'center', // Centered for better look with smaller card
        gap: 30, // Increased gap for airiness
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 30, // Increased padding
        borderRadius: 32,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    configLeftCol: {
        flex: 0.8, // Reduced from 1.2 to make card smaller
        alignItems: 'center',
        justifyContent: 'center',
    },
    configRightCol: {
        flex: 3, // Increased to take more space
    },
    paramsHorizontalStack: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    paramItemHorizontal: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.08)',
        padding: 12,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 110,
    },
    paramLabelSmall: {
        fontSize: 9,
        fontWeight: '900',
        color: 'rgba(255,255,255,0.4)',
        marginBottom: 10,
        letterSpacing: 1.2,
    },
    paramSubtext: {
        fontSize: 9,
        color: 'rgba(255,255,255,0.3)',
        marginTop: 6,
    },
    // Small Controls
    diffToggleSmall: {
        flexDirection: 'row',
        gap: 8,
    },
    diffBtnSmall: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    activeDiffBtnSmall: {
        backgroundColor: '#FFD700',
    },
    diffBtnLocked: {
        opacity: 0.4,
    },
    diffLockIcon: {
        position: 'absolute',
        fontSize: 8,
        bottom: 2,
        right: 2,
    },
    diffFloorDot: {
        position: 'absolute',
        bottom: 3,
        right: 3,
        width: 5,
        height: 5,
        borderRadius: 3,
        backgroundColor: '#4CAF50',
    },
    diffIconSmall: {
        fontSize: 18,
    },
    stepperSmall: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    stepBtnSmall: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepValueSmall: {
        fontSize: 20,
        fontWeight: '900',
        color: '#FFF',
        minWidth: 30,
        textAlign: 'center',
    },
    gameModeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 30,
        gap: 12,
    },
    gameModeContainerLandscape: {
        marginBottom: 10,
        gap: 8,
    },
    gameModeTile: {
        flex: 1,
        borderRadius: 20,
        height: 160,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'transparent',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    gameModeTileLandscape: {
        height: 100, // ~38% reduction (from 160)
    },
    gameModeTileActive: {
        borderColor: '#FFD700',
        borderWidth: 3,
        transform: [{ scale: 1.02 }],
    },
    modeGradient: {
        flex: 1,
        padding: 15,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        borderRadius: 20,
    },
    modeGradientLandscape: {
        padding: 5,
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    modeIllustration: {
        fontSize: 40,
        marginBottom: 8,
    },
    modeIllustrationLandscape: {
        fontSize: 30,
        marginBottom: 0,
    },
    gameModeTitle: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: '900',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 1,
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 3,
    },
    gameModeTitleLandscape: {
        fontSize: 16,
    },
    gameModeSubtitle: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 4,
        fontWeight: '600',
    },
    gameModeSubtitleLandscape: {
        display: 'none', // Hide subtitle in landscape to save space
    },
    // --- Barre de Paramètres ---
    paramsContainer: {
        width: '100%',
        backgroundColor: 'rgba(30, 20, 50, 0.7)',
        borderRadius: 25,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        marginBottom: 20,
    },
    paramsContainerLandscape: {
        flexDirection: 'row',
        padding: 10,
        marginBottom: 10,
        flexWrap: 'nowrap',
        justifyContent: 'space-between',
    },
    paramCol: {
        flex: 1,
        alignItems: 'center',
        borderRightWidth: 1,
        borderRightColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 5,
    },
    paramColLandscape: {
        borderRightWidth: 1,
    },
    paramLabelContainer: {
        flex: 1,
    },
    paramLabel: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
    },
    paramValueDisplay: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '900',
        marginTop: 2,
    },
    paramValueSmall: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '700',
        marginTop: 5,
        opacity: 0.6,
        textTransform: 'uppercase',
    },
    // --- Sélecteurs ---
    stepper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        padding: 4,
        borderRadius: 15,
        gap: 4,
    },
    stepBtn: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepValue: {
        color: '#FFD700',
        fontSize: 22,
        fontWeight: '900',
        marginHorizontal: 15,
        minWidth: 25,
        textAlign: 'center',
        width: 40,
    },
    stepValueLandscape: {
        fontSize: 18,
        width: 30,
    },
    // --- Sélecteur de Difficulté ---
    diffToggle: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.3)',
        padding: 4,
        borderRadius: 15,
        gap: 8,
    },
    diffBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    activeDiffBtn: {
        backgroundColor: 'rgba(255,215,0,0.2)',
        borderWidth: 1,
        borderColor: '#FFD700',
    },
    diffIcon: {
        fontSize: 18,
    },
    // --- Sélecteur de Main ---
    handToggle: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.3)',
        padding: 4,
        borderRadius: 15,
        gap: 8,
    },
    handBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        paddingVertical: 4,
    },
    handBtnLandscape: {
        width: 30,
        height: 30,
    },
    activeHandBtn: {
        backgroundColor: '#FFD700',
        borderColor: '#FFF',
        elevation: 5,
    },
    dominoTop: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dominoDivider: {
        width: '80%',
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginVertical: 4,
    },
    activeDominoDivider: {
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    handText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '900',
    },
    handTextLandscape: {
        fontSize: 14,
    },
    activeHandText: {
        color: '#000',
    },
    // --- Bouton JOUER ---
    playButtonWrapper: {
        width: '100%',
        alignItems: 'center',
        marginTop: 'auto',
    },
    playButtonWrapperLandscape: {
        marginTop: 0,
    },
    playButton: {
        width: '100%',
        maxWidth: 400,
        height: 64,
        borderRadius: 32,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
    },
    playButtonLandscape: {
        height: 44,
        maxWidth: 300,
    },
    playGradient: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    playContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    costContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.15)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    costText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '900',
        marginLeft: 4,
    },
    costTextLandscape: {
        fontSize: 14,
    },
    playDivider: {
        width: 2,
        height: 24,
        backgroundColor: 'rgba(255,255,255,0.3)',
        marginHorizontal: 15,
    },
    playText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 1,
    },
    playTextLandscape: {
        fontSize: 14,
    },
    debitFeedback: {
        color: '#FFD700',
        position: 'absolute',
        top: -30,
        fontWeight: 'bold',
        fontSize: 16,
        marginTop: 12,
        textAlign: 'center',
    },
});

