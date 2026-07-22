import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import { collection, query, orderBy, getDocs, where } from 'firebase/firestore';
import { db } from '../../src/core/services/firebase';

type TStatus = 'UPCOMING' | 'ACTIVE' | 'ENDED';

interface Tournament {
  id: string;
  title: string;
  description: string;
  startAt: number;
  endAt: number;
  status: TStatus;
  gameMode: string;
  reward1st: number;
  entryFeeCoins: number;
  maxPlayers: number;
}

export default function TournamentsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            fetchTournaments();
        }, [])
    );

    const fetchTournaments = async () => {
        setLoading(true);
        try {
            // We fetch UPCOMING and ACTIVE
            const q = query(
                collection(db, 'tournaments'),
                where('status', 'in', ['UPCOMING', 'ACTIVE']),
                orderBy('startAt', 'asc')
            );
            const snap = await getDocs(q);
            const data: Tournament[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Tournament));
            setTournaments(data);
        } catch (e) {
            console.error('Error fetching tournaments', e);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (ts: number) => {
        const d = new Date(ts);
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <LinearGradient
            colors={['#2D1B4E', '#1A0E2E']}
            style={styles.container}
        >
            <View style={[styles.header, { paddingTop: insets.top || 20 }]}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                    activeOpacity={0.7}
                >
                    <Ionicons name="arrow-back" size={24} color="#FFD700" />
                </TouchableOpacity>
                <Text style={styles.title}>Le Palais des Tournois</Text>
                <View style={{ width: 44 }} />
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#FFD700" />
                </View>
            ) : tournaments.length === 0 ? (
                <Animated.View entering={FadeIn.duration(400)} style={styles.center}>
                    <Text style={styles.emptyIcon}>🏆</Text>
                    <Text style={styles.emptyText}>Aucun tournoi pour le moment</Text>
                    <Text style={styles.emptyDesc}>Revenez plus tard pour de grandes compétitions !</Text>
                </Animated.View>
            ) : (
                <ScrollView contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}>
                    {tournaments.map((t, idx) => (
                        <Animated.View key={t.id} entering={FadeInUp.delay(100 * idx).duration(500)}>
                            <TouchableOpacity
                                style={styles.card}
                                onPress={() => router.push(`/tournaments/${t.id}`)}
                                activeOpacity={0.8}
                            >
                                <View style={styles.statusBadge}>
                                    <View style={[styles.statusDot, { backgroundColor: t.status === 'ACTIVE' ? '#4CAF50' : '#2196F3' }]} />
                                    <Text style={styles.statusText}>{t.status === 'ACTIVE' ? 'EN COURS' : 'À VENIR'}</Text>
                                </View>
                                
                                <Text style={styles.cardTitle}>{t.title}</Text>
                                <Text style={styles.cardDesc} numberOfLines={1}>{t.description}</Text>
                                
                                <View style={styles.infoRow}>
                                    <View style={styles.infoBox}>
                                        <Text style={styles.infoBoxLabel}>Début</Text>
                                        <Text style={styles.infoBoxValue}>{formatDate(t.startAt)}</Text>
                                    </View>
                                    <View style={styles.infoBox}>
                                        <Text style={styles.infoBoxLabel}>Récompense</Text>
                                        <Text style={styles.infoBoxValue}>🥇 {t.reward1st} 🪙</Text>
                                    </View>
                                </View>

                                <View style={styles.cardFooter}>
                                    <Text style={styles.feeText}>Droit d'entrée : {t.entryFeeCoins} 🪙</Text>
                                    <Ionicons name="chevron-forward" size={20} color="#FFD700" />
                                </View>
                            </TouchableOpacity>
                        </Animated.View>
                    ))}
                </ScrollView>
            )}
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    emptyIcon: {
        fontSize: 60,
        marginBottom: 10,
    },
    emptyText: {
        fontSize: 18,
        color: '#FFF',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    emptyDesc: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        marginTop: 5,
    },
    listContent: {
        padding: 20,
        gap: 15,
    },
    card: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.2)',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 10,
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(0,0,0,0.3)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    cardTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    cardDesc: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
        marginBottom: 15,
    },
    infoRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 15,
    },
    infoBox: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.2)',
        padding: 10,
        borderRadius: 12,
    },
    infoBoxLabel: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
        marginBottom: 2,
    },
    infoBoxValue: {
        fontSize: 14,
        color: '#FFD700',
        fontWeight: 'bold',
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        paddingTop: 15,
    },
    feeText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    }
});
