import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions, Platform, ScrollView, Modal } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, ZoomIn, ZoomOut, useSharedValue, useAnimatedStyle, withDelay, withRepeat, withTiming, withSequence, withSpring, Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { MatchReward, RewardBreakdown, LeagueFrameId } from '../core/economy.types';
import { LEAGUE_LABELS, LEAGUE_ICONS, LEAGUE_GRADE_COLORS, MAX_LEVEL, LEAGUE_FRAME_GRADE_ORDER, LEAGUE_FRAME_THRESHOLDS, LEAGUE_FRAMES_ENABLED } from '../core/economy.constants';
import { xpRequiredForLevel, getLevelUpChest } from '../core/RewardEngine';
import { LevelUpOverlay } from './LevelUpOverlay';
import SoundManager from '../core/audio/SoundManager';
import { AvatarFrame } from './AvatarFrame';
import { ShareImageButton, GradeShareCard, buildGradeShareText } from './ShareButton';


import RollingNumber from './RollingNumber';

interface RewardOverlayProps {
    visible: boolean;
    reward: MatchReward | null;
    isWinner: boolean;
    onContinue: () => void;
    playerName?: string;
}

function getGradeTheme(grade: NonNullable<MatchReward['newGrade']>) {
    const accent = typeof LEAGUE_GRADE_COLORS !== 'undefined' ? LEAGUE_GRADE_COLORS[grade] : '#888888';
    if (grade === 'DEBUTANT') {
        return {
            accent,
            glow: 'rgba(124,179,66,0.35)',
            panel: ['rgba(124,179,66,0.20)', 'rgba(18,24,12,0.98)'] as const,
            chip: 'rgba(124,179,66,0.16)',
        };
    }
    if (grade.startsWith('APPRENTI')) {
        return {
            accent,
            glow: 'rgba(200,200,200,0.35)',
            panel: ['rgba(200,200,200,0.18)', 'rgba(26,14,46,0.98)'] as const,
            chip: 'rgba(200,200,200,0.16)',
        };
    }
    if (grade.startsWith('MAITRE')) {
        return {
            accent,
            glow: 'rgba(255,215,0,0.4)',
            panel: ['rgba(255,215,0,0.20)', 'rgba(26,14,46,0.98)'] as const,
            chip: 'rgba(255,215,0,0.18)',
        };
    }
    if (grade === 'ROI') {
        return {
            accent,
            glow: 'rgba(58,134,255,0.42)',
            panel: ['rgba(58,134,255,0.20)', 'rgba(26,14,46,0.98)'] as const,
            chip: 'rgba(58,134,255,0.18)',
        };
    }
    return {
        accent,
        glow: 'rgba(220,20,60,0.45)',
        panel: ['rgba(220,20,60,0.20)', 'rgba(26,14,46,0.98)'] as const,
        chip: 'rgba(220,20,60,0.18)',
    };
}

const XPIcon = ({ size = 18 }: { size?: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="12" cy="12" r="11" fill="#A5D6A7" />
        <SvgText
            x="12"
            y="16"
            fill="#1A0E2E"
            fontSize="11"
            fontWeight="bold"
            textAnchor="middle"
        >
            XP
        </SvgText>
    </Svg>
);


// ─── Main Overlay ───────────────────────────────────────────────────────────
export function RewardOverlay({ visible, reward, isWinner, onContinue, playerName = '' }: RewardOverlayProps) {
    const { width, height } = useWindowDimensions();
    const isLandscape = width > height;
    const [infoModalVisible, setInfoModalVisible] = useState(false);
    
    // État pour afficher la modale "Nouveau Cadre" s'il y en a un
    const [showFrameModal, setShowFrameModal] = useState(false);
    // Modale grade-up (uniquement si pas de nouveau cadre, pour éviter le double-popup)
    const [showGradeUpModal, setShowGradeUpModal] = useState(false);
    const [gradeUpApplausePlayed, setGradeUpApplausePlayed] = useState(false);

    const [showLevelUpModal, setShowLevelUpModal] = useState(false);
    const [levelUpDismissed, setLevelUpDismissed] = useState(false);

    // Animation flottante pour le cadre (Déplacée au niveau racine absolu, avant tout return conditionnel !)
    const floatingStyle = useAnimatedStyle(() => {
        return {
            transform: [{
                translateY: withRepeat(withTiming(-5, { duration: 1500, easing: Easing.inOut(Easing.ease) }), -1, true)
            }]
        };
    });

    useEffect(() => {
        if (visible && reward?.leveledUp && !levelUpDismissed) {
             const timer = setTimeout(() => setShowLevelUpModal(true), 1500);
             return () => clearTimeout(timer);
        } else {
             setShowLevelUpModal(false);
        }
    }, [visible, reward, levelUpDismissed]);

    const canShowLeagueModals = !reward?.leveledUp || levelUpDismissed;

    useEffect(() => {
        if (canShowLeagueModals && LEAGUE_FRAMES_ENABLED && visible && reward && reward.newlyUnlockedFrames && reward.newlyUnlockedFrames.length > 0) {
            const timer = setTimeout(() => setShowFrameModal(true), reward.leveledUp ? 500 : 1500);
            return () => clearTimeout(timer);
        } else {
            setShowFrameModal(false);
        }
    }, [visible, reward, canShowLeagueModals]);

    useEffect(() => {
        // Modale grade-up uniquement si gradeUp sans nouveau cadre (sinon le cadre affiche déjà les félicitations)
        if (canShowLeagueModals && visible && reward && (reward.gradeUp || (reward.frameCoinsBonus ?? 0) > 0) && (!LEAGUE_FRAMES_ENABLED || !(reward.newlyUnlockedFrames?.length > 0))) {
            const timer = setTimeout(() => setShowGradeUpModal(true), reward.leveledUp ? 500 : 100);
            return () => clearTimeout(timer);
        } else {
            setShowGradeUpModal(false);
        }
    }, [visible, reward, canShowLeagueModals]);

    useEffect(() => {
        if (!showGradeUpModal) return;
        SoundManager.playSound('leagueJingle');
    }, [showGradeUpModal]);

    useEffect(() => {
        if (!showGradeUpModal || gradeUpApplausePlayed) return;
        const timer = setTimeout(() => {
            SoundManager.playSound('applause');
            setGradeUpApplausePlayed(true);
        }, 800);
        return () => clearTimeout(timer);
    }, [showGradeUpModal, gradeUpApplausePlayed]);

    useEffect(() => {
        if (!showGradeUpModal) {
            setGradeUpApplausePlayed(false);
        }
    }, [showGradeUpModal]);

    // Son pour les pièces de monnaie s'il n'y a pas de gradeUp (ex: pub boutique)
    useEffect(() => {
        if (visible && reward && reward.coinsEarned > 0 && !showGradeUpModal) {
            const timer = setTimeout(() => {
                SoundManager.playSound('notify'); // Son "ching" ou notification
            }, 600);
            return () => clearTimeout(timer);
        }
    }, [visible, reward, showGradeUpModal]);

    if (!visible || !reward) return null;

    const isLevelUp = reward.leveledUp;
    const isGradeUp = reward.gradeUp;
    const gradeTheme = reward.newGrade ? getGradeTheme(reward.newGrade) : null;
    const popupScrollMaxHeight = height * (isLandscape ? 0.9 : 0.82);
    const isStandaloneGradeUp = (isGradeUp || (reward.frameCoinsBonus ?? 0) > 0) && (!LEAGUE_FRAMES_ENABLED || !reward.newlyUnlockedFrames || reward.newlyUnlockedFrames.length === 0);
    // displayGrade: grade a afficher dans la modale (newGrade si passage de grade mensuel,
    // sinon previousGrade si c'est juste un passage de palier cochons sans changement de grade)
    const displayGrade = reward.newGrade ?? reward.previousGrade;
    const shouldHideMainRewardContent = isStandaloneGradeUp && showGradeUpModal;

    return (
        <Animated.View
            entering={FadeIn.duration(400)}
            exiting={FadeOut.duration(300)}
            style={[styles.container, { width, height }]}
        >
            <LinearGradient
                colors={['rgba(26, 14, 46, 0.95)', 'rgba(10, 5, 20, 0.98)']}
                style={StyleSheet.absoluteFillObject}
            />

            {!shouldHideMainRewardContent && (
                <>
            {/* Boutique Bouton CONTINUER (Centre Haut) */}
            <TouchableOpacity
                style={[styles.continuePill, { top: isLandscape ? 15 : 40 }]}
                onPress={onContinue}
                activeOpacity={0.8}
            >
                <LinearGradient
                    colors={['#FFD700', '#FFA500']}
                    style={styles.continueGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                >
                    <Text style={styles.continueText}>CONTINUER</Text>
                    <Ionicons name="arrow-forward" size={20} color="#1A0E2E" />
                </LinearGradient>
            </TouchableOpacity>

            {/* Commandes du haut (Coin Supérieur Droit) - Uniquement Info maintenant */}
            <View style={[styles.headerControls, { top: isLandscape ? 15 : 40, left: (isLandscape ? 15 : 20) + width * 0.2 }]}>
                {/* Bouton Détails */}
                <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => setInfoModalVisible(true)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="information-circle-outline" size={32} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
            </View>

            <Animated.View
                entering={ZoomIn.duration(600).springify()}
                exiting={ZoomOut}
                style={[
                    styles.mainContent,
                    isLandscape && styles.mainContentLandscape
                ]}
            >
                {/* ZONE 1: HEADER (Title & Icons) */}
                <View style={[styles.flexHeaderZone, isLandscape && { paddingBottom: 5 }]}>
                    {isWinner && (
                        <Text style={[styles.title, isLandscape && styles.titleLandscape, { color: '#FFD700' }]}>
                            🏆 VICTOIRE 🏆
                        </Text>
                    )}

                    {/* Level Up & Grade Up Banners */}
                    <View style={[styles.bannersContainer, isLandscape && styles.bannersContainerLandscape]}>
                        {isLevelUp && (
                            <Animated.View entering={FadeInDown.delay(600)} style={styles.levelUpBanner}>
                                <Text style={styles.levelUpText}>⭐ NIV. {reward.newLevel} ! ⭐</Text>
                            </Animated.View>
                        )}

                        {isGradeUp && reward.newGrade && (
                            <Animated.View entering={FadeInDown.delay(800)} style={styles.gradeUpBanner}>
                                <Text style={styles.gradeUpText}>
                                    🐷 {LEAGUE_LABELS[reward.newGrade]} ! 🐷
                                </Text>
                            </Animated.View>
                        )}
                    </View>
                </View>

                {/* ZONE 2: BODY (Totals & XP Bar) */}
                <View style={[styles.flexBodyZone, isLandscape && styles.flexBodyZoneLandscape]}>
                    {/* Totals Section */}
                    <View style={[styles.totalsContainer, isLandscape && styles.totalsContainerLandscape]}>
                        <Animated.View entering={FadeInDown.delay(1000)} style={styles.totalBox}>
                            <LinearGradient colors={['rgba(255,215,0,0.1)', 'rgba(0,0,0,0.5)']} style={styles.totalBoxGradient}>
                                <Text style={styles.totalIcon}>🪙</Text>
                                <RollingNumber value={reward.coinsEarned} prefix="+" style={styles.totalValue} />
                                <Text style={styles.totalLabel}>Coins</Text>
                            </LinearGradient>
                        </Animated.View>

                        {reward.xpEarned > 0 && (
                            <Animated.View entering={FadeInDown.delay(1200)} style={styles.totalBox}>
                                <LinearGradient colors={['rgba(255,215,0,0.1)', 'rgba(0,0,0,0.5)']} style={styles.totalBoxGradient}>
                                    <View style={{ marginBottom: 4, height: 32, justifyContent: 'center' }}>
                                        <XPIcon size={30} />
                                    </View>
                                    <RollingNumber value={reward.xpEarned} prefix="+" style={styles.totalValue} />
                                    <Text style={styles.totalLabel}>XP</Text>
                                </LinearGradient>
                            </Animated.View>
                        )}

                        {reward.diamondsEarned > 0 && (
                            <Animated.View entering={FadeInDown.delay(1400)} style={styles.totalBox}>
                                <LinearGradient colors={['rgba(96,220,255,0.1)', 'rgba(0,0,0,0.5)']} style={styles.totalBoxGradient}>
                                    <Text style={styles.totalIcon}>💎</Text>
                                    <RollingNumber
                                        value={reward.diamondsEarned}
                                        prefix="+"
                                        style={[styles.totalValue, { color: '#60DCFF' }]}
                                    />
                                    <Text style={styles.totalLabel}>Diamants</Text>
                                </LinearGradient>
                            </Animated.View>
                        )}

                        {reward.leaguePointsEarned > 0 && (
                            <Animated.View entering={FadeInDown.delay(1600)} style={styles.totalBox}>
                                <LinearGradient colors={['rgba(255,152,0,0.1)', 'rgba(0,0,0,0.5)']} style={styles.totalBoxGradient}>
                                    <Text style={styles.totalIcon}>🐷</Text>
                                    <RollingNumber
                                        value={reward.leaguePointsEarned}
                                        prefix="+"
                                        style={[styles.totalValue, { color: '#FF9800' }]}
                                    />
                                    <Text style={styles.totalLabel}>Ligue</Text>
                                </LinearGradient>
                            </Animated.View>
                        )}
                    </View>

                </View>

                {/* ZONE 3: FOOTER (Continue) */}
                <View style={styles.flexFooterZone}>
                    {/* The next button is already in headerControls, but we can move it here or keep it as is.
                        The user asked for consistency, let's keep it in the flow if possible.
                    */}
                </View>
            </Animated.View>
                </>
            )}

            {/* Modal Détails des Gains */}
            <Modal
                visible={infoModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setInfoModalVisible(false)}
            >
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setInfoModalVisible(false)}>
                    <TouchableOpacity activeOpacity={1} style={styles.breakdownModalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.breakdownTitle}>Détails des gains</Text>
                            <TouchableOpacity onPress={() => setInfoModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Ionicons name="close-circle" size={28} color="#FFD700" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ flexGrow: 0, maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                            {reward.breakdown.map((item, index) => (
                                <Animated.View
                                    key={item.id}
                                    entering={FadeInDown.delay(100 + (index * 100))}
                                    style={styles.breakdownRow}
                                >
                                    <Text style={styles.breakdownLabel}>{item.label}</Text>
                                    <View style={styles.breakdownValues}>
                                        {item.coins > 0 && <Text style={styles.breakdownValText}>+{item.coins}🪙</Text>}
                                        {item.xp > 0 && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                <Text style={styles.breakdownValText}>+{item.xp}</Text>
                                                <XPIcon size={16} />
                                            </View>
                                        )}
                                        {item.leaguePoints > 0 && <Text style={styles.breakdownValText}>+{item.leaguePoints}🐷</Text>}
                                        {item.diamonds > 0 && <Text style={[styles.breakdownValText, { color: '#60DCFF' }]}>+{item.diamonds}💎</Text>}
                                    </View>
                                </Animated.View>
                            ))}
                        </ScrollView>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* Modale NOUVEAU CADRE DÉBLOQUÉ */}
            {LEAGUE_FRAMES_ENABLED && reward.newlyUnlockedFrames && reward.newlyUnlockedFrames.length > 0 && (
                <Modal
                    visible={showFrameModal}
                    animationType="fade"
                    transparent={true}
                    onRequestClose={() => setShowFrameModal(false)}
                >
                    <View style={styles.modalOverlay}>
                        {(() => {
                            const firstEvent = reward.newlyUnlockedFrames[0];
                            const currentGrade = firstEvent.grade;
                            const label = LEAGUE_LABELS[currentGrade];
                            const icon = LEAGUE_ICONS[currentGrade];
                            const cochons = firstEvent.cochonsAtUnlock;
                            
                            const frameName = `CADRE ${LEAGUE_LABELS[currentGrade].toUpperCase()}`;

                            // Calcul de la progression
                            let nextGrade: string | null = null;
                            let nextThreshold: number | null = null;
                            for (const g of LEAGUE_FRAME_GRADE_ORDER) {
                                if (LEAGUE_FRAME_THRESHOLDS[g] > cochons) {
                                    nextGrade = g;
                                    nextThreshold = LEAGUE_FRAME_THRESHOLDS[g];
                                    break;
                                }
                            }

                            const prevGradeIndex = LEAGUE_FRAME_GRADE_ORDER.indexOf(currentGrade) - 1;
                            const prevThreshold = prevGradeIndex >= 0 ? LEAGUE_FRAME_THRESHOLDS[LEAGUE_FRAME_GRADE_ORDER[prevGradeIndex]] : 0;
                            
                            const remaining = nextThreshold ? nextThreshold - cochons : 0;
                            const progressPercent = nextThreshold ? Math.min(100, Math.max(0, ((cochons - prevThreshold) / (nextThreshold - prevThreshold)) * 100)) : 100;
                            const nextGradeLabel = nextGrade ? LEAGUE_LABELS[nextGrade as keyof typeof LEAGUE_LABELS] : '';
                            const totalCoinsBonus = reward.newlyUnlockedFrames.reduce((acc, curr) => acc + curr.coinsBonus, 0);

                            return (
                                <TouchableOpacity 
                                    activeOpacity={0.9} 
                                    onPress={() => setShowFrameModal(false)}
                                    style={{ width: '100%', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <ScrollView
                                        style={[styles.modalScroll, { maxHeight: popupScrollMaxHeight }]}
                                        contentContainerStyle={styles.modalScrollContent}
                                        showsVerticalScrollIndicator={false}
                                        bounces={false}
                                    >
                                    <View style={styles.celebrationHeader}>
                                        <Text style={styles.celebrationTitle}>FÉLICITATIONS !</Text>
                                    </View>
                                    <Animated.View 
                                        entering={ZoomIn.duration(800).springify()} 
                                        style={[
                                            styles.frameUnlockModalContent,
                                                isLandscape && styles.frameUnlockModalContentLandscape
                                        ]}
                                    >
                                        <View style={[
                                            styles.frameUnlockBody,
                                            isLandscape && styles.frameUnlockBodyLandscape
                                        ]}>
                                            {/* Colonne Gauche : PROGRESSION */}
                                            <View style={[styles.column, styles.columnLeft]}>
                                                <Text style={styles.columnSubtitle}>VOTRE GRADE</Text>
                                                <View style={styles.gradeBox}>
                                                    <Text style={styles.gradeIcon}>{icon}</Text>
                                                    <View>
                                                        <Text style={styles.gradeTitle}>{label}</Text>
                                                        <Text style={styles.gradeSubtext}>{cochons} COCHONS atteint</Text>
                                                    </View>
                                                </View>

                                                {nextGrade && (
                                                    <View style={styles.objectiveBox}>
                                                        <Text style={styles.columnSubtitle}>OBJECTIF SUIVANT</Text>
                                                        <View style={styles.nextObjectiveInfo}>
                                                            <Text style={styles.nextObjectiveText}>
                                                                Encore <Text style={{fontWeight: 'bold', color: '#FFD700'}}>{remaining} COCHONS</Text> pour '{nextGradeLabel}' !
                                                            </Text>
                                                        </View>
                                                        <View style={styles.progressBarBg}>
                                                            <Animated.View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                                                        </View>
                                                        <Text style={styles.progressText}>{cochons}/{nextThreshold} Cochons</Text>
                                                    </View>
                                                )}
                                            </View>

                                            {/* Séparateur vertical en mode paysage */}
                                            {isLandscape && <View style={styles.verticalDivider} />}

                                            {/* Colonne Droite : BUTIN */}
                                            <View style={[styles.column, styles.columnRight]}>
                                                <Text style={styles.columnSubtitle}>BUTIN GAGNÉ</Text>
                                                <View style={styles.framesContainer}>
                                                    {reward.newlyUnlockedFrames.map((fEvent, idx) => (
                                                        <View key={idx} style={styles.frameShowcase}>
                                                            <Animated.View style={[styles.frameDisplay, floatingStyle]}>
                                                                <View style={styles.shimmerEffect} />
                                                                <View style={styles.fakeAvatar} />
                                                                <AvatarFrame frameId={fEvent.frameId as LeagueFrameId} size={isLandscape ? 110 : 100} />
                                                            </Animated.View>
                                                            <Text style={styles.frameNameTag}>{frameName}</Text>
                                                        </View>
                                                    ))}
                                                </View>

                                                <View style={styles.frameCoinsBadgeBig}>
                                                    <Text style={styles.frameCoinsValBig}>+</Text>
                                                    <RollingNumber 
                                                        value={totalCoinsBonus} 
                                                        duration={1500} 
                                                        style={styles.frameCoinsValBig} 
                                                    />
                                                    <Text style={styles.frameCoinsSymbol}> 🪙</Text>
                                                </View>
                                                <Text style={styles.coinsSubtext}>PIÈCES DE JEU</Text>
                                                
                                                <Text style={styles.tapToCloseText}>
                                                    (Appuyez pour continuer)
                                                </Text>
                                            </View>

                                        </View>
                                    </Animated.View>
                                    </ScrollView>
                                </TouchableOpacity>
                            );
                        })()}
                    </View>
                </Modal>
            )}

            {/* Modale PASSAGE DE GRADE ou BONUS PALIER COCHON (sans nouveau cadre visuel) */}
            {isStandaloneGradeUp && displayGrade && (
                <Modal
                    visible={showGradeUpModal}
                    animationType="fade"
                    transparent={true}
                    onRequestClose={() => setShowGradeUpModal(false)}
                >
                    <View style={styles.modalOverlay}>
                        <Animated.View
                            entering={ZoomIn.duration(700).springify()}
                            style={[
                                styles.gradeUpModalContent,
                                styles.gradeUpModalContentCentered,
                                gradeTheme && {
                                    borderColor: gradeTheme.accent,
                                    shadowColor: gradeTheme.accent,
                                    backgroundColor: gradeTheme.chip,
                                },
                            ]}
                        >
                            <TouchableOpacity
                                accessibilityRole="button"
                                accessibilityLabel="Fermer celebration"
                                style={styles.gradeUpCloseButton}
                                onPress={() => setShowGradeUpModal(false)}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="close" size={22} color="#FFFFFF" />
                            </TouchableOpacity>
                            <Text style={styles.gradeUpSimpleTitle}>FELICITATIONS !</Text>
                            <Text style={styles.gradeUpModalIcon}>
                                {LEAGUE_ICONS[displayGrade]}
                            </Text>
                            <Text style={[styles.gradeUpModalGrade, gradeTheme && { color: gradeTheme.accent }]}>
                                {LEAGUE_LABELS[displayGrade].toUpperCase()}
                            </Text>
                            <Text style={[styles.gradeUpModalCochons, gradeTheme && { color: gradeTheme.accent }]}>
                                {reward.newLeaguePoints} COCHONS INFLIGES
                            </Text>
                            {/* BUG-LEAGUE-TIER-REWARD: afficher les coins de bonus de palier */}
                            {reward.frameCoinsBonus > 0 && (
                                <View style={styles.gradeUpCoinsContainer}>
                                    <Text style={styles.gradeUpCoinsLabel}>PIÈCES GAGNÉES</Text>
                                    <View style={styles.gradeUpCoinsRow}>
                                        <Text style={styles.gradeUpCoinsPlus}>+</Text>
                                        <RollingNumber
                                            value={reward.frameCoinsBonus}
                                            duration={1200}
                                            style={styles.gradeUpCoinsValue}
                                        />
                                        <Text style={styles.gradeUpCoinSymbol}> 🪙</Text>
                                    </View>
                                </View>
                            )}
                            <ShareImageButton
                                text={buildGradeShareText({
                                    gradeLabel: LEAGUE_LABELS[displayGrade],
                                    totalCochons: reward.newLeaguePoints,
                                })}
                                label="Partager mon palier"
                            >
                                <GradeShareCard
                                    playerName={playerName}
                                    gradeLabel={LEAGUE_LABELS[displayGrade]}
                                    gradeIcon={LEAGUE_ICONS[displayGrade]}
                                    totalCochons={reward.newLeaguePoints}
                                    accentColor={gradeTheme?.accent ?? '#FFD700'}
                                />
                            </ShareImageButton>
                        </Animated.View>
                    </View>
                </Modal>
            )}

            {/* Modale Passage de Niveau */}
            {reward && reward.leveledUp && (
                <LevelUpOverlay
                    visible={showLevelUpModal}
                    level={reward.newLevel}
                    coins={getLevelUpChest(reward.newLevel)?.coinsReward || 50}
                    diamonds={getLevelUpChest(reward.newLevel)?.diamondReward || 0}
                    onClose={() => setLevelUpDismissed(true)}
                />
            )}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(10, 5, 20, 0.95)',
        justifyContent: 'center', // Center in the screen
        alignItems: 'center',
        zIndex: 10000,
        ...Platform.select({
            web: { backdropFilter: 'blur(10px)' }
        })
    },
    headerControls: {
        position: 'absolute',
        zIndex: 10001,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    continuePill: {
        position: 'absolute',
        zIndex: 10002,
        alignSelf: 'center',
    },
    continueGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 25,
        borderRadius: 30,
        gap: 8,
        elevation: 10,
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 10,
    },
    continueText: {
        color: '#1A0E2E',
        fontWeight: '900',
        fontSize: 16,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    mainContent: {
        width: '88%',
        maxWidth: 550,
        alignItems: 'center',
        zIndex: 10,
        backgroundColor: 'rgba(30, 15, 50, 0.4)',
        padding: 5,
        borderRadius: 20,
    },
    mainContentLandscape: {
        width: '100%',
        maxWidth: 800,
        flexDirection: 'column',
    },
    flexHeaderZone: {
        alignItems: 'center',
        width: '100%',
        marginBottom: 5,
    },
    flexBodyZone: {
        alignItems: 'center',
        width: '100%',
    },
    flexBodyZoneLandscape: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-start',
        gap: 20,
    },
    flexFooterZone: {
        marginTop: 10,
    },
    title: {
        fontSize: 24,
        fontWeight: '900',
        letterSpacing: 2,
        marginBottom: 4,
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 4 },
        textShadowRadius: 8,
    },
    titleLandscape: {
        fontSize: 22,
        marginBottom: 4,
    },
    bannersContainer: {
        alignItems: 'center',
        marginBottom: 10,
        minHeight: 30,
        width: '100%',
    },
    bannersContainerLandscape: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
        marginBottom: 5,
    },
    levelUpBanner: {
        backgroundColor: 'rgba(76, 175, 80, 0.9)',
        borderWidth: 1.5,
        borderColor: '#81C784',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 15,
        marginBottom: 5,
        shadowColor: '#4CAF50',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
        elevation: 5,
    },
    levelUpText: {
        color: '#FFF',
        fontWeight: '900',
        fontSize: 14,
        letterSpacing: 1,
    },
    gradeUpBanner: {
        backgroundColor: 'rgba(255, 152, 0, 0.9)',
        borderWidth: 1.5,
        borderColor: '#FFB74D',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 15,
        marginBottom: 5,
        shadowColor: '#FF9800',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
        elevation: 5,
    },
    gradeUpText: {
        color: '#FFF',
        fontWeight: '900',
        fontSize: 14,
        letterSpacing: 1,
    },
    gradeUpModalContent: {
        backgroundColor: 'rgba(26, 14, 46, 0.98)',
        borderWidth: 2,
        borderColor: '#FF9800',
        borderRadius: 20,
        paddingHorizontal: 18,
        paddingVertical: 18,
        alignItems: 'center',
        width: '82%',
        maxWidth: 340,
        shadowColor: '#FF9800',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 20,
        elevation: 20,
    },
    gradeUpModalContentCentered: {
        width: '86%',
        maxWidth: 360,
        minWidth: 280,
        paddingTop: 54,
        paddingBottom: 20,
    },
    gradeUpSimpleTitle: {
        color: '#FFD700',
        fontSize: 22,
        fontWeight: '900',
        letterSpacing: 1.2,
        textAlign: 'center',
        marginBottom: 14,
        textTransform: 'uppercase',
    },
    gradeUpModalContentLandscapePhone: {
        width: '92%',
        maxWidth: 720,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    gradeUpLandscapeHeader: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    gradeUpLandscapeTitle: {
        color: '#FFD700',
        fontSize: 22,
        fontWeight: '900',
        letterSpacing: 1.3,
    },
    gradeUpLandscapeBody: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: 14,
    },
    gradeUpLandscapeColumnMain: {
        flex: 1.15,
        justifyContent: 'space-between',
    },
    gradeUpLandscapeColumnSide: {
        width: 210,
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    gradeUpLandscapeHeroRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8,
    },
    gradeUpLandscapeHeroText: {
        flex: 1,
    },
    gradeUpLandscapeSharePreview: {
        transform: [{ scale: 0.72 }],
        marginBottom: -28,
        marginTop: -22,
    },
    gradeUpModalShell: {
        borderRadius: 20,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.75,
        shadowRadius: 24,
        elevation: 20,
    },
    gradeUpAccentPill: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
        marginBottom: 10,
    },
    gradeUpAccentPillCompact: {
        marginBottom: 0,
    },
    gradeUpAccentPillText: {
        color: '#FFD700',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 1.2,
    },
    gradeUpModalIcon: {
        fontSize: 52,
        marginBottom: 8,
    },
    gradeUpModalIconLandscape: {
        fontSize: 42,
        marginBottom: 0,
    },
    gradeUpModalTitle: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: 2,
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    gradeUpModalGrade: {
        color: '#FFD700',
        fontSize: 22,
        fontWeight: '900',
        letterSpacing: 2,
        textAlign: 'center',
        marginBottom: 8,
    },
    gradeUpModalGradeLandscape: {
        fontSize: 24,
        letterSpacing: 1,
        textAlign: 'left',
        marginBottom: 4,
    },
    gradeUpModalCochons: {
        color: '#FF9800',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 10,
        textAlign: 'center',
    },
    gradeUpCoinsContainer: {
        alignItems: 'center',
        marginBottom: 12,
        marginTop: 4,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 12,
        backgroundColor: 'rgba(255,215,0,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.3)',
        width: '100%',
    },
    gradeUpCoinsLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    gradeUpCoinsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    gradeUpCoinsPlus: {
        color: '#FFD700',
        fontSize: 24,
        fontWeight: '900',
    },
    gradeUpCoinsValue: {
        color: '#FFD700',
        fontSize: 28,
        fontWeight: '900',
        letterSpacing: 1,
    },
    gradeUpCoinSymbol: {
        color: '#FFD700',
        fontSize: 24,
        fontWeight: '900',
    },
    gradeUpCloseButton: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
        zIndex: 1,
    },
    gradeUpModalCochonsLandscape: {
        fontSize: 14,
        marginBottom: 0,
        textAlign: 'left',
    },
    gradeUpModalSubtitle: {
        color: 'rgba(255,255,255,0.78)',
        fontSize: 13,
        lineHeight: 19,
        textAlign: 'center',
        marginBottom: 16,
        maxWidth: 320,
    },
    gradeUpModalSubtitleLandscape: {
        maxWidth: '100%',
        fontSize: 12,
        lineHeight: 17,
        textAlign: 'left',
        marginBottom: 10,
    },
    gradeUpStatsRow: {
        width: '100%',
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 10,
        marginBottom: 16,
    },
    gradeUpStatsRowLandscape: {
        gap: 8,
        marginBottom: 0,
    },
    gradeUpStatChip: {
        flex: 1,
        minWidth: 120,
        borderWidth: 1,
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 10,
        alignItems: 'center',
    },
    gradeUpStatChipLandscape: {
        minWidth: 0,
        paddingVertical: 8,
        paddingHorizontal: 8,
    },
    gradeUpStatValue: {
        color: '#FFD700',
        fontSize: 16,
        fontWeight: '900',
        textAlign: 'center',
    },
    gradeUpStatValueLandscape: {
        fontSize: 14,
    },
    gradeUpStatValueMuted: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '900',
        textAlign: 'center',
    },
    gradeUpStatLabel: {
        color: 'rgba(255,255,255,0.55)',
        fontSize: 10,
        fontWeight: '700',
        marginTop: 4,
        textAlign: 'center',
        textTransform: 'uppercase',
    },
    gradeUpActions: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
        marginTop: 12,
    },
    gradeUpActionsLandscape: {
        gap: 8,
        marginTop: 10,
    },
    gradeUpActionButtonLandscape: {
        minWidth: 116,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    gradeUpPrimaryButton: {
        minWidth: 132,
        backgroundColor: '#FFD700',
        borderRadius: 18,
        paddingHorizontal: 18,
        paddingVertical: 12,
        alignItems: 'center',
    },
    gradeUpPrimaryButtonText: {
        color: '#1A0E2E',
        fontSize: 14,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    gradeUpSecondaryButton: {
        minWidth: 132,
        borderRadius: 18,
        paddingHorizontal: 18,
        paddingVertical: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.28)',
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    gradeUpSecondaryButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    totalsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap', // Allow wrapping if 4 boxes are too wide
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        maxWidth: 580, // Increased to fit 4 boxes better
        gap: 8,
        marginBottom: 10,
    },
    totalsContainerLandscape: {
        marginBottom: 0,
        flex: 1,
    },
    totalBox: {
        flex: 1,
        maxWidth: 140,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.3)',
        shadowColor: 'rgba(255,215,0,0.2)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.8,
        shadowRadius: 6,
        elevation: 3,
    },
    totalBoxGradient: {
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 6,
    },
    totalIcon: {
        fontSize: 24,
        marginBottom: 2,
    },
    totalValue: {
        fontSize: 22,
        fontWeight: '900',
        color: '#FFD700',
        marginBottom: 2,
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    totalLabel: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.7)',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    // --- Modale Détails ---
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalScroll: {
        width: '100%',
    },
    modalScrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 18,
    },
    breakdownModalContent: {
        width: '90%',
        maxWidth: 450,
        backgroundColor: 'rgba(30, 15, 50, 0.98)',
        borderRadius: 16,
        padding: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.3)',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        paddingBottom: 8,
    },
    breakdownTitle: {
        color: '#FFD700',
        fontSize: 14,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    breakdownRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 8,
        borderRadius: 6,
    },
    breakdownLabel: {
        color: '#FFF',
        fontSize: 13,
    },
    breakdownValues: {
        flexDirection: 'row',
        gap: 8,
    },
    breakdownValText: {
        color: '#FFD700',
        fontWeight: 'bold',
        fontSize: 14,
    },
    // --- Cadre Unlock Modal ---
    celebrationHeader: {
        marginBottom: 15,
        alignItems: 'center',
    },
    celebrationTitle: {
        color: '#FFD700',
        fontSize: 28,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 2,
        textShadowColor: 'rgba(255, 215, 0, 0.5)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
    frameUnlockModalContent: {
        width: '92%',
        maxWidth: 500,
        backgroundColor: 'rgba(20, 10, 35, 0.98)',
        borderRadius: 22,
        padding: 24,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFD700',
        elevation: 10,
        shadowColor: '#FFD700',
        shadowOpacity: 0.3,
        shadowRadius: 20,
        maxHeight: '90%',
    },
    frameUnlockModalContentLandscape: {
        maxWidth: 700,
        paddingVertical: 20,
    },
    frameUnlockBody: {
        width: '100%',
        alignItems: 'center',
    },
    frameUnlockBodyLandscape: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    column: {
        width: '100%',
        alignItems: 'center',
    },
    columnLeft: {
        flex: 1,
        paddingBottom: 15,
    },
    columnRight: {
        flex: 1,
        paddingTop: 15,
    },
    verticalDivider: {
        width: 1,
        height: '90%',
        backgroundColor: 'rgba(255, 215, 0, 0.3)',
        marginHorizontal: 15,
    },
    columnSubtitle: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 1.5,
        marginBottom: 10,
    },
    gradeBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        padding: 12,
        borderRadius: 12,
        marginBottom: 20,
        width: '100%',
        maxWidth: 250,
    },
    gradeIcon: {
        fontSize: 32,
        marginRight: 10,
    },
    gradeTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    gradeSubtext: {
        color: '#4CAF50',
        fontSize: 12,
        fontWeight: 'bold',
        marginTop: 2,
    },
    objectiveBox: {
        width: '100%',
        maxWidth: 250,
        alignItems: 'center',
    },
    nextObjectiveInfo: {
        marginBottom: 8,
    },
    nextObjectiveText: {
        color: '#FFF',
        fontSize: 13,
        textAlign: 'center',
    },
    progressBarBg: {
        width: '100%',
        height: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 6,
        overflow: 'hidden',
        marginBottom: 5,
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#FFD700',
        borderRadius: 6,
    },
    progressText: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 11,
    },
    framesContainer: {
        alignItems: 'center',
        marginBottom: 15,
    },
    frameShowcase: {
        alignItems: 'center',
    },
    frameDisplay: {
        width: 130,
        height: 130,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
        position: 'relative',
    },
    shimmerEffect: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 215, 0, 0.15)',
        borderRadius: 65,
        transform: [{ scale: 1.2 }],
    },
    fakeAvatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    frameNameTag: {
        color: '#FFD700',
        fontWeight: 'bold',
        fontSize: 15,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    frameCoinsBadgeBig: {
        flexDirection: 'row',
        alignItems: 'baseline',
        backgroundColor: 'rgba(255,215,0,0.15)',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#FFD700',
        marginBottom: 5,
    },
    frameCoinsValBig: {
        color: '#FFD700',
        fontWeight: '900',
        fontSize: 24,
    },
    frameCoinsSymbol: {
        fontSize: 20,
        marginLeft: 5,
    },
    coinsSubtext: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 11,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    tapToCloseText: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 12,
        marginTop: 20,
        fontStyle: 'italic',
    },
});
