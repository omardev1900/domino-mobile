import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    useWindowDimensions,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSpring,
    withRepeat,
    withSequence,
    interpolate,
    Extrapolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface DailyRewardModalProps {
    visible: boolean;
    amount: number;
    isWelcome?: boolean;
    isStoreAd?: boolean;
    onClaim: () => void;
    onWatchAd: () => void;
    onSkip?: () => void;
    claimTriggerRef?: React.MutableRefObject<(() => void) | null>;
}

const CoinParticle = ({ delay, index, screenW }: { delay: number; index: number; screenW: number }) => {
    const translateY = useSharedValue(0);
    const translateX = useSharedValue(0);
    const opacity = useSharedValue(0);
    const rotate = useSharedValue(0);
    const scale = useSharedValue(0.5);

    useEffect(() => {
        const xOffset = (Math.random() - 0.5) * screenW * 0.8;

        translateY.value = withSequence(
            withTiming(0, { duration: 0 }),
            withTiming(-200 - Math.random() * 100, { duration: 600 + delay }),
            withTiming(150, { duration: 1800 })
        );
        translateX.value = withSequence(
            withTiming(0, { duration: 0 }),
            withTiming(xOffset, { duration: 2400 + delay })
        );
        opacity.value = withSequence(
            withTiming(0, { duration: 0 }),
            withTiming(1, { duration: 150 + delay }),
            withTiming(0, { duration: 1600 })
        );
        scale.value = withSequence(
            withTiming(0.5, { duration: 0 }),
            withSpring(1.2, { damping: 8, stiffness: 200 }),
            withTiming(0.6, { duration: 1800 })
        );
        rotate.value = withRepeat(
            withTiming(360 * (index % 2 === 0 ? 1 : -1), { duration: 1200 }),
            -1,
            false
        );
    }, []);

    const COIN_COLORS = ['#FFD700', '#FFA500', '#FF8C00', '#FFEC44', '#FFC107'];
    const coinColor = COIN_COLORS[index % COIN_COLORS.length];

    const style = useAnimatedStyle(() => ({
        transform: [
            { translateY: translateY.value },
            { translateX: translateX.value },
            { rotate: `${rotate.value}deg` },
            { scale: scale.value },
        ],
        opacity: opacity.value,
        backgroundColor: coinColor,
        shadowColor: coinColor,
        shadowOpacity: 0.8,
        shadowRadius: 4,
    }));

    return (
        <Animated.View
            style={[
                styles.particle,
                style,
                { left: (screenW / 20) * (index % 20) }
            ]}
        />
    );
};

export const DailyRewardModal: React.FC<DailyRewardModalProps> = ({
    visible,
    amount,
    isWelcome = false,
    isStoreAd = false,
    onClaim,
    onWatchAd,
    onSkip,
    claimTriggerRef,
}) => {
    const { width, height } = useWindowDimensions();
    const isLandscape = width > height;

    const [showSkipBtn, setShowSkipBtn] = useState(false);

    // Tailles adaptatives
    const iconSize = Math.min(isLandscape ? height * 0.20 : height * 0.12, 80);
    const iconFontSize = iconSize * 0.58;
    const titleFontSize = isLandscape ? Math.min(height * 0.07, 20) : Math.min(height * 0.038, 24);
    const amountFontSize = isLandscape ? Math.min(height * 0.12, 34) : Math.min(height * 0.055, 38);
    const subtitleFontSize = isLandscape ? Math.min(height * 0.055, 11) : Math.min(height * 0.018, 13);
    const cardPadding = isLandscape ? Math.min(height * 0.06, 14) : Math.min(height * 0.03, 20);
    const cardMaxWidth = Math.min(width * 0.85, 420);
    const cardMaxHeight = height * 0.88;

    const scale = useSharedValue(0);
    const glowOpacity = useSharedValue(0.5);
    const titleScale = useSharedValue(0.8);

    useEffect(() => {
        if (visible) {
            scale.value = withSpring(1, { damping: 12, stiffness: 100 });
            titleScale.value = withSequence(
                withTiming(0.8, { duration: 0 }),
                withSpring(1.05, { damping: 8, stiffness: 150 }),
                withTiming(1, { duration: 200 })
            );
            glowOpacity.value = withRepeat(
                withSequence(
                    withTiming(1, { duration: 900 }),
                    withTiming(0.4, { duration: 900 })
                ),
                -1,
                true
            );
        } else {
            scale.value = withTiming(0, { duration: 200 });
            glowOpacity.value = 0;
            titleScale.value = 0.8;
            setShowSkipBtn(false);
        }
    }, [visible]);

    // Animation d'incrémentation du compteur de coins — jouée après la pub
    const [displayedAmount, setDisplayedAmount] = useState(0);
    const [isClaiming, setIsClaiming] = useState(false);
    const counterRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Timer pour afficher le bouton skip après 5s
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        if (visible && !isClaiming) {
            timer = setTimeout(() => {
                setShowSkipBtn(true);
            }, 5000);
        }
        return () => clearTimeout(timer);
    }, [visible, isClaiming]);

    const containerStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const glowStyle = useAnimatedStyle(() => ({
        opacity: glowOpacity.value,
        transform: [
            { scale: interpolate(glowOpacity.value, [0.4, 1], [1, 1.2], Extrapolate.CLAMP) }
        ],
    }));

    const titleAnimStyle = useAnimatedStyle(() => ({
        transform: [{ scale: titleScale.value }],
    }));

    // Appelé par home.tsx après fermeture de la pub, pour lancer l'animation et créditer les coins
    const playClaimAnimation = () => {
        if (isClaiming) return;
        setIsClaiming(true);
        setDisplayedAmount(0);

        const duration = 1200;
        const steps = 30;
        const stepTime = duration / steps;
        let current = 0;

        counterRef.current = setInterval(() => {
            current += 1;
            const progress = current / steps;
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplayedAmount(Math.round(eased * amount));

            if (current >= steps) {
                clearInterval(counterRef.current!);
                counterRef.current = null;
                setDisplayedAmount(amount);
                setTimeout(() => onClaim(), 400);
            }
        }, stepTime);
    };

    // Exposé via ref pour que home.tsx puisse déclencher l'animation après la pub
    const claimAnimRef = useRef(playClaimAnimation);
    claimAnimRef.current = playClaimAnimation;
    useEffect(() => {
        if (claimTriggerRef) claimTriggerRef.current = () => claimAnimRef.current();
    }, [claimTriggerRef]);

    // Nettoyage si le modal se ferme pendant l'animation
    useEffect(() => {
        if (!visible) {
            if (counterRef.current) clearInterval(counterRef.current);
            setIsClaiming(false);
            setDisplayedAmount(0);
        }
    }, [visible]);

    if (!visible) return null;

    const particles = Array.from({ length: 20 }).map((_, i) => (
        <CoinParticle key={i} index={i} delay={Math.random() * 400} screenW={width} />
    ));

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClaim}>
            <View style={styles.overlay}>
                {/* Particles */}
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    {particles}
                </View>

                {/* Glow */}
                <Animated.View style={[styles.glowContainer, glowStyle]} pointerEvents="none">
                    <View style={styles.glow} />
                </Animated.View>

                {/* Card */}
                <Animated.View style={[{ width: cardMaxWidth, maxHeight: cardMaxHeight, zIndex: 10 }, containerStyle]}>
                    <LinearGradient
                        colors={['#2A1B3D', '#1A0B2E']}
                        style={[styles.card, { padding: cardPadding, borderRadius: isLandscape ? 18 : 24 }]}
                    >
                        <ScrollView
                            contentContainerStyle={[
                                styles.scrollContent,
                                isLandscape ? styles.scrollContentLandscape : styles.scrollContentPortrait,
                            ]}
                            showsVerticalScrollIndicator={false}
                            bounces={false}
                        >
                            {/* Icône cadeau */}
                            <View style={[
                                styles.iconContainer,
                                {
                                    width: iconSize,
                                    height: iconSize,
                                    borderRadius: iconSize / 2,
                                    marginBottom: isLandscape ? 0 : 12,
                                    marginRight: isLandscape ? 16 : 0,
                                }
                            ]}>
                                <Text style={{ fontSize: iconFontSize }}>🎁</Text>
                            </View>

                            {/* Textes + bouton */}
                            <View style={isLandscape ? styles.rightColumn : styles.centerColumn}>
                                <Animated.Text style={[styles.title, titleAnimStyle, { fontSize: titleFontSize }]}>
                                    {isStoreAd ? 'RÉCOMPENSE !' : isWelcome ? 'CADEAU DE BIENVENUE !' : 'CADEAU DU JOUR !'}
                                </Animated.Text>

                                <Text style={[styles.amountText, { fontSize: amountFontSize }]}>
                                    {isClaiming ? `+${displayedAmount}` : `+${amount}`} 🪙
                                </Text>

                                <Text style={[styles.subtitle, {
                                    fontSize: subtitleFontSize,
                                    marginBottom: isLandscape ? 8 : 16,
                                }]}>
                                    {isStoreAd ? 'Merci d\'avoir visionné la publicité !' : isWelcome ? 'Bienvenue dans Domino Martiniquais' : 'Revenez demain pour un nouveau cadeau'}
                                </Text>

                                <TouchableOpacity
                                    style={[styles.claimButton, isLandscape && { width: '100%' }, isClaiming && { opacity: 0.7 }]}
                                    onPress={isClaiming ? undefined : onWatchAd}
                                    activeOpacity={0.85}
                                    disabled={isClaiming}
                                >
                                    <LinearGradient
                                        colors={isClaiming ? ['#FFA500', '#FF8C00'] : ['#FFD700', '#FFA500']}
                                        style={[styles.claimGradient, {
                                            paddingVertical: isLandscape ? 8 : 13,
                                        }]}
                                    >
                                        <Text style={[styles.claimButtonText, {
                                            fontSize: isLandscape ? Math.min(height * 0.07, 14) : 16,
                                        }]}>
                                            {isClaiming 
                                                ? `🪙 +${displayedAmount}` 
                                                : isStoreAd
                                                    ? `RÉCUPÉRER → +${amount} 🪙`
                                                    : isWelcome 
                                                        ? `RÉCUPÉRER → +${amount} 🪙` 
                                                        : `📺 VOIR UNE PUB → +${amount} 🪙`}
                                        </Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>

                        {/* Bouton Fermer (Skip) - Rendu en dernier pour capter le clic par-dessus le ScrollView */}
                        {showSkipBtn && onSkip && !isClaiming && (
                            <TouchableOpacity
                                style={styles.skipButton}
                                onPress={onSkip}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="close" size={24} color="rgba(255,255,255,0.5)" />
                            </TouchableOpacity>
                        )}
                    </LinearGradient>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.88)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    particle: {
        position: 'absolute',
        bottom: '45%',
        width: 10,
        height: 10,
        borderRadius: 5,
        zIndex: 5,
        elevation: 5,
    },
    glowContainer: {
        position: 'absolute',
        width: 260,
        height: 260,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    glow: {
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: 'rgba(255, 215, 0, 0.15)',
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 50,
        elevation: 10,
    },
    card: {
        borderWidth: 2,
        borderColor: '#FFD700',
        overflow: 'hidden',
    },
    scrollContent: {
        flexGrow: 1,
    },
    scrollContentPortrait: {
        flexDirection: 'column',
        alignItems: 'center',
    },
    scrollContentLandscape: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainer: {
        backgroundColor: 'rgba(255, 215, 0, 0.15)',
        borderWidth: 2,
        borderColor: 'rgba(255, 215, 0, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    centerColumn: {
        alignItems: 'center',
        width: '100%',
    },
    rightColumn: {
        flex: 1,
        alignItems: 'center',
    },
    title: {
        fontWeight: '900',
        color: '#FFD700',
        marginBottom: 6,
        textAlign: 'center',
        textShadowColor: 'rgba(255, 215, 0, 0.6)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 6,
        letterSpacing: 1,
    },
    amountText: {
        fontWeight: '900',
        color: '#FFFFFF',
        marginBottom: 6,
        textAlign: 'center',
        textShadowColor: 'rgba(255, 215, 0, 0.4)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 8,
    },
    subtitle: {
        color: 'rgba(255, 255, 255, 0.55)',
        textAlign: 'center',
        lineHeight: 16,
    },
    claimButton: {
        width: '100%',
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 6,
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
    },
    claimGradient: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    claimButtonText: {
        color: '#1A0E2E',
        fontWeight: '900',
        letterSpacing: 1.5,
    },
    skipButton: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 20,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 16,
    },
});
