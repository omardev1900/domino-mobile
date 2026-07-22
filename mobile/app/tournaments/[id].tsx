import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { collection, doc, getDoc, getDocs, setDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../src/core/services/firebase';
import { economyService } from '../../src/core/services/economy.service';

interface Tournament {
  id: string;
  title: string;
  description: string;
  startAt: number;
  endAt: number;
  status: 'UPCOMING' | 'ACTIVE' | 'ENDED';
  gameMode: string;
  entryFeeCoins: number;
  reward1st: number;
  rewardDiamonds1st?: number;
}

interface Participant {
  id: string;
  displayName: string;
  avatarId: string;
  score: number;
  gamesPlayed: number;
}

export default function TournamentDetailScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const insets = useSafeAreaInsets();
    
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [loading, setLoading] = useState(true);
    const [isParticipating, setIsParticipating] = useState(false);
    const [joining, setJoining] = useState(false);
    
    // Auth info
    const userId = auth.currentUser?.uid;
    const userDisplayName = auth.currentUser?.displayName || 'Joueur';
    const userPhoto = auth.currentUser?.photoURL || 'avatar_default';

    useEffect(() => {
        if (!id) return;
        
        // Fetch tournament metadata once
        const loadTour = async () => {
            try {
                const docSnap = await getDoc(doc(db, 'tournaments', id));
                if (docSnap.exists()) {
                    setTournament({ id: docSnap.id, ...docSnap.data() } as Tournament);
                }
            } catch (e) {
                console.error("Error fetching tournament", e);
            }
        };
        
        loadTour();
        
        // Listen to participants leaderboard realtime
        const q = query(
            collection(db, 'tournaments', id, 'participants'),
            orderBy('score', 'desc')
        );
        
        const unsubscribe = onSnapshot(q, (snap) => {
            const list: Participant[] = [];
            let foundCurrentUser = false;
            
            snap.forEach(d => {
                const data = d.data();
                if (d.id === userId) foundCurrentUser = true;
                list.push({
                    id: d.id,
                    displayName: data.displayName || 'Joueur',
                    avatarId: data.avatarId || 'avatar_default',
                    score: data.score || 0,
                    gamesPlayed: data.gamesPlayed || 0
                });
            });
            
            setParticipants(list);
            setIsParticipating(foundCurrentUser);
            setLoading(false);
        }, (error) => {
            console.error("Error listening participants", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [id, userId]);

    const handleJoin = async () => {
        if (!userId) {
            Alert.alert("Connexion Requise", "Veuillez vous inscrire pour participer.");
            return;
        }
        if (!tournament) return;
        
        setJoining(true);
        try {
            // Check & deduct fee
            if (tournament.entryFeeCoins > 0) {
                const success = await economyService.deductBuyIn(tournament.entryFeeCoins, userId);
                if (!success) {
                    Alert.alert("Solde insuffisant", "Vous n'avez pas assez de coins pour l'inscription.");
                    setJoining(false);
                    return;
                }
            }
            
            // Register player
            await setDoc(doc(db, 'tournaments', id, 'participants', userId), {
                displayName: userDisplayName,
                avatarId: userPhoto,
                score: 0,
                gamesPlayed: 0,
                joinedAt: Date.now()
            });
            
            Alert.alert("Inscrit !", "Vous participez désormais à ce tournoi !");
        } catch (e) {
            console.error("Error joining tournament", e);
            Alert.alert("Erreur", "Impossible de vous inscrire pour le moment.");
        } finally {
            setJoining(false);
        }
    };
    
    const handleLaunchGame = () => {
        if (!tournament) return;
        
        // When joining a generic game for tournament, we forward to the lobby and set 
        // the parameters? Actually, best way without big refactor is navigating to 
        // game or forcing matchmaking. Since normal matchmaking looks for room with `tableTier`
        // we can route to lobby with `autoJoinRoomId` maybe? 
        // Or we pass `tournamentId` to `lobby` so it creates/joins a tournament specific room.
        
        // Let's go to Lobby with tournament flag so Lobby screen knows we are matchmaking for a tournament.
        // @ts-ignore
        router.push({
            pathname: '/lobby',
            params: { tournamentId: tournament.id, forceMode: tournament.gameMode }
        });
    };

    if (loading) {
        return (
            <LinearGradient colors={['#2D1B4E', '#1A0E2E']} style={styles.center}>
                <ActivityIndicator size="large" color="#FFD700" />
            </LinearGradient>
        );
    }

    if (!tournament) {
        return (
            <LinearGradient colors={['#2D1B4E', '#1A0E2E']} style={styles.center}>
                <Text style={{color:'#FFF'}}>Tournoi introuvable.</Text>
                <TouchableOpacity onPress={() => router.back()} style={{marginTop: 20}}>
                    <Text style={{color:'#FFD700'}}>Retour</Text>
                </TouchableOpacity>
            </LinearGradient>
        );
    }

    // Helper functions
    const formatDate = (ts: number) => {
        return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
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
                <Text style={styles.title} numberOfLines={1}>{tournament.title}</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}>
                <View style={styles.infoCard}>
                    <Text style={styles.desc}>{tournament.description}</Text>
                    <View style={styles.infoRow}>
                        <View style={styles.infoBox}>
                            <Text style={styles.infoLabel}>Statut</Text>
                            <Text style={styles.infoValue}>{tournament.status}</Text>
                        </View>
                        <View style={styles.infoBox}>
                            <Text style={styles.infoLabel}>Mode de Jeu</Text>
                            <Text style={styles.infoValue}>{tournament.gameMode}</Text>
                        </View>
                    </View>
                    <View style={styles.infoRow}>
                        <View style={styles.infoBox}>
                            <Text style={styles.infoLabel}>Du</Text>
                            <Text style={styles.infoValue} numberOfLines={1}>{formatDate(tournament.startAt)}</Text>
                        </View>
                        <View style={styles.infoBox}>
                            <Text style={styles.infoLabel}>Au</Text>
                            <Text style={styles.infoValue} numberOfLines={1}>{formatDate(tournament.endAt)}</Text>
                        </View>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>Classement ({participants.length})</Text>
                
                {participants.length === 0 ? (
                    <Text style={styles.emptyText}>Aucun participant pour le moment.</Text>
                ) : (
                    participants.map((p, idx) => (
                        <Animated.View key={p.id} entering={FadeInUp.delay(50 * idx)} style={[
                            styles.participantCard,
                            p.id === userId && styles.myParticipantCard
                        ]}>
                            <Text style={styles.rank}>#{idx + 1}</Text>
                            <View style={styles.avatarCircle}>
                                <Text style={{fontSize: 20}}>😎</Text>
                            </View>
                            <View style={styles.pInfo}>
                                <Text style={styles.pName} numberOfLines={1}>
                                    {p.displayName} {p.id === userId && "(Vous)"}
                                </Text>
                                <Text style={styles.pStats}>{p.gamesPlayed} parties</Text>
                            </View>
                            <Text style={styles.pScore}>{p.score} pts</Text>
                        </Animated.View>
                    ))
                )}
            </ScrollView>

            {/* ACTION FOOTER */}
            <View style={[styles.footer, { paddingBottom: insets.bottom || 20 }]}>
                {tournament.status === 'ENDED' ? (
                    <View style={styles.disabledButton}>
                        <Text style={styles.disabledText}>TOURNOI TERMINÉ</Text>
                    </View>
                ) : !isParticipating ? (
                    <TouchableOpacity 
                        style={styles.primaryButton}
                        onPress={handleJoin}
                        disabled={joining}
                    >
                        <LinearGradient colors={['#FF9800', '#F57C00']} style={styles.btnGradient}>
                            {joining ? <ActivityIndicator color="#FFF" /> : (
                                <Text style={styles.btnText}>S'INSCRIRE ({tournament.entryFeeCoins} 🪙)</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                ) : tournament.status === 'ACTIVE' ? (
                    <TouchableOpacity 
                        style={styles.primaryButton}
                        onPress={handleLaunchGame}
                    >
                        <LinearGradient colors={['#4CAF50', '#2E7D32']} style={styles.btnGradient}>
                            <Text style={styles.btnText}>JOUER (Mode {tournament.gameMode})</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.disabledButton}>
                        <Text style={styles.disabledText}>LE TOURNOI N'A PAS COMMENCÉ</Text>
                    </View>
                )}
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)'
    },
    backButton: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center', justifyContent: 'center',
    },
    title: { fontSize: 18, fontWeight: 'bold', color: '#FFF', flex: 1, textAlign: 'center', marginHorizontal: 10 },
    content: { padding: 15 },
    infoCard: {
        backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 15, padding: 15, marginBottom: 20,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
    },
    desc: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 15, textAlign: 'center' },
    infoRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    infoBox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', padding: 10, borderRadius: 10, alignItems: 'center' },
    infoLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 2 },
    infoValue: { fontSize: 13, color: '#FFD700', fontWeight: 'bold' },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFF', marginBottom: 15 },
    emptyText: { color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginVertical: 20 },
    participantCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)',
        padding: 12, borderRadius: 12, marginBottom: 8
    },
    myParticipantCard: {
        backgroundColor: 'rgba(76, 175, 80, 0.2)', borderWidth: 1, borderColor: '#4CAF50'
    },
    rank: { width: 30, fontSize: 16, fontWeight: 'bold', color: '#FFD700' },
    avatarCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    pInfo: { flex: 1 },
    pName: { color: '#FFF', fontSize: 15, fontWeight: 'bold', marginBottom: 2 },
    pStats: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
    pScore: { color: '#FFD700', fontSize: 18, fontWeight: '900' },
    footer: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: 'rgba(26, 14, 46, 0.95)',
        paddingHorizontal: 20, paddingTop: 15,
        borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)'
    },
    primaryButton: { width: '100%', borderRadius: 12, overflow: 'hidden' },
    btnGradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
    btnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
    disabledButton: {
        width: '100%', paddingVertical: 16, borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center'
    },
    disabledText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 'bold' }
});
