import React, { useCallback, useRef, useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Modal,
    Pressable, Switch, Clipboard, Platform, ScrollView, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { GameState } from '../../core/types';
import { PremiumButton } from '../common/PremiumButton';
import { PlayerCard } from '../common/PlayerCard';

export interface GameOptionsMenuProps {
    visible: boolean;
    onClose: () => void;
    isSoloMode: boolean;
    gameState: GameState | null;
    localPlayerId?: string;
    gameId?: string;
    roomData?: any;
    isBgmEnabled: boolean;
    onToggleBgm: () => void;
    isSfxEnabled: boolean;
    onToggleSfx: () => void;
    isVibrationEnabled: boolean;
    onToggleVibration: () => void;
    onQuitGame: () => void;
}

type Tab = 'JEU' | 'INFOS' | 'JOUEURS' | 'HISTORIQUE';

function gameModeLabel(mode?: string): string {
    switch (mode) {
        case 'VICTOIRE': return 'Victoire';
        case 'MANCHE':   return 'Manche';
        case 'SCORE':    return 'Score';
        case 'COCHON':   return 'Cochon';
        default:         return mode ?? '—';
    }
}

function objectifLabel(state: GameState): string {
    const n = state.winningCondition;
    switch (state.gameMode) {
        case 'VICTOIRE': return `${n} victoire${n > 1 ? 's' : ''}`;
        case 'MANCHE':   return `${n} manche${n > 1 ? 's' : ''}`;
        case 'SCORE':    return `${n} points`;
        case 'COCHON':   return `${n} cochon${n > 1 ? 's' : ''}`;
        default:         return `${n}`;
    }
}

function botDifficultyLabel(difficulty?: string): string {
    switch (difficulty) {
        case 'TI_MANMAY': return 'Debutant';
        case 'MAPIPI': return 'Intermediaire';
        case 'GRAN_MOUN': return 'Difficile';
        case 'METKAYALI': return 'Met Kayali';
        default: return 'Inconnue';
    }
}

export const GameOptionsMenu: React.FC<GameOptionsMenuProps> = ({
    visible,
    onClose,
    isSoloMode,
    gameState,
    localPlayerId,
    gameId,
    roomData,
    isBgmEnabled,
    onToggleBgm,
    isSfxEnabled,
    onToggleSfx,
    isVibrationEnabled,
    onToggleVibration,
    onQuitGame,
}) => {
    const [activeTab, setActiveTab] = useState<Tab>('INFOS');
    const [showQuitConfirm, setShowQuitConfirm] = useState(false);
    const [codeCopied, setCodeCopied] = useState(false);
    const closeHandledRef = useRef(false);
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const isCompactWidth = screenWidth < 380;

    const handleCopyCode = () => {
        if (!gameId) return;
        if (Platform.OS === 'web') {
            navigator.clipboard?.writeText(gameId);
        } else {
            Clipboard.setString(gameId);
        }
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
    };

    const handleClose = useCallback(() => {
        if (closeHandledRef.current) return;
        closeHandledRef.current = true;
        setShowQuitConfirm(false);
        setActiveTab('INFOS');
        onClose();
        setTimeout(() => {
            closeHandledRef.current = false;
        }, 0);
    }, [onClose]);

    const handleConfirmQuit = () => {
        setShowQuitConfirm(false);
        handleClose();
        onQuitGame();
    };

    const connectedPlayers: { displayName: string; uid: string }[] = roomData?.players ?? [];
    const soloBotDifficulty = isSoloMode
        ? gameState?.players.find((player) => player.status === 'BOT')?.difficulty
        : undefined;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={handleClose}
            statusBarTranslucent
        >
            {/* Backdrop — centré */}
            <Animated.View entering={FadeIn.duration(160)} style={styles.backdrop}>
                <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} testID="options-backdrop" />

                {/* Card centrée */}
                <Animated.View
                    entering={ZoomIn.duration(220).springify()}
                    style={[
                        styles.card,
                        {
                            width: isCompactWidth ? '94%' : '88%',
                            maxWidth: 460,
                            height: screenHeight * 0.9,
                        },
                    ]}
                    onStartShouldSetResponder={() => true}
                >
                    <LinearGradient colors={['#2D1B4E', '#1A0E2E']} style={styles.cardInner}>

                        {/* ── Ligne unique : onglets + X ── */}
                        <View style={styles.topRow}>
                            <View style={styles.tabBar}>
                                {([ 'INFOS', 'JOUEURS', 'JEU', 'HISTORIQUE'] as Tab[]).map(tab => (
                                    <PremiumButton
                                        key={tab}
                                        style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
                                        onPress={() => setActiveTab(tab)}
                                        soundName="clack1"
                                    >
                                        <Text
                                            style={[styles.tabLabel, isCompactWidth && styles.tabLabelCompact, activeTab === tab && styles.tabLabelActive]}
                                            numberOfLines={1}
                                            adjustsFontSizeToFit
                                            minimumFontScale={0.82}
                                        >
                                            {tab === 'JEU' ? '⚙️ Réglages' : tab === 'INFOS' ? 'ℹ️ Infos' : tab === 'JOUEURS' ? '👥 Joueurs' : '📜 Historique'}
                                        </Text>
                                    </PremiumButton>
                                ))}
                            </View>

                            <Pressable
                                onPress={handleClose}
                                style={styles.closeBtn}
                                hitSlop={{ top: 16, right: 16, bottom: 16, left: 16 }}
                                accessibilityRole="button"
                                accessibilityLabel="Fermer les options"
                                testID="options-close-button"
                            >
                                <Ionicons name="close" size={18} color="#FFD700" />
                            </Pressable>
                        </View>

                        {/* ── Contenu ── */}
                        <View style={styles.content}>                            

                            {/* Onglet INFOS */}
                            {activeTab === 'INFOS' && gameState && (
                                <View>
                                    <InfoRow 
                                        icon="game-controller-outline" 
                                        label="Partie" 
                                        value={`Mode ${gameModeLabel(gameState.gameMode)} - Objectif ${gameState.winningCondition}${isSoloMode ? ` - Niveau ${botDifficultyLabel(soloBotDifficulty)}` : ''}`} 
                                    />
                                    <InfoRow 
                                        icon="layers-outline" 
                                        label="En cours" 
                                        value={`Manche ${Math.max(1, gameState.mancheNumber ?? 1)} · Round ${Math.max(1, gameState.roundNumber ?? 1)}`} 
                                    />

                                    {!isSoloMode && gameId && (
                                        <>
                                            <View style={styles.divider} />
                                            <PremiumButton style={styles.codeRow} onPress={handleCopyCode} soundName="notify">
                                                <Ionicons name="key-outline" size={15} color="#FFD700" />
                                                <Text style={styles.codeLabel}>Code salle</Text>
                                                <Text style={styles.codeValue}>{gameId}</Text>
                                                <Ionicons
                                                    name={codeCopied ? 'checkmark-circle' : 'copy-outline'}
                                                    size={15}
                                                    color={codeCopied ? '#4CAF50' : '#aaa'}
                                                />
                                            </PremiumButton>
                                        </>
                                    )}

                                </View>
                            )}

                            {/* Onglet JOUEURS */}
                            {activeTab === 'JOUEURS' && gameState && (
                                <View style={styles.playersBlock}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                                        {gameState.players.map(p => (
                                            <PlayerCard
                                                key={p.id}
                                                playerId={p.id}
                                                playerName={p.name}
                                                avatarId={p.avatarId}
                                                grade={p.leagueGrade}
                                                isLocalPlayer={p.id === localPlayerId}
                                            />
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* Onglet JEU */}
                            {activeTab === 'JEU' && (
                                <View>
                                    {isSoloMode && (
                                        <View style={styles.pauseNotice}>
                                            <Ionicons name="pause-circle-outline" size={13} color="#aaa" />
                                            <Text style={styles.pauseNoticeText}>Partie en pause</Text>
                                        </View>
                                    )}
                                    <ToggleRow
                                        icon={isBgmEnabled ? 'musical-notes' : 'musical-notes-outline'}
                                        label="Musique"
                                        value={isBgmEnabled}
                                        onToggle={onToggleBgm}
                                    />
                                    <ToggleRow
                                        icon={isSfxEnabled ? 'volume-high' : 'volume-mute'}
                                        label="Effets"
                                        value={isSfxEnabled}
                                        onToggle={onToggleSfx}
                                    />
                                    <ToggleRow
                                        icon={isVibrationEnabled ? 'phone-portrait-outline' : 'phone-portrait-sharp'}
                                        label="Vibration"
                                        value={isVibrationEnabled}
                                        onToggle={onToggleVibration}
                                    />
                                </View>
                            )}

                            {activeTab === 'HISTORIQUE' && gameState && (
                                <View>
                                    <View style={styles.historyCurrentBlock}>
                                        <Text style={styles.historyCurrentTitle}>En cours</Text>
                                        <Text style={styles.historyCurrentText}>
                                            Manche {Math.max(1, gameState.mancheNumber ?? 1)} · Round {Math.max(1, gameState.roundNumber ?? 1)}
                                        </Text>
                                    </View>

                                    <View style={styles.historyTableHeader}>
                                        <Text style={[styles.historyCell, styles.historyCellLabel]}>Manche</Text>
                                        {gameState.players.map((player) => (
                                            <Text
                                                key={player.id}
                                                style={[
                                                    styles.historyCell,
                                                    player.id === localPlayerId && styles.historyCellMe,
                                                ]}
                                                numberOfLines={1}
                                            >
                                                {player.id === localPlayerId ? 'Moi' : player.name}
                                            </Text>
                                        ))}
                                    </View>

                                    <ScrollView style={styles.historyScroll} showsVerticalScrollIndicator={false}>
                                        {gameState.mancheHistory?.length ? (
                                            gameState.mancheHistory.map((manche, index) => (
                                                <View key={`${manche.mancheNumber}-${index}`} style={styles.historyRowTable}>
                                                    <View style={styles.historyLabelCol}>
                                                        <Text style={[styles.historyCell, styles.historyCellLabel]}>
                                                            M{manche.mancheNumber}
                                                        </Text>
                                                        <Text style={styles.historyResultBadge}>
                                                            {manche.resultType === 'COCHON'
                                                                ? manche.cochonCount && manche.cochonCount > 1 ? 'Double cochon' : 'Cochon'
                                                                : manche.resultType === 'CHIRE'
                                                                    ? 'Chiré'
                                                                    : 'Victoire'}
                                                        </Text>
                                                    </View>
                                                    {gameState.players.map((player) => (
                                                        <Text key={player.id} style={styles.historyCell}>
                                                            {manche.points[player.id] ?? 0}
                                                        </Text>
                                                    ))}
                                                </View>
                                            ))
                                        ) : (
                                            <Text style={styles.emptyHistoryText}>
                                                Aucune manche terminée pour le moment.
                                            </Text>
                                        )}
                                    </ScrollView>
                                </View>
                            )}
                        </View>

                        {/* ── Footer Quitter ── */}
                        <View style={styles.footer}>
                            {!showQuitConfirm ? (
                                <PremiumButton style={styles.quitBtn} onPress={() => setShowQuitConfirm(true)} soundName="notify">
                                    <Ionicons name="exit-outline" size={16} color="#fff" />
                                    <Text style={styles.quitBtnText}>{isSoloMode ? 'Quitter la partie' : 'Abandonner la table'}</Text>
                                </PremiumButton>
                            ) : (
                                <View style={styles.confirmRow}>
                                    <Text style={styles.confirmText}>{isSoloMode ? 'Vraiment quitter ?' : 'Quitter et abandonner ?'}</Text>
                                    <View style={styles.confirmBtns}>
                                        <PremiumButton style={styles.confirmBtnNo} onPress={() => setShowQuitConfirm(false)} soundName="clack1">
                                            <Text style={styles.confirmBtnNoText}>Rester</Text>
                                        </PremiumButton>
                                        <PremiumButton style={styles.confirmBtnYes} onPress={handleConfirmQuit} soundName="clack1">
                                            <Text style={styles.confirmBtnYesText}>{isSoloMode ? 'Quitter' : 'Abandonner'}</Text>
                                        </PremiumButton>
                                    </View>
                                </View>
                            )}
                        </View>

                    </LinearGradient>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const ToggleRow: React.FC<{ icon: string; label: string; value: boolean; onToggle: () => void }> = ({ icon, label, value, onToggle }) => (
    <View style={styles.toggleRow}>
        <Ionicons name={icon as any} size={17} color="#FFD700" />
        <Text style={styles.toggleLabel}>{label}</Text>
        <Switch
            value={value}
            onValueChange={onToggle}
            trackColor={{ false: 'rgba(255,255,255,0.15)', true: 'rgba(255,215,0,0.5)' }}
            thumbColor={value ? '#FFD700' : '#888'}
            ios_backgroundColor="rgba(255,255,255,0.15)"
        />
    </View>
);

const InfoRow: React.FC<{ icon: string; label: string; value: string }> = ({ icon, label, value }) => (
    <View style={styles.infoRow}>
        <Ionicons name={icon as any} size={14} color="#FFD700" />
        <Text style={styles.infoRowLabel}>{label}</Text>
        <Text style={styles.infoRowValue}>{value}</Text>
    </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',   // centré verticalement
        alignItems: 'center',       // centré horizontalement
    },
    card: {
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.25)',
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
    },
    cardInner: {
        flex: 1,
        paddingBottom: 14,
    },
    // ── Ligne tabs + X ──
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingTop: 10,
        paddingBottom: 6,
        gap: 8,
        borderBottomWidth: 1,
        borderColor: 'rgba(255,215,0,0.1)',
    },
    tabBar: {
        flex: 1,
        flexDirection: 'row',
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.06)',
        padding: 2,
    },
    tabBtn: {
        flex: 1,
        paddingVertical: 6,
        paddingHorizontal: 2,
        borderRadius: 6,
        alignItems: 'center',
    },
    tabBtnActive: {
        backgroundColor: 'rgba(255,215,0,0.18)',
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.35)',
    },
    tabLabel: {
        color: 'rgba(255,255,255,0.45)',
        fontWeight: '600',
        fontSize: 11,
        includeFontPadding: false,
    },
    tabLabelCompact: {
        fontSize: 10,
    },
    tabLabelActive: {
        color: '#FFD700',
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
        elevation: 12,
    },
    // ── Contenu ──
    content: {
        flex: 1,
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 4,
    },
    pauseNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginBottom: 5,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 6,
    },
    pauseNoticeText: {
        color: '#aaa',
        fontSize: 11,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
        gap: 10,
    },
    toggleLabel: {
        flex: 1,
        color: '#fff',
        fontSize: 13,
        fontWeight: '500',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 7,
        borderBottomWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
        gap: 8,
    },
    infoRowLabel: {
        flex: 1,
        color: 'rgba(255,255,255,0.55)',
        fontSize: 12,
    },
    infoRowValue: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    historyCurrentBlock: {
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 10,
        backgroundColor: 'rgba(255,215,0,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.15)',
        marginBottom: 10,
    },
    historyCurrentTitle: {
        color: 'rgba(255,255,255,0.45)',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 3,
    },
    historyCurrentText: {
        color: '#FFD700',
        fontSize: 13,
        fontWeight: '700',
    },
    historyTableHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 8,
        marginBottom: 6,
        gap: 6,
    },
    historyScroll: {
        maxHeight: 220,
    },
    historyRowTable: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        gap: 6,
    },
    historyLabelCol: {
        width: 62,
        alignItems: 'center',
        gap: 2,
    },
    historyCell: {
        flex: 1,
        color: '#fff',
        fontSize: 11,
        textAlign: 'center',
    },
    historyCellLabel: {
        flex: 0,
        width: 52,
        fontWeight: '700',
        color: '#FFD700',
    },
    historyCellMe: {
        color: '#FFD700',
        fontWeight: '700',
    },
    historyResultBadge: {
        color: 'rgba(255,255,255,0.45)',
        fontSize: 9,
        textAlign: 'center',
    },
    emptyHistoryText: {
        color: 'rgba(255,255,255,0.45)',
        textAlign: 'center',
        paddingVertical: 16,
        fontStyle: 'italic',
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,215,0,0.15)',
        marginVertical: 8,
    },
    codeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 7,
        borderBottomWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
    },
    codeLabel: {
        flex: 1,
        color: 'rgba(255,255,255,0.55)',
        fontSize: 12,
    },
    codeValue: {
        color: '#FFD700',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1,
    },
    playersBlock: {
        marginTop: 8,
    },
    playersTitle: {
        color: 'rgba(255,255,255,0.45)',
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 0.5,
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    playerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 3,
    },
    playerName: {
        color: '#fff',
        fontSize: 12,
    },
    // ── Footer Quitter ──
    footer: {
        marginTop: 6,
        paddingHorizontal: 14,
        paddingBottom: 2,
    },
    quitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#C0392B',
        borderRadius: 10,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    quitBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 13,
    },
    confirmRow: {
        alignItems: 'center',
        gap: 8,
    },
    confirmText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
    },
    confirmBtns: {
        flexDirection: 'row',
        gap: 8,
        width: '100%',
    },
    confirmBtnNo: {
        flex: 1,
        paddingVertical: 9,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    confirmBtnNoText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 12,
    },
    confirmBtnYes: {
        flex: 1,
        paddingVertical: 9,
        borderRadius: 8,
        backgroundColor: '#C0392B',
        alignItems: 'center',
    },
    confirmBtnYesText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 12,
    },
});
