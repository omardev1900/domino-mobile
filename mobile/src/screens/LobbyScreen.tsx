import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Linking as RNLinking, Platform, Alert } from 'react-native';
import { Image } from 'expo-image';
import { GameRoom } from '../core/types';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAvatarImage } from '../core/avatars';
import { EconomyHeader } from '../components/EconomyHeader';
import { AvatarFrame } from '../components/AvatarFrame';
import { GradeBadge } from '../components/GradeBadge';
import { LEAGUE_FRAMES_ENABLED, LEAGUE_GRADE_COLORS } from '../core/economy.constants';
import { LeagueGrade } from '../core/economy.types';
import { addBotToWaitingRoom, releaseWaitingRoomSeat } from '../core/services/firebase';
import { BotSelectionModal } from '../components/BotSelectionModal';
import { BotDifficulty } from '../core/services/bot.service';
import { PremiumButton } from '../components/common/PremiumButton';
import { LogService } from '../core/services/LogService';
import { getLobbyHostId, getMissingLobbyPresencePlayerIds } from '../core/lobbyPresence';
import { getEstimatedPresenceServerNow } from '../hooks/game/presenceDiagnostics';

interface LobbyScreenProps {
    roomData: GameRoom;
    currentUserId: string;
    onStartGame: () => void | Promise<void>;
    hasPremium?: boolean;
    premiumStatusResolved?: boolean;
    onDeleteRoom?: () => void;
    onLeaveRoom?: () => void;
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

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
    roomData, currentUserId, onStartGame, onDeleteRoom, onLeaveRoom,
    hasPremium = false, premiumStatusResolved = true,
}) => {
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const compactLayout = width - insets.left - insets.right < 520;
    const hostId = getLobbyHostId(roomData);
    const isHost = hostId === currentUserId;
    const isCreator = isHost && roomData.lobbyCreatorId === currentUserId;
    const canEjectPlayers = isCreator && premiumStatusResolved && hasPremium && roomData.status === 'WAITING';
    const [, refreshPresence] = useReducer(revision => revision + 1, 0);
    useEffect(() => {
        const interval = setInterval(refreshPresence, 1000);
        return () => clearInterval(interval);
    }, []);
    const serverNow = getEstimatedPresenceServerNow() ?? null;
    const disconnectedPlayerIds = new Set(getMissingLobbyPresencePlayerIds(roomData, serverNow));
    const hasDisconnectedPlayer = disconnectedPlayerIds.size > 0;
    const successor = roomData.players.find(player =>
        player.uid !== hostId && player.status !== 'BOT' && !disconnectedPlayerIds.has(player.uid),
    )?.uid;
    const canStart = roomData.players.length === 3 && !hasDisconnectedPlayer
        && (!isCreator || premiumStatusResolved);
    const shouldAutoStart = canStart && isHost && !canEjectPlayers;
    const canDeleteWaitingRoom = isHost && roomData.status === 'WAITING' && roomData.players.length <= 1 && !roomData.gameState;
    const [autoStartCountdown, setAutoStartCountdown] = useState<number | null>(null);
    const roster = JSON.stringify(roomData.players.map(player => player.uid));
    const requestInProgress = useRef(false);
    const [launchError, setLaunchError] = useState<string | null>(null);
    const [waitingExpired, setWaitingExpired] = useState(false);
    const [launching, setLaunching] = useState(false);

    const tryStartGame = useCallback(async () => {
        if (!isHost || !canStart || requestInProgress.current) return;
        requestInProgress.current = true;
        setLaunching(true);
        setLaunchError(null);
        try {
            await onStartGame();
        } catch (error) {
            LogService.warn('LobbyScreen', 'Multiplayer launch failed.', error);
            setLaunchError(error instanceof Error ? error.message : 'Le lancement a échoué. Réessaie.');
        } finally {
            requestInProgress.current = false;
            setLaunching(false);
        }
    }, [canStart, isHost, onStartGame]);

    useEffect(() => {
        setWaitingExpired(false);
        if (!canStart) return;
        const timer = setTimeout(() => setWaitingExpired(true), 15000);
        return () => clearTimeout(timer);
    }, [canStart, roster]);
    const rootRef = useRef<View>(null);
    const [botModalVisible, setBotModalVisible] = useState(false);
    const [isAddingBot, setIsAddingBot] = useState(false);

    const handleAddBot = () => {
        if (isAddingBot || roomData.players.length >= 3) return;
        setBotModalVisible(true);
    };

    const handleBotSelected = async (difficulty: BotDifficulty): Promise<void> => {
        if (isAddingBot || roomData.players.length >= 3) return;

        setIsAddingBot(true);
        try {
            await addBotToWaitingRoom(roomData.roomId, difficulty);
        } catch (error) {
            LogService.error('LobbyScreen', 'Unable to add bot to waiting room', error);
            Alert.alert('Ajout impossible', 'Le bot n’a pas pu être ajouté. Réessaie dans un instant.');
            throw error;
        } finally {
            setIsAddingBot(false);
        }
    };

    const [releasingPlayer, setReleasingPlayer] = useState<string | null>(null);
    const handleReleaseSeat = async (playerId: string, action?: 'EJECT') => {
        if (releasingPlayer) return;
        setReleasingPlayer(playerId);
        try {
            await releaseWaitingRoomSeat(roomData.roomId, playerId, action);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Réessaie dans un instant.';
            Alert.alert('Impossible de libérer la place', message);
        } finally {
            setReleasingPlayer(null);
        }
    };

    const confirmSeatRemoval = (playerId: string, name: string, action?: 'EJECT') => {
        const isEjection = action === 'EJECT';
        const title = isEjection ? 'Exclure ce joueur ?' : 'Libérer cette place ?';
        const message = isEjection
            ? `${name} quittera la table et sa place sera libérée.`
            : `La place de ${name} sera libérée.`;
        const confirm = () => { void handleReleaseSeat(playerId, action); };
        if (Platform.OS === 'web') {
            if (window.confirm(message)) confirm();
            return;
        }
        Alert.alert(title, message, [
            { text: 'Annuler', style: 'cancel' },
            { text: isEjection ? 'Exclure' : 'Libérer', style: 'destructive', onPress: confirm },
        ]);
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

    const handleLeaveRoom = () => {
        if (!onLeaveRoom) return;
        const message = 'Votre place sera libérée.';
        if (Platform.OS === 'web') {
            if (window.confirm(`Quitter la table ? ${message}`)) onLeaveRoom();
            return;
        }
        Alert.alert('Quitter la table ?', message, [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Quitter', style: 'destructive', onPress: onLeaveRoom },
        ]);
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
    useEffect(() => {
        if (!shouldAutoStart) {
            setAutoStartCountdown(null);
            return;
        }

        setAutoStartCountdown(2);
        const countdownTimer = setTimeout(() => setAutoStartCountdown(1), 1000);
        const autoStartTimer = setTimeout(() => setAutoStartCountdown(0), 2000);
        return () => {
            clearTimeout(countdownTimer);
            clearTimeout(autoStartTimer);
        };
    }, [shouldAutoStart, roster]);

    useEffect(() => {
        if (!shouldAutoStart || autoStartCountdown !== 0 || launching) return;
        setAutoStartCountdown(null);
        void tryStartGame();
    }, [autoStartCountdown, shouldAutoStart, launching, tryStartGame]);

    // Create array of 3 slots with player data
    const slots = Array.from({ length: 3 }, (_, index) => {
        const player = roomData.players[index];
        return {
            player,
            isCurrentUser: player?.uid === currentUserId,
            isHost: player?.uid === hostId,
            isEmpty: !player,
        };
    });
    const missingPlayerCount = Math.max(0, 3 - roomData.players.length);
    const failure = launchError || roomData.launchError;
    const showLeaveButton = onLeaveRoom && !isHost && roomData.status === 'WAITING'
        && slots.some(slot => slot.isCurrentUser);
    let waitingMessage: string | null = `En attente de ${missingPlayerCount} joueur${missingPlayerCount > 1 ? 's' : ''}...`;
    if (hasDisconnectedPlayer && roomData.players.length === 3) {
        waitingMessage = 'Un joueur est déconnecté — démarrage suspendu';
    } else if (canStart) {
        if (autoStartCountdown) waitingMessage = `Démarrage dans ${autoStartCountdown}...`;
        else if (launching) waitingMessage = 'Lancement de la partie…';
        else if (failure) waitingMessage = failure;
        else if (canEjectPlayers) waitingMessage = null;
        else if (waitingExpired) waitingMessage = isHost
            ? 'La partie est prête à être relancée.'
            : 'En attente du démarrage par l’hôte.';
        else waitingMessage = 'Préparation de la partie...';
    } else if (missingPlayerCount === 0) {
        waitingMessage = 'Préparation de la partie...';
    }

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
        const player = slot.player;
        const isDisconnected = player && disconnectedPlayerIds.has(player.uid);
        const canEject = player && !slot.isCurrentUser && player.status !== 'BOT' && !isDisconnected && canEjectPlayers;
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
                                    disabled={isAddingBot}
                                    soundName="clack1"
                                >
                                    <Text style={styles.addBotButtonText}>+ Bot</Text>
                                </PremiumButton>
                            )}
                        </>
                    ) : (
                        <>
                            {canEject && (
                                <PremiumButton
                                    style={styles.ejectButton}
                                    hitSlop={2}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Exclure ${player.displayName}`}
                                    disabled={releasingPlayer !== null || launching}
                                    onPress={() => confirmSeatRemoval(player.uid, player.displayName, 'EJECT')}
                                >
                                    <Text style={styles.ejectButtonLabel}>Exclure</Text>
                                </PremiumButton>
                            )}
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
                                        onPress={() => handleReleaseSeat(slot.player!.uid)}
                                        disabled={releasingPlayer !== null}
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
                            {disconnectedPlayerIds.has(slot.player!.uid) && (
                                <Text
                                    style={styles.disconnectedPlayerStatus}
                                    accessibilityLabel={`${slot.player!.displayName} est déconnecté`}
                                >
                                    ● Déconnecté
                                </Text>
                            )}
                            <GradeBadge grade={slot.player?.leagueGrade} size="xs" />
                            {player && !slot.isCurrentUser && isDisconnected
                                && (isHost || (slot.isHost && successor === currentUserId)) && (
                                <PremiumButton
                                    style={styles.releaseSeatButton}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Libérer la place de ${player.displayName}`}
                                    disabled={releasingPlayer !== null}
                                    onPress={() => confirmSeatRemoval(player.uid, player.displayName)}
                                >
                                    <Text style={styles.releaseSeatButtonLabel}>Libérer</Text>
                                </PremiumButton>
                            )}
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
            <Animated.ScrollView
                style={styles.scroll}
                contentContainerStyle={[
                    styles.scrollContent,
                    {
                        paddingTop: Math.max(12, insets.top + 8),
                        paddingRight: Math.max(16, insets.right + 12),
                        paddingBottom: Math.max(16, insets.bottom + 12),
                        paddingLeft: Math.max(16, insets.left + 12),
                    },
                ]}
                showsVerticalScrollIndicator={false}
                bounces={false}
            >
            <Animated.View entering={FadeIn.delay(100)} style={styles.header}>
                <View style={styles.headerCenter}>
                    <EconomyHeader />
                </View>
                <View style={styles.headerRightContent}>
                    <PremiumButton
                        style={styles.shareIconButton}
                        onPress={shareToWhatsApp}
                        soundName="notify"
                        accessibilityRole="button"
                        accessibilityLabel="Partager la salle sur WhatsApp"
                        hitSlop={7}
                    >
                        <Ionicons name="logo-whatsapp" size={17} color="#FFF" />
                    </PremiumButton>
                    <View style={styles.roomInfoContainer}>
                        <Text style={styles.roomCode}>Code : {roomData.roomId}</Text>
                    </View>
                </View>
            </Animated.View>

                <View style={[styles.mainContent, compactLayout && styles.mainContentCompact]}>
                    <Animated.View entering={FadeIn.delay(400)} style={[styles.optionsSection, compactLayout && styles.optionsSectionCompact]}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>TABLE</Text>
                            {showLeaveButton && (
                                <PremiumButton
                                    accessibilityRole="button"
                                    accessibilityLabel="Quitter la table"
                                    onPress={handleLeaveRoom}
                                    style={styles.leaveRoomButton}
                                >
                                    <MaterialCommunityIcons name="door-open" size={24} color="#FF6B6B" />
                                </PremiumButton>
                            )}
                            {canDeleteWaitingRoom && onDeleteRoom ? (
                                <PremiumButton
                                    style={styles.deleteRoomButton}
                                    onPress={handleDeleteRoom}
                                    soundName="clack1"
                                    hitSlop={6}
                                    accessibilityRole="button"
                                    accessibilityLabel="Supprimer la table"
                                >
                                    <Ionicons name="trash-outline" size={20} color="#FF8A65" />
                                </PremiumButton>
                            ) : null}
                        </View>
                        <View style={[styles.optionsGrid, compactLayout && styles.optionsGridCompact]}>
                            <View style={[styles.optionChip, compactLayout && styles.optionChipCompact]}>
                                <Text style={styles.optionChipLabel}>Mode</Text>
                                <Text style={styles.optionChipValue}>{MODE_LABELS[gameMode] || gameMode}</Text>
                            </View>
                            <View style={[styles.optionChip, compactLayout && styles.optionChipCompact]}>
                                <Text style={styles.optionChipLabel}>Objectif</Text>
                                <Text style={styles.optionChipValue}>{winningCondition} {MODE_UNIT_LABELS[gameMode]}</Text>
                            </View>
                            <View style={[styles.optionChip, compactLayout && styles.optionChipCompact]}>
                                <Text style={styles.optionChipLabel}>Tour</Text>
                                <Text style={styles.optionChipValue}>{turnDuration}s</Text>
                            </View>
                        </View>
                    </Animated.View>

                    <View style={[styles.playersContainer, compactLayout && styles.playersContainerCompact]}>
                        {slots.map((slot, index) => renderPlayerCard(slot, index))}
                    </View>
                </View>

                {waitingMessage && (
                    <Animated.View entering={FadeInUp.delay(600).duration(500)} style={styles.waitingStatus}>
                        <Ionicons
                            name={canStart ? 'checkmark-circle-outline' : 'time-outline'}
                            size={18}
                            color={canStart ? '#81C784' : 'rgba(255,255,255,0.55)'}
                        />
                        <Text accessibilityLiveRegion="polite" style={[styles.waitingText, canStart && styles.readyText]}>
                            {waitingMessage}
                        </Text>
                    </Animated.View>
                )}
                {canStart && isHost && !launching && autoStartCountdown === null
                    && (canEjectPlayers || failure || waitingExpired) && (
                    <PremiumButton
                        accessibilityRole="button"
                        disabled={releasingPlayer !== null}
                        onPress={tryStartGame}
                        style={styles.startButton}
                    >
                        <LinearGradient colors={['#FFD700', '#FFA500']} style={styles.startButtonGradient}>
                            <Text style={styles.startButtonLabel}>
                                {canEjectPlayers && !failure ? 'Démarrer la partie' : 'Relancer la partie'}
                            </Text>
                        </LinearGradient>
                    </PremiumButton>
                )}
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
    },
    scroll: {
        flex: 1,
    },
    // ─── Header ─────────────────────────────────────────────────
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        rowGap: 10,
        columnGap: 16,
        marginBottom: 14,
    },
    headerCenter: {
        flexShrink: 1,
    },
    headerRightContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginLeft: 'auto',
        backgroundColor: 'rgba(0,0,0,0.3)',
        paddingVertical: 3,
        paddingHorizontal: 7,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.2)',
    },
    roomInfoContainer: {
        alignItems: 'flex-start',
    },
    roomCode: {
        fontSize: 12,
        color: '#FFD700',
        fontWeight: 'bold',
        letterSpacing: 0.8,
    },
    roomTypeBadge: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
        textTransform: 'uppercase',
    },
    shareIconButton: {
        width: 30,
        height: 30,
        borderRadius: 15,
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
    },
    mainContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        minHeight: 180,
    },
    mainContentCompact: {
        flexDirection: 'column',
        alignItems: 'stretch',
    },
    // ─── Player Cards (Reduced -20%) ────────────────────────────
    playersContainer: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
    },
    playersContainerCompact: {
        flex: 0,
        gap: 6,
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
    disconnectedPlayerStatus: {
        color: '#FFB74D',
        fontSize: 10,
        fontWeight: '700',
        marginTop: 3,
    },
    emptyText: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 10,
        fontStyle: 'italic',
    },
    // ─── Options Section (2x2 Grid) ─────────────────────────────
    optionsSection: {
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.15)',
        width: 150,
        justifyContent: 'center',
    },
    optionsSectionCompact: {
        width: '100%',
    },
    sectionHeader: {
        minHeight: 40,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#FFD700',
        letterSpacing: 2,
    },
    optionsGrid: {
        flexDirection: 'column',
        gap: 6,
    },
    optionsGridCompact: {
        flexDirection: 'row',
    },
    optionChip: {
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 4,
        alignItems: 'center',
    },
    optionChipCompact: {
        width: 'auto',
        flex: 1,
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
    deleteRoomButton: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,99,71,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    ejectButton: {
        alignSelf: 'stretch',
        minHeight: 40,
        marginBottom: 8,
        borderRadius: 9,
        backgroundColor: '#B82036',
        alignItems: 'center',
        justifyContent: 'center',
    },
    ejectButtonLabel: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '800',
    },
    releaseSeatButton: {
        alignSelf: 'stretch',
        minHeight: 44,
        marginTop: 8,
        paddingHorizontal: 3,
        borderRadius: 9,
        backgroundColor: '#FFA500',
        alignItems: 'center',
        justifyContent: 'center',
    },
    releaseSeatButtonLabel: {
        color: '#24143F',
        fontSize: 12,
        fontWeight: '800',
        textAlign: 'center',
    },
    leaveRoomButton: {
        alignSelf: 'center',
        width: 44,
        height: 44,
        borderRadius: 10,
        backgroundColor: 'rgba(255,107,107,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255,107,107,0.45)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    startButton: {
        alignSelf: 'center',
        marginTop: 16,
        borderRadius: 14,
        overflow: 'hidden',
    },
    startButtonGradient: {
        minHeight: 48,
        paddingHorizontal: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    startButtonLabel: {
        color: '#24143F',
        fontSize: 16,
        fontWeight: '800',
    },
    waitingStatus: {
        minHeight: 40,
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    waitingText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 14,
        fontStyle: 'italic',
    },
    readyText: {
        color: '#A5D6A7',
        fontStyle: 'normal',
        fontWeight: '700',
    },
});
