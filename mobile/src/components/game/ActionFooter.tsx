import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { EdgeInsets } from 'react-native-safe-area-context';
import { PlayerHand, HandSortMode } from '../PlayerHand';
import { Player, GameState, Domino } from '../../core/types';
import { SkinConfig } from '../../core/store.types';

export interface ActionFooterProps {
    localPlayer: Player | null;
    gameState: GameState | null;
    localPlayerId: string;
    bannerState: 'NONE' | 'MANCHE' | 'ROUND';
    forcedOpeningDominoId: string | null;
    insets: EdgeInsets;
    onPlayDomino: (domino: Domino, position?: { x: number, y: number }) => void;
    // Extra Action Buttons requested
    canPassTurn?: boolean;
    onPassTurn?: () => void;
    showSideSelection?: boolean;
    onSelectSide?: (side: 'left' | 'right') => void;
    isPaused?: boolean;
    skinConfig?: SkinConfig; // Cosmetic skin configuration
    handSortMode?: HandSortMode;
    hiddenDominoId?: string | null;
    preservePlayableHighlights?: boolean;
    preservedPlayableDominoIds?: string[];
}

export const ActionFooter: React.FC<ActionFooterProps> = ({
    localPlayer,
    gameState,
    localPlayerId,
    bannerState,
    forcedOpeningDominoId,
    insets,
    onPlayDomino,
    canPassTurn = false,
    onPassTurn,
    showSideSelection = false,
    onSelectSide,
    isPaused = false,
    skinConfig,
    handSortMode = 'AUTO',
    hiddenDominoId = null,
    preservePlayableHighlights = false,
    preservedPlayableDominoIds = [],
}) => {
    if (!gameState || !localPlayer) return null;

    const isMyTurn = gameState.currentPlayerId === localPlayerId;
    const isPlaying = gameState.phase === 'PLAYING';
    // ✅ RADICAL FIX: La main est active si c'est mon tour et la phase est PLAYING.
    // Plus de dépendance à isHardLocked — nouveau turnId = nouvelle main cliquable.
    const isHandDisabled = !isMyTurn || !isPlaying || bannerState !== 'NONE' || isPaused;

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]} pointerEvents={isPaused ? 'none' : 'box-none'} testID="action-footer">

            {/* ACTION BUTTONS LAYER (Pass / Select Side) */}
            <View style={styles.actionButtonsContainer} pointerEvents="box-none">
                {canPassTurn && (
                    <TouchableOpacity
                        style={styles.passButton}
                        onPress={onPassTurn}
                        testID="btn-pass-turn"
                    >
                        <Text style={styles.passButtonText}>PASSER MON TOUR</Text>
                    </TouchableOpacity>
                )}

                {showSideSelection && (
                    <View style={styles.sideSelectionContainer} pointerEvents="box-none">
                        <TouchableOpacity
                            style={[styles.sideButton, styles.sideButtonLeft]}
                            onPress={() => onSelectSide?.('left')}
                            testID="btn-select-left"
                        >
                            <Text style={styles.sideButtonText}>JOUER À GAUCHE</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.sideButton, styles.sideButtonRight]}
                            onPress={() => onSelectSide?.('right')}
                            testID="btn-select-right"
                        >
                            <Text style={styles.sideButtonText}>JOUER À DROITE</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* PLAYER HAND */}
            <PlayerHand
                hand={localPlayer.hand}
                onPlayDomino={onPlayDomino}
                disabled={isHandDisabled}
                isLocked={isHandDisabled}
                leftValue={gameState.table.leftValue as any}
                rightValue={gameState.table.rightValue as any}
                forcedPlayableDominoId={forcedOpeningDominoId}
                skinConfig={skinConfig}
                sortMode={handSortMode}
                hiddenDominoId={hiddenDominoId}
                preservePlayableHighlights={preservePlayableHighlights}
                preservedPlayableDominoIds={preservedPlayableDominoIds}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
    },
    actionButtonsContainer: {
        alignItems: 'center',
        paddingBottom: 25, // ++ increased from 20
    },
    passButton: {
        backgroundColor: '#c0392b',
        paddingHorizontal: 25,
        paddingVertical: 10,
        borderRadius: 25,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 5,
        marginBottom: 15, // ++ increased from 10
    },
    passButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
        textTransform: 'uppercase',
    },
    sideSelectionContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: '20%',
        marginBottom: 20, // ++ increased from 10 to give more space from system nav
    },
    sideButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 25,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 5,
    },
    sideButtonLeft: {
        backgroundColor: '#2980b9',
    },
    sideButtonRight: {
        backgroundColor: '#27ae60',
    },
    sideButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    }
});
