import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Alert, useWindowDimensions } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { authService } from '../src/core/services/auth.service';
import { deleteWaitingRoomIfOwner, findActiveRoomForUser, findHostedWaitingRoom } from '../src/core/services/firebase';

export default function GameModesScreen() {
    const router = useRouter();
    const { width, height } = useWindowDimensions();
    const isLandscape = width > height;
    const [user, setUser] = useState<any>(null);
    const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
    const [hostedWaitingRoomId, setHostedWaitingRoomId] = useState<string | null>(null);

    const refreshPendingMultiplayerState = useCallback(async () => {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
        if (!currentUser?.uid || currentUser.uid.startsWith('guest_')) {
            setActiveRoomId(null);
            setHostedWaitingRoomId(null);
            return;
        }

        const [activeRoom, hostedRoom] = await Promise.all([
            findActiveRoomForUser(currentUser.uid),
            findHostedWaitingRoom(currentUser.uid),
        ]);

        setActiveRoomId(activeRoom);
        setHostedWaitingRoomId(hostedRoom);
        if (activeRoom) {
            router.replace({ pathname: '/game/[id]', params: { id: activeRoom, userId: currentUser.uid } });
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            refreshPendingMultiplayerState().catch(console.error);
        }, [refreshPendingMultiplayerState])
    );

    useEffect(() => {
        refreshPendingMultiplayerState().catch(console.error);
    }, [refreshPendingMultiplayerState]);

    const handleRejoinActiveMatch = () => {
        if (!activeRoomId || !user?.uid) return;
        router.replace({ pathname: '/game/[id]', params: { id: activeRoomId, userId: user.uid } });
    };

    const guardAgainstActiveMultiplayerMatch = useCallback(() => {
        if (!activeRoomId || !user?.uid) return false;
        Alert.alert(
            'Match multijoueur en cours',
            'Vous avez déjà une partie multijoueur active. Rejoignez-la avant de lancer un autre mode.',
            [
                { text: 'Plus tard', style: 'cancel' },
                { text: 'Rejoindre le match', onPress: handleRejoinActiveMatch }
            ]
        );
        return true;
    }, [activeRoomId, user?.uid]);

    const handleDeleteHostedRoom = async () => {
        if (!hostedWaitingRoomId || !user?.uid) return;
        try {
            const deleted = await deleteWaitingRoomIfOwner(hostedWaitingRoomId, user.uid);
            if (deleted) {
                setHostedWaitingRoomId(null);
                Alert.alert('Table supprimée', 'Votre table vide a bien été supprimée.');
            }
        } catch (error: any) {
            Alert.alert('Suppression impossible', error?.message || 'Impossible de supprimer cette table.');
        } finally {
            refreshPendingMultiplayerState().catch(console.error);
        }
    };

    return (
        <LinearGradient colors={['#2D1B4E', '#1A0E2E']} style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={28} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
                <Text style={styles.title}>CHOISIR UN MODE</Text>
                <View style={styles.backBtn} />
            </View>

            {activeRoomId ? (
                <View style={styles.noticeCard}>
                    <Text style={styles.noticeTitle}>Match en cours détecté</Text>
                    <Text style={styles.noticeText}>
                        Une partie multijoueur vous attend encore. Reprenez-la avant de lancer un autre mode.
                    </Text>
                    <TouchableOpacity style={[styles.noticePrimary, styles.noticePrimaryStandalone]} onPress={handleRejoinActiveMatch} activeOpacity={0.85}>
                        <Text style={styles.noticePrimaryText}>Rejoindre le match</Text>
                    </TouchableOpacity>
                </View>
            ) : hostedWaitingRoomId ? (
                <View style={styles.noticeCard}>
                    <Text style={styles.noticeTitle}>Table en attente détectée</Text>
                    <Text style={styles.noticeText}>
                        Vous avez une table multijoueur encore vide. Vous pouvez la rejoindre ou la supprimer avant de lancer autre chose.
                    </Text>
                    <View style={styles.noticeActions}>
                        <TouchableOpacity style={styles.noticeSecondary} onPress={handleDeleteHostedRoom} activeOpacity={0.85}>
                            <Text style={styles.noticeSecondaryText}>Supprimer</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.noticePrimary}
                            onPress={() => router.replace({ pathname: '/lobby', params: { autoJoinRoomId: hostedWaitingRoomId } })}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.noticePrimaryText}>Retourner à ma table</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : null}

            <View style={[styles.cardsContainer, isLandscape && styles.cardsContainerLandscape]}>
                <Animated.View entering={FadeInUp.delay(100).duration(400)} style={[styles.cardWrapper, isLandscape && styles.cardWrapperLandscape]}>
                    <TouchableOpacity
                        style={styles.modeCard}
                        onPress={() => {
                            if (guardAgainstActiveMultiplayerMatch()) return;
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
                            if (guardAgainstActiveMultiplayerMatch()) return;
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
                            if (guardAgainstActiveMultiplayerMatch()) return;
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
