import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EdgeInsets } from 'react-native-safe-area-context';
import { GameState } from '../../core/types';

export interface GameHeaderProps {
    gameState: GameState | null;
    insets: EdgeInsets;
    onOpenOptions: () => void;
}

export const GameHeader: React.FC<GameHeaderProps> = ({
    gameState,
    insets,
    onOpenOptions,
}) => {
    // Visible en PLAYING, MANCHE_END et MATCH_END pour garantir un chemin de sortie en cas de blocage
    const visiblePhases = ['PLAYING', 'MANCHE_END', 'MATCH_END'];
    if (!gameState || !visiblePhases.includes(gameState.phase)) return null;

    return (
        <View style={[styles.unifiedHeader, { top: Math.max(insets.top, 10) }]} testID="game-header">

            {/* Bouton unique ⚙️ */}
            <TouchableOpacity
                onPress={onOpenOptions}
                activeOpacity={0.7}
                style={styles.optionsBtn}
                testID="btn-options"
            >
                <Ionicons name="settings-outline" size={22} color="#FFD700" />
            </TouchableOpacity>

        </View>
    );
};

const styles = StyleSheet.create({
    unifiedHeader: {
        position: 'absolute',
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        zIndex: 100,
        top: 10,
    },
    optionsBtn: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.3)',
    },
});
