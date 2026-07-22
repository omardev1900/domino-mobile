import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, ZoomIn, FadeInLeft, useReducedMotion } from 'react-native-reanimated';
import { EdgeInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { GameState, Domino } from '../../core/types';
import { UnifiedResultOverlay } from '../UnifiedResultOverlay'; // Assuming standard path

export interface GameOverlaysProps {
    gameState: GameState | null;
    pendingDomino: Domino | null;
    isLandscape: boolean;
    insets: EdgeInsets;
    isSoloMode: boolean;
    gameId?: string;
    showRoomInfo: boolean;
    onCloseRoomInfo: () => void;
    showScoreOverlay: boolean;
    localPlayerId: string;
    onOverlayContinue: () => void;
    onLeaveRoom: () => void;
    roomData?: any; // To determine if the local player is host
    bannerState: 'NONE' | 'MANCHE' | 'ROUND';
    isPaused: boolean;
    onResume: () => void;
    onReplay?: () => void;
    matchReward?: any | null; // Passer les requêtes de recompénses depuis GameScreen
}

export const GameOverlays: React.FC<GameOverlaysProps> = ({
    gameState,
    pendingDomino,
    isLandscape,
    insets,
    isSoloMode,
    gameId,
    showRoomInfo,
    onCloseRoomInfo,
    showScoreOverlay,
    localPlayerId,
    onOverlayContinue,
    onLeaveRoom,
    roomData,
    bannerState,
    isPaused,
    onResume,
    onReplay,
    matchReward,
}) => {
    const isHost = isSoloMode || roomData?.createdBy === localPlayerId;
    const reducedMotion = useReducedMotion();
    const [showQuitConfirm, setShowQuitConfirm] = useState(false);

    return (
        <View style={styles.container} pointerEvents="box-none" testID="game-overlays">
            {/* CHOICE BANNER (Overlay) */}
            {pendingDomino && (
                <View style={[
                    styles.choiceBanner,
                    isLandscape ? { top: 15, bottom: undefined } : { bottom: 160 }
                ]} pointerEvents="none" testID="choice-banner">
                    <Animated.View key="choice-banner-anim" entering={reducedMotion ? undefined : FadeIn.duration(300)}>
                        <Text style={styles.choiceText}>CHOISISSEZ UN CÔTÉ</Text>
                    </Animated.View>
                </View>
            )}

            {/* ROOM INFO CARD */}
            {!isSoloMode && gameId && showRoomInfo && gameState && (
                <Pressable
                    style={styles.infoBackdrop}
                    onPress={onCloseRoomInfo}
                    testID="room-info-backdrop"
                >
                    <Pressable style={styles.infoCard} onPress={(e) => e.stopPropagation()}>
                        {/* Explicit Close Button (X) */}
                        <TouchableOpacity
                            onPress={onCloseRoomInfo}
                            style={styles.infoCardCloseBtn}
                            testID="btn-close-room-info"
                        >
                            <Ionicons name="close" size={24} color="#FFD700" />
                        </TouchableOpacity>

                        {/* Room Code Row */}
                        <View style={styles.infoCardHeader}>
                            <Ionicons name="game-controller-outline" size={16} color="#FFD700" />
                            <Text style={styles.infoCardTitle}>Salle</Text>
                        </View>

                        <TouchableOpacity
                            style={styles.infoCardCodeRow}
                            onPress={() => {
                                Clipboard.setStringAsync(gameId);
                                Alert.alert("✓ Copié", "Code copié dans le presse-papier !");
                            }}
                            activeOpacity={0.7}
                            testID="btn-copy-code"
                        >
                            <Ionicons name="copy-outline" size={14} color="rgba(255,255,255,0.5)" />
                            <Text style={styles.infoCardCode}>{gameId}</Text>
                        </TouchableOpacity>

                        {/* Game Objective & Mode Section */}
                        <View style={styles.infoCardDivider} />

                        {/* Line 1: Objective */}
                        <View style={styles.infoRow}>
                            <Ionicons name="star-outline" size={16} color="#FFD700" />
                            <Text style={styles.infoLabel}>Objectif : </Text>
                            <Text style={styles.infoValue}>
                                {gameState.gameMode === 'VICTOIRE'
                                    ? `${gameState.winningCondition} victoire${gameState.winningCondition > 1 ? 's' : ''}`
                                    : gameState.gameMode === 'MANCHE'
                                        ? `${gameState.winningCondition} manche${gameState.winningCondition > 1 ? 's' : ''}`
                                        : gameState.gameMode === 'SCORE'
                                            ? `${gameState.winningCondition} points`
                                            : `${gameState.winningCondition} cochon${gameState.winningCondition > 1 ? 's' : ''}`
                                }
                            </Text>
                        </View>

                        {/* Line 2: Mode */}
                        <View style={[styles.infoRow, { marginTop: 10 }]}>
                            <Ionicons name="trophy-outline" size={16} color="#FFD700" />
                            <Text style={styles.infoLabel}>Mode de jeu : </Text>
                            <Text style={styles.infoValue}>
                                {gameState.gameMode === 'VICTOIRE' ? 'Victoire' : gameState.gameMode === 'MANCHE' ? 'Manche' : gameState.gameMode === 'SCORE' ? 'Score' : 'Cochon'}
                            </Text>
                        </View>
                    </Pressable>
                </Pressable>
            )}

            {/* UNIFIED SCORE OVERLAY */}
            {showScoreOverlay && gameState && (
                <Animated.View 
                    key="unified-score-overlay"
                    style={{ ...StyleSheet.absoluteFillObject, zIndex: 2000 }}
                    entering={reducedMotion ? undefined : FadeIn}
                    exiting={reducedMotion ? undefined : FadeOut}
                >
                    <UnifiedResultOverlay
                        gameState={gameState}
                        visible={showScoreOverlay}
                        currentUserId={localPlayerId}
                        onContinue={onOverlayContinue}
                        onLeave={onLeaveRoom}
                        onReplay={onReplay}
                        isSoloMode={isSoloMode}
                        isHost={isHost}
                        matchReward={matchReward}
                    />
                </Animated.View>
            )}



            {bannerState !== 'NONE' && gameState && (
                <Animated.View
                    key={bannerState}
                    entering={reducedMotion ? undefined : ZoomIn.duration(300)}
                    exiting={reducedMotion ? undefined : FadeOut.duration(300)}
                    style={styles.roundBannerContainer}
                    pointerEvents="none"
                    testID="round-banner"
                >
                    <View style={styles.roundBanner}>
                        <Text style={styles.roundBannerText}>
                            {bannerState === 'MANCHE' ? `Manche N° ${gameState.mancheNumber || 1}` : `Round ${gameState.roundNumber || 1}`}
                        </Text>
                    </View>
                </Animated.View>
            )}

            {/* PAUSE OVERLAY */}
            {isPaused && (
                <View style={styles.pauseOverlay} pointerEvents="auto" testID="pause-overlay">
                    <Animated.View key="pause-content-anim" entering={reducedMotion ? undefined : FadeInLeft.duration(300)} style={styles.pauseContent}>
                        {!showQuitConfirm ? (
                            <>
                                <Ionicons name="pause-circle" size={80} color="#FFD700" />
                                <Text style={styles.pauseTitle}>PAUSE</Text>
                                <TouchableOpacity
                                    style={styles.resumeButton}
                                    onPress={() => { setShowQuitConfirm(false); onResume(); }}
                                    testID="btn-resume"
                                >
                                    <Text style={styles.resumeButtonText}>REPRENDRE</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.quitButton}
                                    onPress={() => setShowQuitConfirm(true)}
                                    testID="btn-quit"
                                >
                                    <Text style={styles.quitButtonText}>QUITTER LA PARTIE</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <Ionicons name="warning-outline" size={60} color="#FF6B6B" />
                                <Text style={styles.pauseTitle}>QUITTER ?</Text>
                                <Text style={styles.confirmSubtitle}>La partie sera abandonnée.</Text>
                                <TouchableOpacity
                                    style={styles.quitButton}
                                    onPress={onLeaveRoom}
                                    testID="btn-quit-confirm"
                                >
                                    <Text style={styles.quitButtonText}>OUI, QUITTER</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.resumeButton}
                                    onPress={() => setShowQuitConfirm(false)}
                                    testID="btn-quit-cancel"
                                >
                                    <Text style={styles.resumeButtonText}>NON, RESTER</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </Animated.View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 100,
    },
    choiceBanner: {
        position: 'absolute',
        alignSelf: 'center',
        backgroundColor: 'rgba(255, 215, 0, 0.9)',
        paddingHorizontal: 30,
        paddingVertical: 12,
        borderRadius: 25,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        zIndex: 100,
    },
    choiceText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 16,
        letterSpacing: 2,
    },
    infoBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1500,
    },
    infoCard: {
        backgroundColor: '#1E1E1E',
        borderRadius: 16,
        padding: 24,
        width: '85%',
        maxWidth: 340,
        borderWidth: 1,
        borderColor: 'rgba(255, 215, 0, 0.3)',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.8,
        shadowRadius: 15,
        elevation: 15,
    },
    infoCardCloseBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        padding: 4,
        zIndex: 10,
    },
    infoCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    infoCardTitle: {
        color: '#FFD700',
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    infoCardCodeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
        gap: 12,
        width: '100%',
        justifyContent: 'center',
    },
    infoCardCode: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 2,
    },
    infoCardDivider: {
        width: '100%',
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginVertical: 20,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        paddingHorizontal: 10,
    },
    infoLabel: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 14,
        marginLeft: 8,
    },
    infoValue: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 'bold',
        marginLeft: 'auto',
    },
    roundBannerContainer: {
        position: 'absolute',
        top: '30%',
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 900,
    },
    roundBanner: {
        backgroundColor: 'rgba(0,0,0,0.85)',
        paddingHorizontal: 40,
        paddingVertical: 15,
        borderRadius: 30,
        borderWidth: 2,
        borderColor: '#FFD700',
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 10,
    },
    roundBannerText: {
        color: '#FFD700',
        fontSize: 28,
        fontWeight: '900',
        letterSpacing: 2,
        textTransform: 'uppercase',
    },
    pauseOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 200,
    },
    pauseContent: {
        alignItems: 'center',
        backgroundColor: '#1a2a1a',
        padding: 40,
        borderRadius: 30,
        borderWidth: 2,
        borderColor: '#FFD700',
        width: '80%',
    },
    pauseTitle: {
        color: '#FFF',
        fontSize: 32,
        fontWeight: 'bold',
        marginTop: 20,
        marginBottom: 30,
        letterSpacing: 4,
    },
    resumeButton: {
        backgroundColor: '#4CAF50',
        paddingHorizontal: 40,
        paddingVertical: 15,
        borderRadius: 30,
        width: '100%',
        alignItems: 'center',
        marginBottom: 15,
    },
    resumeButtonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    quitButton: {
        backgroundColor: 'rgba(255, 60, 60, 0.8)',
        paddingHorizontal: 40,
        paddingVertical: 15,
        borderRadius: 30,
        width: '100%',
        alignItems: 'center',
    },
    quitButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    confirmSubtitle: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 14,
        marginBottom: 20,
        textAlign: 'center',
    },
    boudeOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    boudeContent: {
        backgroundColor: 'rgba(0,0,0,0.85)',
        paddingHorizontal: 60,
        paddingVertical: 30,
        borderRadius: 40,
        borderWidth: 3,
        borderColor: '#FFD700',
        alignItems: 'center',
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 30,
        elevation: 20,
    },
    boudeTitle: {
        color: '#FFD700',
        fontSize: 42,
        fontWeight: '900',
        letterSpacing: 6,
        textShadowColor: 'rgba(255, 215, 0, 0.5)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 15,
        textTransform: 'uppercase',
    },
    boudeSubtitle: {
        color: '#FFFFFF',
        fontSize: 14,
        marginTop: 12,
        opacity: 0.9,
        letterSpacing: 3,
        textTransform: 'uppercase',
        fontWeight: 'bold',
    },
});
