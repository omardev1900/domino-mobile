import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Alert, useWindowDimensions } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { authService } from '../src/core/services/auth.service';

export default function GameModesScreen() {
    const router = useRouter();
    const { width, height } = useWindowDimensions();
    const isLandscape = width > height;
    const [user, setUser] = useState<any>(null);

    const refreshPendingMultiplayerState = useCallback(async () => {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
    }, []);

    useFocusEffect(
        useCallback(() => {
            refreshPendingMultiplayerState().catch(console.error);
        }, [refreshPendingMultiplayerState])
    );

    return (
        <LinearGradient colors={['#2D1B4E', '#1A0E2E']} style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={28} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
                <Text style={styles.title}>CHOISIR UN MODE</Text>
                <View style={styles.backBtn} />
            </View>

            <View style={[styles.cardsContainer, isLandscape && styles.cardsContainerLandscape]}>
                <Animated.View entering={FadeInUp.delay(100).duration(400)} style={[styles.cardWrapper, isLandscape && styles.cardWrapperLandscape]}>
                    <TouchableOpacity
                        style={styles.modeCard}
                        onPress={() => {
                            router.replace('/solo');
                        }}
                        activeOpacity={0.85}
                    >
                        <LinearGradient colors={['#4CAF50', '#2E7D32']} style={styles.cardGradient}>
                            <Text style={styles.cardIcon}>🎮</Text>
                            <Text style={styles.cardTitle}>Mode Solo</Text>
                            <Text style={styles.cardDesc}>Jouer contre le Bot</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </Animated.View>

                <Animated.View entering={FadeInUp.delay(200).duration(400)} style={[styles.cardWrapper, isLandscape && styles.cardWrapperLandscape]}>
                    <TouchableOpacity
                        style={styles.modeCard}
                        onPress={() => {
                            if (user?.uid?.startsWith('guest_')) {
                                Alert.alert(
                                    'Accès Restreint',
                                    'Le mode multijoueur requiert un compte gratuit pour jouer avec des amis, gagner des Coins et être classé.',
                                    [
                                        { text: 'Plus tard', style: 'cancel' },
                                        { text: 'Créer un compte', onPress: () => router.replace('/login') }
                                    ]
                                );
                            } else {
                                router.replace('/lobby');
                            }
                        }}
                        activeOpacity={0.85}
                    >
                        <LinearGradient colors={['#1565C0', '#42A5F5']} style={styles.cardGradient}>
                            <Text style={styles.cardIcon}>{user?.uid?.startsWith('guest_') ? '🔒' : '👥'}</Text>
                            <Text style={styles.cardTitle}>Multijoueurs</Text>
                            <Text style={styles.cardDesc}>
                                {user?.uid?.startsWith('guest_') ? 'Nécessite un compte' : 'Jouer contre des amis'}
                            </Text>
                            {user?.uid?.startsWith('guest_') && <View style={styles.lockOverlay} />}
                        </LinearGradient>
                    </TouchableOpacity>
                </Animated.View>

                <Animated.View entering={FadeInUp.delay(300).duration(400)} style={[styles.cardWrapper, isLandscape && styles.cardWrapperLandscape]}>
                    <TouchableOpacity
                        style={styles.modeCard}
                        onPress={() => {
                            if (user?.uid?.startsWith('guest_')) {
                                Alert.alert(
                                    'Accès Restreint',
                                    'Les tournois requièrent un compte gratuit.',
                                    [
                                        { text: 'Plus tard', style: 'cancel' },
                                        { text: 'Créer un compte', onPress: () => router.replace('/login') }
                                    ]
                                );
                            } else {
                                // @ts-ignore
                                router.replace('/tournaments');
                            }
                        }}
                        activeOpacity={0.85}
                    >
                        <LinearGradient colors={['#FF9800', '#F57C00']} style={styles.cardGradient}>
                            <Text style={styles.cardIcon}>🏆</Text>
                            <Text style={styles.cardTitle}>Tournois</Text>
                            <Text style={styles.cardDesc}>Compétitions en cours</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, marginTop: 40 },
    title: { color: '#FFD700', fontSize: 24, fontWeight: '900', letterSpacing: 1, textAlign: 'center', flex: 1 },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    noticeCard: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.18)',
        padding: 16,
        marginBottom: 18,
    },
    noticeTitle: {
        color: '#FFD700',
        fontSize: 16,
        fontWeight: '900',
    },
    noticeText: {
        color: 'rgba(255,255,255,0.78)',
        fontSize: 13,
        lineHeight: 19,
        marginTop: 8,
    },
    noticeActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 14,
    },
    noticePrimary: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFD700',
        borderRadius: 14,
        paddingVertical: 12,
    },
    noticePrimaryStandalone: {
        marginTop: 14,
    },
    noticePrimaryText: {
        color: '#1A0E2E',
        fontSize: 13,
        fontWeight: '900',
    },
    noticeSecondary: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
        paddingVertical: 12,
    },
    noticeSecondaryText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '800',
    },
    cardsContainer: { flexDirection: 'column', alignItems: 'center', gap: 15 },
    cardsContainerLandscape: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 16 },
    cardWrapper: { width: '100%', maxWidth: 320 },
    cardWrapperLandscape: { flex: 1, maxWidth: 300, minWidth: 160 },
    modeCard: { borderRadius: 16, overflow: 'hidden', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 },
    cardGradient: { paddingVertical: 20, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', minHeight: 120 },
    cardIcon: { fontSize: 40, marginBottom: 8 },
    cardTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 4, textAlign: 'center' },
    cardDesc: { fontSize: 13, color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
    lockOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' }
});
