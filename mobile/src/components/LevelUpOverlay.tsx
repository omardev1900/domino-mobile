import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions, Modal, Platform } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut, FadeInDown, withDelay, withSpring, withSequence, withTiming, Easing, useAnimatedStyle, withRepeat } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import SoundManager from '../core/audio/SoundManager';
import RollingNumber from './RollingNumber';

interface LevelUpOverlayProps {
    visible: boolean;
    level: number;
    coins: number;
    diamonds: number;
    onClose: () => void;
}

export function LevelUpOverlay({ visible, level, coins, diamonds, onClose }: LevelUpOverlayProps) {
    const { width, height } = useWindowDimensions();
    const isLandscape = width > height;

    const [hasPlayedSound, setHasPlayedSound] = useState(false);

    useEffect(() => {
        if (visible && !hasPlayedSound) {
            SoundManager.playSound('leagueJingle');
            const timer = setTimeout(() => {
                SoundManager.playSound('applause');
            }, 800);
            setHasPlayedSound(true);
            return () => clearTimeout(timer);
        }
        if (!visible) {
            setHasPlayedSound(false);
        }
    }, [visible, hasPlayedSound]);

    // Animation pour faire palpiter le badge de niveau
    const pulseStyle = useAnimatedStyle(() => {
        return {
            transform: [{
                scale: withRepeat(
                    withSequence(
                        withTiming(1.05, { duration: 800, easing: Easing.inOut(Easing.ease) }),
                        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
                    ),
                    -1,
                    true
                )
            }]
        };
    });

    // Animation flottante pour les pièces
    const floatStyle = useAnimatedStyle(() => {
        return {
            transform: [{
                translateY: withRepeat(
                    withSequence(
                        withTiming(-5, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
                        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
                    ),
                    -1,
                    true
                )
            }]
        };
    });

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <Animated.View
                    entering={ZoomIn.duration(800).springify()}
                    exiting={ZoomOut.duration(400)}
                    style={[
                        styles.content,
                        isLandscape && styles.contentLandscape
                    ]}
                >
                    <LinearGradient
                        colors={['rgba(26, 14, 46, 0.98)', 'rgba(10, 5, 20, 0.95)']}
                        style={StyleSheet.absoluteFillObject}
                        borderRadius={24}
                    />
                    
                    {/* Bordure lumineuse (Glow effect) */}
                    <View style={styles.glowBorder} />

                    <TouchableOpacity
                        style={styles.closeBtn}
                        onPress={onClose}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="close" size={28} color="rgba(255,255,255,0.6)" />
                    </TouchableOpacity>

                    <Animated.Text entering={FadeInDown.delay(200)} style={styles.title}>
                        NIVEAU SUPÉRIEUR !
                    </Animated.Text>
                    
                    <Animated.View entering={ZoomIn.delay(500).springify()} style={[styles.levelBadgeContainer, pulseStyle]}>
                        <LinearGradient
                            colors={['#FFD700', '#FFA500']}
                            style={styles.levelBadgeGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Text style={styles.levelBadgeLabel}>NIV</Text>
                            <Text style={styles.levelBadgeText}>{level}</Text>
                        </LinearGradient>
                    </Animated.View>

                    <Animated.View entering={FadeInDown.delay(1000)} style={styles.rewardsContainer}>
                        <Text style={styles.rewardsTitle}>RÉCOMPENSES DÉBLOQUÉES</Text>
                        
                        <View style={styles.rewardsRow}>
                            {coins > 0 && (
                                <Animated.View style={[styles.rewardBox, floatStyle]}>
                                    <Text style={styles.rewardIcon}>🪙</Text>
                                    <View style={styles.rewardValueContainer}>
                                        <Text style={styles.rewardPlus}>+</Text>
                                        <RollingNumber value={coins} duration={1500} style={styles.rewardText} />
                                    </View>
                                    <Text style={styles.rewardLabel}>Pièces</Text>
                                </Animated.View>
                            )}
                            
                            {diamonds > 0 && (
                                <Animated.View style={[styles.rewardBox, floatStyle, { animationDelay: '200ms' as any }]}>
                                    <Text style={styles.rewardIcon}>💎</Text>
                                    <View style={styles.rewardValueContainer}>
                                        <Text style={styles.rewardPlus}>+</Text>
                                        <RollingNumber value={diamonds} duration={1500} style={[styles.rewardText, { color: '#60DCFF' }]} />
                                    </View>
                                    <Text style={styles.rewardLabel}>Diamants</Text>
                                </Animated.View>
                            )}
                        </View>
                    </Animated.View>

                    <Animated.View entering={FadeIn.delay(1800)}>
                        <TouchableOpacity
                            style={styles.continueBtn}
                            onPress={onClose}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={['#FFD700', '#FFA500']}
                                style={styles.continueGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                <Text style={styles.continueBtnText}>SUPER !</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10000,
        ...Platform.select({
            web: { backdropFilter: 'blur(10px)' }
        })
    },
    content: {
        width: '85%',
        maxWidth: 400,
        alignItems: 'center',
        paddingVertical: 32,
        paddingHorizontal: 20,
        borderRadius: 24,
        elevation: 15,
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
    },
    contentLandscape: {
        maxWidth: 500,
        paddingVertical: 24,
    },
    glowBorder: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: 'rgba(255, 215, 0, 0.4)',
    },
    closeBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        padding: 8,
        zIndex: 10,
    },
    title: {
        fontSize: 26,
        fontWeight: '900',
        color: '#FFD700',
        letterSpacing: 1.5,
        textAlign: 'center',
        marginBottom: 20,
        textShadowColor: 'rgba(255,215,0,0.5)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
    levelBadgeContainer: {
        marginBottom: 24,
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 15,
        elevation: 10,
    },
    levelBadgeGradient: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#FFF',
    },
    levelBadgeLabel: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1A0E2E',
        marginTop: 5,
    },
    levelBadgeText: {
        fontSize: 48,
        fontWeight: '900',
        color: '#1A0E2E',
        lineHeight: 52,
    },
    rewardsContainer: {
        width: '100%',
        alignItems: 'center',
        marginBottom: 24,
    },
    rewardsTitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        letterSpacing: 2,
        marginBottom: 16,
        fontWeight: 'bold',
    },
    rewardsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20,
    },
    rewardBox: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        minWidth: 100,
    },
    rewardIcon: {
        fontSize: 32,
        marginBottom: 8,
    },
    rewardValueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rewardPlus: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
        marginRight: 2,
    },
    rewardText: {
        fontSize: 24,
        fontWeight: '900',
        color: '#FFD700',
    },
    rewardLabel: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        marginTop: 4,
        textTransform: 'uppercase',
        fontWeight: 'bold',
    },
    continueBtn: {
        marginTop: 10,
        width: 200,
    },
    continueGradient: {
        paddingVertical: 14,
        borderRadius: 30,
        alignItems: 'center',
    },
    continueBtnText: {
        color: '#1A0E2E',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 1,
    }
});
