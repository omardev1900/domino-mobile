import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EdgeInsets } from 'react-native-safe-area-context';
import { GameState } from '../../core/types';
import { WebFullscreenButton } from '../WebFullscreenButton';

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
    const visiblePhases = ['DEALING', 'PLAYING', 'BOUDE', 'PARTIE_END', 'MANCHE_END', 'MATCH_END'];
    if (!gameState || !visiblePhases.includes(gameState.phase)) return null;

    return (
        <View style={[styles.unifiedHeader, { top: Math.max(insets.top, 10) }]} testID="game-header">
            <WebFullscreenButton
                style={styles.fullscreenBtn}
                size={22}
            />
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
    fullscreenBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderColor: 'rgba(255,215,0,0.3)',
    },
});
