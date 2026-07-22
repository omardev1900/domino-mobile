import React, { useEffect } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { 
    ZoomIn, 
    FadeIn, 
    useSharedValue, 
    useAnimatedStyle, 
    withRepeat, 
    withSequence, 
    withTiming, 
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
     * Index 0 → 8s, index 1 → 10s, index 2 → 12s. Évite que tous les non-hôtes écrivent simultanément.
     */
    localPlayerIndex?: number;
}

export const WinnerHighlight: React.FC<WinnerHighlightProps> = ({ winner, isTie, isBoude, localPlayerId, visible, onContinue, isHost = true, autoAdvanceDelay = 4000, localPlayerIndex = 0 }) => {
    const reducedMotion = useReducedMotion();
    const { height } = useWindowDimensions();
    const isSmallScreen = height < 700;
    const pulseScale = useSharedValue(1);

    useEffect(() => {
        if (visible && winner && !reducedMotion) {
            pulseScale.value = withRepeat(
                withSequence(
                    withTiming(1.15, { duration: 500 }),
                    withTiming(1, { duration: 500 })
                ),
                3, // loop 3 times
                true // reverse
            );
        }
    }, [visible, winner, reducedMotion]);

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
    // Index 0 → 8s, index 1 → 10s, index 2 → 12s (hôte tire toujours à 4s)
    useEffect(() => {
        if (!visible || isHost || !autoAdvanceDelay || autoAdvanceDelay <= 0) return;
        const fallbackDelay = autoAdvanceDelay * 2 + localPlayerIndex * 2000;
        const timer = setTimeout(() => {
            onContinue();
        }, fallbackDelay);
        return () => clearTimeout(timer);
    }, [visible, isHost, autoAdvanceDelay, localPlayerIndex]);

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }]
    }));

    if (!visible) return null;

    return (
        <Animated.View 
            entering={FadeIn.duration(400)}
            style={styles.container}
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
                <View style={styles.centerBox}>
                    <Animated.View style={[
                        styles.avatarWrapper, 
                        pulseStyle,
                        isSmallScreen && { width: 100, height: 100 }
                    ]}>
                        <Image
                            source={getAvatarImage((winner.avatarId as AvatarId) || 'avatar_default')}
                            style={[styles.avatar, isSmallScreen && { width: 100, height: 100, borderRadius: 50 }]}
                            contentFit="cover"
                        />
                        <Animated.Text 
                            entering={reducedMotion ? undefined : ZoomIn.delay(200).springify()} 
                            style={[styles.crown, isSmallScreen && { fontSize: 36, top: -20, right: -15 }]}
                        >
                            👑
                        </Animated.Text>
                    </Animated.View>
                    <Animated.View entering={reducedMotion ? undefined : FadeIn.delay(300)}>
                        <Text style={[styles.winnerName, isSmallScreen && { fontSize: 18, marginTop: 10 }]}>
                            {isBoude 
                                ? `${winner.name || 'Joueur'} a gagné ce round`
                                : (winner.id === localPlayerId 
                                    ? "Vous avez posé tous vos dominos"
                                    : `${winner.name || 'Joueur'} a posé tous ses dominos`)}
                        </Text>
                    </Animated.View>

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
    },
    crown: {
        position: 'absolute',
        top: -30,
        right: -15,
        fontSize: 50,
        textShadowColor: 'rgba(255,215,0,0.5)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 15,
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
