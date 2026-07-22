import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking as RNLinking, Platform, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { Image } from 'expo-image';
import { GameRoom, GameMode } from '../core/types';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getAvatarImage, AVAILABLE_AVATARS, AvatarId } from '../core/avatars';
import { EconomyHeader } from '../components/EconomyHeader';
import { AvatarFrame } from '../components/AvatarFrame';
import { GradeBadge } from '../components/GradeBadge';
import { LEAGUE_FRAMES_ENABLED, LEAGUE_GRADE_COLORS } from '../core/economy.constants';
import { LeagueGrade } from '../core/economy.types';
import { addBotToWaitingRoom, leaveRoom } from '../core/services/firebase';
import { BotSelectionModal } from '../components/BotSelectionModal';
import { BotDifficulty } from '../core/services/bot.service';
import { PremiumButton } from '../components/common/PremiumButton';

interface LobbyScreenProps {
    roomData: GameRoom;
    currentUserId: string;
    onStartGame: () => void;
    onDeleteRoom?: () => void;
}

const MODE_LABELS: Record<string, string> = {
    MANCHE: 'Manche',
    SCORE: 'Score',
    COCHON: 'Cochon',
};

const MODE_UNIT_LABELS: Record<string, string> = {
    MANCHE: 'Manches',
    SCORE: 'Points',
    COCHON: 'Cochons',
};

export const LobbyScreen: React.FC<LobbyScreenProps> = ({ roomData, currentUserId, onStartGame, onDeleteRoom }) => {
    const isHost = roomData.players[0]?.uid === currentUserId;
    const canStart = roomData.players.length === 3;
    const canDeleteWaitingRoom = isHost && roomData.status === 'WAITING' && roomData.players.length <= 1 && !roomData.gameState;
    const [autoStartCountdown, setAutoStartCountdown] = useState<number | null>(null);
    const hasAutoStarted = useRef(false);
    const rootRef = useRef<View>(null);
    const [botModalVisible, setBotModalVisible] = useState(false);

    const handleAddBot = () => {
        setBotModalVisible(true);
    };

    const handleBotSelected = (difficulty: BotDifficulty) => {
        addBotToWaitingRoom(roomData.roomId, difficulty);
    };

    const handleRemoveBot = (botUid: string) => {
        leaveRoom(roomData.roomId, botUid);
    };

    const handleDeleteRoom = () => {
        if (!onDeleteRoom) return;
        
        if (Platform.OS === 'web') {
            if (window.confirm("Voulez-vous vraiment supprimer cette table ?")) {
                onDeleteRoom();
            }
        } else {
            Alert.alert(
                "Supprimer la table",
                "Voulez-vous vraiment supprimer cette table ?",
                [
                    { text: "Annuler", style: "cancel" },
                    { text: "Supprimer", style: "destructive", onPress: () => onDeleteRoom() }
                ]
            );
        }
    };

    // Give focus to root on mount (useful returning from game overlays)
    useEffect(() => {
        if (Platform.OS === 'web') {
            setTimeout(() => {
                (rootRef.current as any)?.focus?.();
            }, 100);
        }
    }, []);

    // Read options directly from room data (set at creation time)
    const gameMode = roomData.gameMode || 'MANCHE';
    const winningCondition = roomData.winningCondition || 3;
    const turnDuration = roomData.turnDuration ?? 15;
    const startingHandSize = roomData.startingHandSize || 7;

    // AUTO-START: Lancer automatiquement la partie dès que 3 joueurs sont présents
    useEffect(() => {
        if (!canStart || hasAutoStarted.current) {
            return;
        }

        const delay = isHost ? 2000 : 5000;

        console.log(`🎮 3 joueurs détectés - Démarrage ${isHost ? 'prioritaire (hôte)' : 'fallback'} dans ${delay / 1000}s...`);

        setAutoStartCountdown(2);

        const countdownInterval = setInterval(() => {
            setAutoStartCountdown(prev => {
                if (prev === null || prev <= 1) {
                    clearInterval(countdownInterval);
                    return null;
                }
                return prev - 1;
            });
        }, 1000);

        const autoStartTimer = setTimeout(() => {
            if (roomData.players.length === 3 && !hasAutoStarted.current) {
                hasAutoStarted.current = true;
                console.log(`🚀 Lancement automatique ${isHost ? 'par l\'hôte' : 'par fallback'} !`);
                onStartGame();
            }
        }, delay);

        return () => {
            clearTimeout(autoStartTimer);
            clearInterval(countdownInterval);
        };
    }, [canStart, isHost, roomData.players.length, onStartGame]);

    // Create array of 3 slots with player data
    const slots = Array.from({ length: 3 }, (_, index) => {
        const player = roomData.players[index];
        return {
            player,
            isCurrentUser: player?.uid === currentUserId,
            isHost: index === 0,
            isEmpty: !player,
        };
    });

    const shareToWhatsApp = () => {
        const deepLink = `https://domino-martinique.online/join/${roomData.roomId}`;
        const modeText = gameMode.charAt(0).toUpperCase() + gameMode.slice(1).toLowerCase();
        const message = `Rejoins ma table de Domino Martiniquais Mode ${modeText}, Objectif : ${winningCondition} ! Code : ${roomData.roomId}\n\nLien : ${deepLink}`;

        let url = `whatsapp://send?text=${encodeURIComponent(message)}`;

        // Web compatibility: use wa.me link
        if (Platform.OS === 'web') {
            url = `https://wa.me/?text=${encodeURIComponent(message)}`;
        }

        RNLinking.openURL(url).catch(() => {
            // Fallback if WhatsApp is not installed or fails
            alert('WhatsApp ne semble pas être installé');
        });
    };

    const renderPlayerCard = (slot: typeof slots[0], index: number) => {
        return (
            <Animated.View
                key={index}
                entering={FadeInUp.delay(200 + index * 100).duration(500)}
                style={styles.playerCardWrapper}
            >
                <View
                    style={[
                        styles.playerCard,
                        slot.isCurrentUser && styles.playerCardHighlight,
                    ]}
                >
                    {slot.isEmpty ? (
                        <>
                            <View style={styles.emptyAvatar}>
                                <Text style={styles.silhouetteIcon}>👤</Text>
                            </View>
                            <Text style={styles.emptyText}>Attente...</Text>
                            {isHost && (
                                <PremiumButton 
                                    style={styles.addBotButton} 
                                    onPress={handleAddBot}
                                    soundName="clack1"
                                >
                                    <Text style={styles.addBotButtonText}>+ Bot</Text>
                                </PremiumButton>
                            )}
                        </>
                    ) : (
                        <>
                            <View style={{ justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
                                <View style={[
                                    styles.avatar,
                                    slot.isCurrentUser && styles.avatarHighlight,
                                    { overflow: 'hidden', marginBottom: 0 },
                                    slot.player?.leagueGrade && !slot.isCurrentUser && {
                                        borderWidth: 2,
                                        borderColor: typeof LEAGUE_GRADE_COLORS !== 'undefined' ? LEAGUE_GRADE_COLORS[slot.player.leagueGrade as LeagueGrade] : '#888888',
                                    },
                                ]}>
                                    <Image
                                        source={getAvatarImage(slot.player?.avatarId || 'avatar_default')}
                                        style={{
                                            width: 64 * 1.6,
                                            height: 64 * 1.6,
                                            position: 'absolute',
                                            top: -(64 * 1.6 - 64) * 0.25,
                                        }}
                                        contentFit="cover"
                                        cachePolicy="memory-disk"
                                    />
                                </View>
                                {LEAGUE_FRAMES_ENABLED && slot.player?.activeFrame && (
                                    <AvatarFrame frameId={slot.player.activeFrame} size={64} />
                                )}
                                {isHost && slot.player?.status === 'BOT' && (
                                    <PremiumButton 
                                        style={styles.removeBotButton} 
                                        onPress={() => handleRemoveBot(slot.player!.uid)}
                                        soundName="clack1"
                                    >
                                        <Ionicons name="close" size={16} color="#FFF" />
                                    </PremiumButton>
                                )}
                            </View>
                            <Text style={styles.playerName} numberOfLines={1}>
                                {slot.player!.displayName}
                            </Text>
                            <Text style={styles.playerStatus}>
                                {slot.isCurrentUser ? '(Vous)' : slot.isHost ? 'HÔTE' : 'Joueur'}
                            </Text>
                            {/* [R3-M2] Badge grade Ligue */}
                            <GradeBadge grade={slot.player?.leagueGrade} size="xs" />
                        </>
                    )}
                </View>
            </Animated.View>
        );
    };

    return (
        <>
            <LinearGradient
                colors={['#2D1B4E', '#1A0E2E']}
                style={styles.container}
                {...({ ref: rootRef, tabIndex: -1 } as any)}
            >
            <Animated.View entering={FadeIn.delay(100)} style={styles.header}>
                <View style={styles.headerLeft}>
                    {/* Left side empty to balance header and avoid option overlap */}
                </View>
                <View style={styles.headerCenter}>
                    <EconomyHeader />
                </View>
                <View style={styles.headerRight}>
                    <View style={styles.headerRightContent}>
                        <PremiumButton style={styles.shareIconButton} onPress={shareToWhatsApp} soundName="notify">
                            <Ionicons name="logo-whatsapp" size={24} color="#FFF" />
                        </PremiumButton>
                        <View style={styles.roomInfoContainer}>
                            <Text style={styles.roomCode}>Code : {roomData.roomId}</Text>
                        </View>
                    </View>
                </View>
            </Animated.View>

            <Animated.ScrollView 
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
            >
                <View style={styles.mainContent}>
                    {/* Game Options - Absolute left */}
                    <Animated.View entering={FadeIn.delay(400)} style={styles.optionsSection}>
                        <Text style={styles.sectionTitle}>TABLE</Text>
                        <View style={styles.optionsGrid}>
                            <View style={styles.optionChip}>
                                <Text style={styles.optionChipLabel}>Mode</Text>
                                <Text style={styles.optionChipValue}>{MODE_LABELS[gameMode] || gameMode}</Text>
                            </View>
                            <View style={styles.optionChip}>
                                <Text style={styles.optionChipLabel}>Objectif</Text>
                                <Text style={styles.optionChipValue}>{winningCondition} {MODE_UNIT_LABELS[gameMode]}</Text>
                            </View>
                            <View style={styles.optionChip}>
                                <Text style={styles.optionChipLabel}>Tour</Text>
                                <Text style={styles.optionChipValue}>{turnDuration}s</Text>
                            </View>
                        </View>
                    </Animated.View>

                    {/* Player Cards - Right/Center */}
                    <View style={styles.playersContainer}>
                        {slots.map((slot, index) => renderPlayerCard(slot, index))}
                    </View>
                </View>

                {/* Action Button - Bottom */}
                <Animated.View entering={FadeInUp.delay(600).duration(500)} style={styles.footer}>
                {isHost ? (
                    <View style={styles.hostActionsContainer}>
                        <View style={styles.hostActionsRow}>
                            <PremiumButton
                                style={[styles.actionButton, !canStart && styles.actionButtonDisabled]}
                                onPress={() => {
                                    if (canStart && !hasAutoStarted.current) {
                                        hasAutoStarted.current = true;
                                        onStartGame();
                                    }
                                }}
                                disabled={!canStart}
                                soundName="notify"
                            >
                                <LinearGradient
                                    colors={canStart ? ['#4CAF50', '#2E7D32'] : ['#555', '#333']}
                                    style={styles.buttonGradient}
                                >
                                    <Text style={styles.actionButtonText} adjustsFontSizeToFit numberOfLines={1}>
                                        {autoStartCountdown !== null
                                            ? `DÉMARRAGE DANS ${autoStartCountdown}...`
                                            : canStart
                                                ? 'JOUER'
                                                : `ATTENDRE ${3 - roomData.players.length} PLUS`}
                                    </Text>
                                </LinearGradient>
                            </PremiumButton>

                            {canDeleteWaitingRoom && onDeleteRoom ? (
                                <PremiumButton
                                    style={styles.deleteRoomButton}
                                    onPress={handleDeleteRoom}
                                    soundName="clack1"
                                >
                                    <Ionicons name="trash-outline" size={24} color="#FF8A65" />
                                </PremiumButton>
                            ) : null}
                        </View>
                        {autoStartCountdown !== null && (
                            <Text style={styles.autoStartHint}>
                                Appuyez pour démarrer immédiatement
                            </Text>
                        )}
                    </View>
                ) : (
                    <View style={styles.waitingContainer}>
                        <Text style={styles.waitingText}>
                            {autoStartCountdown !== null
                                ? `Démarrage dans ${autoStartCountdown}...`
                                : 'En attente du hote...'}
                        </Text>
                    </View>
                )}
                </Animated.View>
            </Animated.ScrollView>
        </LinearGradient>
        <BotSelectionModal
            visible={botModalVisible}
            onClose={() => setBotModalVisible(false)}
            onSelectBot={handleBotSelected}
        />
    </>);
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
        paddingVertical: 20,
    },
    // ─── Header ─────────────────────────────────────────────────
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10,
        zIndex: 50,
    },
    headerLeft: {
        flex: 1,
    },
    headerCenter: {
        alignItems: 'center',
    },
    headerRight: {
        flex: 1,
        alignItems: 'flex-end',
    },
    headerRightContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
        backgroundColor: 'rgba(0,0,0,0.3)',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.2)',
    },
    roomInfoContainer: {
        alignItems: 'flex-start',
    },
    roomCode: {
        fontSize: 16,
        color: '#FFD700',
        fontWeight: 'bold',
        letterSpacing: 2,
    },
    roomTypeBadge: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
        textTransform: 'uppercase',
    },
    shareIconButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#25D366',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
    },
    // ─── Main Content ───────────────────────────────────────────
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingBottom: 20,
    },
    mainContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 180,
    },
    // ─── Player Cards (Reduced -20%) ────────────────────────────
    playersContainer: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
    },
    playerCardWrapper: {
        flex: 1,
        maxWidth: 96, // Reduced from 120
    },
    playerCard: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 6,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    playerCardHighlight: {
        borderColor: '#FFD700',
        backgroundColor: 'rgba(255,215,0,0.08)',
    },
    avatar: {
        width: 64, // Reduced from 80
        height: 64, // Reduced from 80
        borderRadius: 32,
        backgroundColor: '#2d5f2e',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarHighlight: {
        borderWidth: 2,
        borderColor: '#FFD700',
    },
    emptyAvatar: {
        width: 64, // Reduced from 80
        height: 64, // Reduced from 80
        borderRadius: 32,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.1)',
        borderStyle: 'dashed',
    },
    silhouetteIcon: {
        fontSize: 24,
        opacity: 0.3,
    },
    playerName: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 12,
        textAlign: 'center',
    },
    playerStatus: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 10,
        marginTop: 1,
    },
    emptyText: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 10,
        fontStyle: 'italic',
    },
    // ─── Options Section (2x2 Grid) ─────────────────────────────
    optionsSection: {
        position: 'absolute',
        left: 0,
        zIndex: 10,
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 16,
        padding: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.15)',
        width: 140,
        justifyContent: 'center',
    },
    sectionTitle: {
        fontSize: 8,
        fontWeight: 'bold',
        color: '#FFD700',
        textAlign: 'center',
        letterSpacing: 2,
        marginBottom: 8,
    },
    optionsGrid: {
        flexDirection: 'column',
        gap: 6,
    },
    optionChip: {
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 4,
        alignItems: 'center',
    },
    optionChipLabel: {
        fontSize: 8,
        color: 'rgba(255,255,255,0.4)',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 2,
    },
    optionChipValue: {
        fontSize: 12,
        color: '#FFD700',
        fontWeight: 'bold',
    },
    // ─── Footer ─────────────────────────────────────────────────
    footer: {
        marginTop: 20,
        alignItems: 'center',
        zIndex: 20, // Ensure button stays above cards if overlap occurs
    },
    hostActionsContainer: {
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
    },
    hostActionsRow: {
        flexDirection: 'row',
        width: '100%',
        gap: 12,
        alignItems: 'stretch',
    },
    actionButton: {
        flex: 1,
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
    },
    deleteButtonDisabled: {
        opacity: 0.5,
    },
    addBotButton: {
        marginTop: 12,
        paddingVertical: 6,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    addBotButtonText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
    removeBotButton: {
        position: 'absolute',
        top: -5,
        right: -5,
        backgroundColor: '#E53935',
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#1A0E2E',
    },
    actionButtonDisabled: {
        opacity: 0.6,
    },
    buttonGradient: {
        paddingVertical: 16,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
    },
    actionButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
        letterSpacing: 1,
    },
    autoStartHint: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 11,
        marginTop: 6,
    },
    deleteRoomButton: {
        width: 56,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,99,71,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteRoomButtonText: {
        color: '#FF8A65',
        fontSize: 13,
        fontWeight: '800',
    },
    waitingContainer: {
        paddingVertical: 15,
    },
    waitingText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 14,
        fontStyle: 'italic',
    },
});
