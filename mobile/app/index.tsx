import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    View,
    StyleSheet,
    Image,
    TouchableOpacity,
    Text,
    Platform,
    useWindowDimensions,
    Animated,
    Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { authService } from '@/core/services/auth.service';
import SettingsManager from '@/core/SettingsManager';
import SoundManager from '@/core/audio/SoundManager';

// ─── Timings ─────────────────────────────────────────────────────────────────
// Delay before bar starts (logo entrance time)

// ─── Timings ─────────────────────────────────────────────────────────────────
// Delay before bar starts (logo entrance time)
const LOGO_DELAY_MS = 600;
// Non-linear 3-phase fill
const PHASE1_MS = 1100;  // 0 → 70%
const PHASE2_MS = 950;   // 70 → 95%
const PHASE3_MS = 350;   // 95 → 100%
// Fade-in of the button after bar completes
const BUTTON_FADEIN_MS = 500;

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.3';

export default function PremiumSplashScreen() {
    const router = useRouter();
    const { height } = useWindowDimensions();
    const authResultRef = useRef<'home' | 'login'>('login');

    // ── RN Animated values (work reliably on web) ─────────────────
    const logoScale = useRef(new Animated.Value(0.82)).current;
    const progressAnim = useRef(new Animated.Value(0)).current;   // 0 → 1
    const buttonOpacity = useRef(new Animated.Value(0)).current;
    const pulseScale = useRef(new Animated.Value(1)).current;
    const shimmerX = useRef(new Animated.Value(0)).current;   // 0 → 1

    const [barDone, setBarDone] = useState(false);

    // ── 1. Auth in parallel ──────────────────────────────────────
    useEffect(() => {
        (async () => {
            try {
                await SettingsManager.loadSettings();
                const user = await authService.getCurrentUser();
                if (user) {
                    authResultRef.current = 'home';
                } else {
                    authResultRef.current = 'login';
                }
            } catch {
                authResultRef.current = 'login';
            }
        })();
    }, []);

    // ── 2. Logo entrance ─────────────────────────────────────────
    useEffect(() => {
        Animated.spring(logoScale, {
            toValue: 1,
            friction: 7,
            tension: 60,
            useNativeDriver: true,
        }).start();
    }, []);

    // ── 3. Non-linear progress bar (setTimeout-chained) ──────────
    const onBarComplete = useCallback(() => setBarDone(true), []);

    useEffect(() => {
        const t = setTimeout(() => {
            // Phase 1 : 0 → 0.70
            Animated.timing(progressAnim, {
                toValue: 0.70,
                duration: PHASE1_MS,
                easing: Easing.out(Easing.quad),
                useNativeDriver: false,
            }).start(() => {
                // Phase 2 : 0.70 → 0.95
                Animated.timing(progressAnim, {
                    toValue: 0.95,
                    duration: PHASE2_MS,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: false,
                }).start(() => {
                    // Phase 3 : 0.95 → 1.0  (snap)
                    Animated.timing(progressAnim, {
                        toValue: 1,
                        duration: PHASE3_MS,
                        easing: Easing.inOut(Easing.quad),
                        useNativeDriver: false,
                    }).start(() => {
                        onBarComplete();
                    });
                });
            });
        }, LOGO_DELAY_MS);

        return () => clearTimeout(t);
    }, []);

    // ── 4. Reveal & animate button once bar fills ─────────────────
    useEffect(() => {
        if (!barDone) return;

        // Fade in
        Animated.timing(buttonOpacity, {
            toValue: 1,
            duration: BUTTON_FADEIN_MS,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
        }).start();

        // Pulsation loop
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseScale, {
                    toValue: 1.06,
                    duration: 720,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseScale, {
                    toValue: 1.0,
                    duration: 720,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
            ])
        ).start();

        // Shimmer loop : 0 → 1 → restart
        Animated.loop(
            Animated.timing(shimmerX, {
                toValue: 1,
                duration: 1800,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        ).start();
    }, [barDone]);

    // ── Derived animated styles ───────────────────────────────────
    const barWidthInterp = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    const shimmerTranslate = shimmerX.interpolate({
        inputRange: [0, 1],
        outputRange: [-200, 280],
    });

    // ── Navigation ────────────────────────────────────────────────
    const handlePlay = () => {
        SoundManager.unlockAudio();
        router.replace(`/${authResultRef.current}` as any);
    };

    // ── Render ────────────────────────────────────────────────────
    return (
        <LinearGradient
            colors={['#2D1B4E', '#1A0E2E']}
            style={[styles.container, { minHeight: height }]}
        >
            {/* Logo */}
            <Animated.View style={[styles.logoWrapper, { transform: [{ scale: logoScale }] }]}>
                <Image
                    source={require('@/assets/images/logo.png')}
                    style={styles.logoImage}
                    resizeMode="contain"
                />
            </Animated.View>

            {/* Progress bar */}
            <View style={styles.barOuter}>
                <Animated.View style={[styles.barFill, { width: barWidthInterp }]}>
                    <LinearGradient
                        colors={['#FFD700', '#FFA500', '#FFD700']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                    />
                </Animated.View>
            </View>

            {/* JOUER button */}
            <Animated.View style={[
                styles.buttonWrapper,
                {
                    opacity: buttonOpacity,
                    transform: [{ scale: pulseScale }],
                }
            ]}>
                <TouchableOpacity
                    onPress={handlePlay}
                    activeOpacity={0.85}
                    style={styles.playButton}
                    disabled={!barDone}
                >
                    <LinearGradient
                        colors={['#FFE566', '#FFD700', '#FFA500']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.playButtonGradient}
                    >
                        {/* Shimmer streak */}
                        <View style={styles.shimmerClip} pointerEvents="none">
                            <Animated.View
                                style={[
                                    styles.shimmerStreak,
                                    { transform: [{ translateX: shimmerTranslate }, { skewX: '-20deg' }] },
                                ]}
                            />
                        </View>

                        <Text style={styles.playButtonText}>▶  JOUER</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </Animated.View>

            {/* Version info */}
            <Text style={styles.versionText}>version {APP_VERSION}</Text>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
    },
    logoWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoImage: {
        width: 220,
        height: 220,
    },
    barOuter: {
        width: 260,
        height: 7,
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderRadius: 4,
        overflow: 'hidden',
    },
    barFill: {
        height: '100%',
        borderRadius: 4,
        overflow: 'hidden',
    },
    buttonWrapper: {
        marginTop: 8,
        alignItems: 'center',
    },
    playButton: {
        borderRadius: 36,
        overflow: 'hidden',
        elevation: 12,
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 14,
    },
    playButtonGradient: {
        paddingHorizontal: 56,
        paddingVertical: 16,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    shimmerClip: {
        ...StyleSheet.absoluteFillObject,
        overflow: 'hidden',
        borderRadius: 36,
    },
    shimmerStreak: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 55,
        backgroundColor: 'rgba(255,255,255,0.30)',
    },
    playButtonText: {
        fontSize: 22,
        fontWeight: '900',
        color: '#1a0505',
        letterSpacing: 3,
    },
    versionText: {
        position: 'absolute',
        bottom: 24,
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.25)',
        fontWeight: '600',
        letterSpacing: 1.2,
    },
});
