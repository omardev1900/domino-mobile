import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { 
    ZoomIn, 
    FadeIn, 
    useSharedValue, 
    useAnimatedStyle, 
    withRepeat, 
    withSequence, 
    withTiming, 
    withDelay,
    useReducedMotion 
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Player } from '../../../core/types';
import { getAvatarImage, AvatarId } from '../../../core/avatars';
import SoundManager from '../../../core/audio/SoundManager';

interface WinnerHighlightProps {
    winner: Player | null;
    isTie: boolean;
    isBoude: boolean;
    localPlayerId: string;
    visible: boolean;
    onContinue: () => void;
    isHost?: boolean;
    /** Délai en ms avant passage automatique au round suivant (hôte uniquement). 0 = désactivé. */
    autoAdvanceDelay?: number;
    /**
     * Index 0-based du joueur local dans le tableau players (pour échelonner les fallbacks non-hôte).
     * Le fallback est plafonné à 3s pour respecter la limite UX entre deux rounds.
     */
    localPlayerIndex?: number;
    /** Une annonce compacte en haut laisse le dernier domino lisible à la fin du match. */
    compact?: boolean;
    /** Position visuelle de l'avatar avant son animation vers le centre. */
    origin?: 'top-left' | 'top-right' | 'bottom';
}

export const WinnerHighlight: React.FC<WinnerHighlightProps> = ({ winner, isTie, isBoude, localPlayerId, visible, onContinue, isHost = true, autoAdvanceDelay = 4000, localPlayerIndex = 0, compact = false, origin = 'bottom' }) => {
    const reducedMotion = useReducedMotion();
    const { height, width } = useWindowDimensions();
    const isSmallScreen = height < 700;
    const pulseScale = useSharedValue(1);
    const winnerScale = useSharedValue(1);
    const winnerOpacity = useSharedValue(1);
    const winnerTranslateX = useSharedValue(0);
    const winnerTranslateY = useSharedValue(0);
    const departureSparkle = useSharedValue(0);
    const travelAura = useSharedValue(0);
    const arrivalBurst = useSharedValue(0);

    const originOffset = useMemo(() => {
        const horizontalOffset = width * 0.32;
        const verticalOffset = height * 0.32;
        if (origin === 'top-right') return { x: horizontalOffset, y: -verticalOffset };
        if (origin === 'top-left') return { x: -horizontalOffset, y: -verticalOffset };
        return { x: -horizontalOffset, y: verticalOffset };
    }, [height, origin, width]);

    useEffect(() => {
        if (visible && winner && compact && !reducedMotion) {
            pulseScale.value = withRepeat(
                withSequence(
                    withTiming(1.15, { duration: 500 }),
                    withTiming(1, { duration: 500 })
                ),
                3, // loop 3 times
                true // reverse
            );
        }
    }, [visible, winner, reducedMotion, compact]);

    useEffect(() => {
        if (!visible || !winner || compact) {
            winnerScale.value = 1;
            winnerOpacity.value = 1;
            winnerTranslateX.value = 0;
            winnerTranslateY.value = 0;
            departureSparkle.value = 0;
            travelAura.value = 0;
            arrivalBurst.value = 0;
            return;
        }

        winnerScale.value = reducedMotion ? 1 : 0.45;
        winnerOpacity.value = reducedMotion ? 1 : 0;
        winnerTranslateX.value = reducedMotion ? 0 : originOffset.x;
        winnerTranslateY.value = reducedMotion ? 0 : originOffset.y;
        departureSparkle.value = 0;
        travelAura.value = 0;
        arrivalBurst.value = 0;

        if (reducedMotion) return;

        // L'avatar apparaît à la position de son joueur, clignote et zoome,
        // puis rejoint le centre du plateau pour annoncer le vainqueur.
        // Les VFX restent des calques Reanimated locaux : aucun asset lourd ni
        // rendu supplémentaire du plateau pendant cette transition.
        winnerOpacity.value = withSequence(
            withTiming(1, { duration: 120 }),
            withTiming(0.35, { duration: 110 }),
            withTiming(1, { duration: 110 }),
            withTiming(0.4, { duration: 110 }),
            withTiming(1, { duration: 110 }),
        );
        winnerScale.value = withSequence(
            withTiming(0.68, { duration: 220 }),
            withTiming(0.48, { duration: 180 }),
            withTiming(0.7, { duration: 140 }),
            withTiming(1.38, { duration: 600 }),
            withTiming(1.16, { duration: 220 }),
        );
        winnerTranslateX.value = withDelay(510, withTiming(0, { duration: 600 }));
        winnerTranslateY.value = withDelay(510, withTiming(0, { duration: 600 }));
        departureSparkle.value = withSequence(
            withTiming(1, { duration: 150 }),
            withTiming(0, { duration: 250 }),
        );
        travelAura.value = withSequence(
            withDelay(430, withTiming(0.9, { duration: 220 })),
            withTiming(0, { duration: 480 }),
        );
        arrivalBurst.value = withSequence(
            withDelay(1030, withTiming(1, { duration: 150 })),
            withTiming(0, { duration: 500 }),
        );
    }, [compact, originOffset, reducedMotion, visible, winner]);

    useEffect(() => {
        if (visible && winner) {
            const timer = setTimeout(() => {
                SoundManager.playSound('bravo');
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [visible, !!winner]);

    // Passage automatique au round suivant — hôte en priorité (autoAdvanceDelay ms).
    // Évite le blocage si l'hôte ne clique pas (lag réseau, bloqueur de pub, distraction).
    useEffect(() => {
        if (!visible || !isHost || autoAdvanceDelay <= 0) return;
        const timer = setTimeout(() => {
            onContinue();
        }, autoAdvanceDelay);
        return () => clearTimeout(timer);
    }, [visible, isHost, autoAdvanceDelay]);

    // Fallback non-hôte : si la phase n'a toujours pas changé après le délai échelonné,
    // ce client tente la transition à son tour. Le stateVersion + runTransaction dans
    // safeUpdateGameState rejette silencieusement le doublon si l'hôte a déjà écrit.
    // FIX-400: délais échelonnés par index pour éviter que tous les non-hôtes écrivent
    // simultanément et provoquent des FAILED_PRECONDITION en cascade.
    // Pour la fin définitive, cette transition ne modifie pas l'état partagé :
    // tous les clients peuvent donc conserver le même délai de lecture étendu.
    useEffect(() => {
        if (!visible || isHost || !autoAdvanceDelay || autoAdvanceDelay <= 0) return;
        const fallbackDelay = compact
            ? autoAdvanceDelay
            : Math.min(autoAdvanceDelay * 2 + localPlayerIndex * 2000, 3000);
        const timer = setTimeout(() => {
            onContinue();
        }, fallbackDelay);
        return () => clearTimeout(timer);
    }, [visible, isHost, autoAdvanceDelay, localPlayerIndex, compact]);

    const winnerMotionStyle = useAnimatedStyle(() => ({
        opacity: compact ? 1 : winnerOpacity.value,
        transform: [
            { translateX: compact ? 0 : winnerTranslateX.value },
            { translateY: compact ? 0 : winnerTranslateY.value },
            { scale: compact ? pulseScale.value : winnerScale.value },
        ],
    }));

    const departureSparkleStyle = useAnimatedStyle(() => ({
        opacity: departureSparkle.value,
        transform: [{ scale: 0.55 + departureSparkle.value * 0.8 }],
    }));

    const travelAuraStyle = useAnimatedStyle(() => ({
        opacity: travelAura.value,
        transform: [{ scale: 0.8 + travelAura.value * 0.65 }],
    }));

    const arrivalBurstStyle = useAnimatedStyle(() => ({
        opacity: arrivalBurst.value,
        transform: [{ scale: 0.45 + arrivalBurst.value * 1.45 }],
    }));

    if (!visible) return null;

    return (
        <Animated.View 
            entering={FadeIn.duration(400)}
            style={[styles.container, compact && styles.compactContainer]}
            pointerEvents="box-none"
        >
            {isTie ? (
                <View style={styles.centerBox}>
                    <Animated.Text 
                        entering={reducedMotion ? undefined : ZoomIn.springify()} 
                        style={styles.tieText}
                    >
                        ÉGALITÉ ⚖️
                    </Animated.Text>
                    <Animated.Text 
                        entering={reducedMotion ? undefined : FadeIn.delay(300)} 
                        style={styles.tieSubtext}
                    >
                        Le round est annulé et va recommencer.
                    </Animated.Text>

                </View>
            ) : winner ? (
                <View style={[styles.centerBox, compact && styles.compactCenterBox]}>
                    {compact && <Text style={styles.matchCompleteText}>MATCH TERMINÉ</Text>}
                    {compact ? (
                        <Text style={styles.compactWinnerName}>
                            {isBoude
                                ? `${winner.name || 'Joueur'} remporte le match`
                                : (winner.id === localPlayerId
                                    ? 'Vous remportez le match'
                                    : `${winner.name || 'Joueur'} remporte le match`)}
                        </Text>
                    ) : (
                        <>
                    <Animated.View style={[
                        styles.avatarWrapper, 
                        winnerMotionStyle,
                        isSmallScreen && { width: 100, height: 100 }
                    ]}>
                        <Animated.View style={[styles.departureSparkle, departureSparkleStyle]}>
                            <Text style={styles.departureSparkleText}>✦</Text>
                            <Text style={[styles.departureSparkleText, styles.departureSparkleSide]}>✧</Text>
                        </Animated.View>
                        <Animated.View style={[styles.travelAura, travelAuraStyle]} />
                        <Animated.View style={[styles.arrivalBurst, arrivalBurstStyle]}>
                            <Text style={styles.arrivalBurstText}>✦</Text>
                            <Text style={[styles.arrivalBurstText, styles.arrivalBurstTop]}>✦</Text>
                            <Text style={[styles.arrivalBurstText, styles.arrivalBurstLeft]}>✦</Text>
                            <Text style={[styles.arrivalBurstText, styles.arrivalBurstRight]}>✦</Text>
                        </Animated.View>
                        <Image
                            source={getAvatarImage((winner.avatarId as AvatarId) || 'avatar_default')}
                            style={[styles.avatar, isSmallScreen && { width: 100, height: 100, borderRadius: 50 }]}
                            contentFit="cover"
                        />
                        <Animated.Text
                            entering={reducedMotion ? undefined : ZoomIn.delay(1000).springify()}
                            style={[styles.crown, isSmallScreen && { fontSize: 36, top: -20, right: -15 }]}
                        >
                            👑
                        </Animated.Text>
                    </Animated.View>
                    <Animated.View entering={reducedMotion ? undefined : FadeIn.delay(1120)}>
                        <Text style={[styles.winnerName, isSmallScreen && { fontSize: 18, marginTop: 10 }]}>
                            {isBoude 
                                ? `${winner.name || 'Joueur'} a gagné ce round`
                                : (winner.id === localPlayerId 
                                    ? "Vous avez posé tous vos dominos"
                                    : `${winner.name || 'Joueur'} a posé tous ses dominos`)}
                        </Text>
                    </Animated.View>
                        </>
                    )}
                </View>
            ) : null}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1500,
    },
    centerBox: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    compactContainer: {
        justifyContent: 'flex-start',
        paddingTop: 24,
    },
    compactCenterBox: {
        backgroundColor: 'rgba(18, 12, 35, 0.9)',
        borderColor: '#FFD700',
        borderRadius: 16,
        borderWidth: 1,
        elevation: 12,
        maxWidth: '88%',
        paddingHorizontal: 20,
        paddingVertical: 12,
        shadowColor: '#000000',
        shadowOpacity: 0.35,
        shadowRadius: 10,
    },
    matchCompleteText: {
        color: '#FFD700',
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 1.5,
        textAlign: 'center',
    },
    compactWinnerName: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '800',
        marginTop: 4,
        textAlign: 'center',
    },
    avatarWrapper: {
        position: 'relative',
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 30,
        elevation: 20,
    },
    avatar: {
        width: 140,
        height: 140,
        borderRadius: 70,
        borderWidth: 4,
        borderColor: '#FFD700',
        zIndex: 2,
    },
    departureSparkle: {
        alignItems: 'center',
        height: 80,
        justifyContent: 'center',
        left: 30,
        position: 'absolute',
        top: 24,
        width: 80,
        zIndex: 3,
    },
    departureSparkleText: {
        color: '#FFF6B0',
        fontSize: 52,
        textShadowColor: '#FFD700',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 12,
    },
    departureSparkleSide: {
        fontSize: 28,
        position: 'absolute',
        right: 0,
        top: 0,
    },
    travelAura: {
        backgroundColor: 'rgba(255, 215, 0, 0.34)',
        borderColor: 'rgba(255, 248, 180, 0.9)',
        borderRadius: 92,
        borderWidth: 2,
        bottom: -18,
        left: -18,
        position: 'absolute',
        right: -18,
        top: -18,
        zIndex: 0,
    },
    arrivalBurst: {
        alignItems: 'center',
        height: 220,
        justifyContent: 'center',
        left: -40,
        position: 'absolute',
        top: -40,
        width: 220,
        zIndex: 3,
    },
    arrivalBurstText: {
        color: '#FFFFFF',
        fontSize: 28,
        position: 'absolute',
        textShadowColor: '#FFD700',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 14,
    },
    arrivalBurstTop: {
        top: 8,
    },
    arrivalBurstLeft: {
        left: 14,
    },
    arrivalBurstRight: {
        right: 14,
    },
    crown: {
        position: 'absolute',
        top: -30,
        right: -15,
        fontSize: 50,
        textShadowColor: 'rgba(255,215,0,0.5)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 15,
        zIndex: 4,
    },
    winnerText: {
        marginTop: 25,
        fontSize: 22,
        fontWeight: 'bold',
        color: '#FFD700',
        textTransform: 'uppercase',
        letterSpacing: 4,
        textShadowColor: 'rgba(0,0,0,0.7)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
        zIndex: 20,
        elevation: 20,
    },
    winnerName: {
        marginTop: 15,
        fontSize: 22,
        fontWeight: 'bold',
        color: '#FFFFFF',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 1, height: 2 },
        textShadowRadius: 3,
        letterSpacing: 1,
        zIndex: 20,
        elevation: 20,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    tieText: {
        fontSize: 42,
        fontWeight: '900',
        color: '#4A90E2',
        letterSpacing: 4,
        textShadowColor: 'rgba(74,144,226,0.5)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 15,
    },
    tieSubtext: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.75)',
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 20,
    },
    buttonContainer: {
        marginTop: 40,
        alignSelf: 'center',
    },
    continueButton: {
        backgroundColor: '#FFD700',
        paddingHorizontal: 40,
        paddingVertical: 15,
        borderRadius: 30,
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 5,
    },
    continueText: {
        color: '#000000',
        fontSize: 18,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
});
