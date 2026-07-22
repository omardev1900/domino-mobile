import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Animated from 'react-native-reanimated';
import { getAvatarImage, AvatarId } from '../../core/avatars';
import { GradeBadge } from '../GradeBadge';

export interface PlayerCardProps {
    playerId: string;
    playerName: string;
    avatarId: string | null;
    grade?: string;
    isWinner?: boolean;
    scoreText?: string;
    showCrown?: boolean;
    showWinBadge?: boolean;
    entering?: any; // Reanimated entry animation
    isLocalPlayer?: boolean; // If true, displays 'Moi' instead of name
}

export const PlayerCard: React.FC<PlayerCardProps> = ({
    playerId,
    playerName,
    avatarId,
    grade,
    isWinner = false,
    scoreText,
    showCrown = false,
    showWinBadge = false,
    entering,
    isLocalPlayer = false,
}) => {
    return (
        <Animated.View 
            entering={entering}
            style={[styles.podiumCard, isWinner && styles.podiumCardWinner]}
        >
            <View style={styles.podiumAvatarWrap}>
                <Image
                    source={getAvatarImage((avatarId as AvatarId) || 'avatar_default')}
                    style={[styles.podiumAvatar, isWinner && styles.podiumAvatarWinner]}
                    contentFit="cover"
                />
                {showCrown && <Text style={styles.crown}>👑</Text>}
            </View>
            <Text style={[styles.podiumName, isWinner && styles.podiumNameWinner]} numberOfLines={1}>
                {isLocalPlayer ? 'Moi' : playerName}
            </Text>
            {scoreText !== undefined && (
                <Text style={[styles.podiumScore, isWinner && styles.podiumScoreWinner]}>
                    {scoreText}
                </Text>
            )}
            
            <View style={styles.badgeContainer}>
                <GradeBadge grade={grade} size="xs" />
            </View>
            
            {showWinBadge && (
                <View style={styles.podiumWinBadge}>
                    <Text style={styles.podiumWinBadgeText}>CHAMPION</Text>
                </View>
            )}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    podiumCard: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        minHeight: 130,
        marginHorizontal: 4,
    },
    podiumCardWinner: {
        backgroundColor: 'rgba(255,215,0,0.11)',
        borderColor: '#FFD700',
        borderWidth: 2,
        minHeight: 155,
        elevation: 6,
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
    },
    podiumAvatarWrap: {
        position: 'relative',
        marginBottom: 8,
    },
    podiumAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.18)',
    },
    podiumAvatarWinner: {
        width: 58,
        height: 58,
        borderRadius: 29,
        borderColor: '#FFD700',
        borderWidth: 2.5,
    },
    crown: {
        position: 'absolute',
        top: -14,
        left: -10,
        fontSize: 22,
        transform: [{ rotate: '-15deg' }],
    },
    podiumName: {
        fontSize: 12,
        fontWeight: 'bold',
        color: 'rgba(255,255,255,0.65)',
        textAlign: 'center',
    },
    podiumNameWinner: {
        color: '#FFD700',
        fontSize: 14,
    },
    podiumScore: {
        fontSize: 15,
        fontWeight: '900',
        color: 'rgba(255,255,255,0.4)',
        marginTop: 5,
    },
    podiumScoreWinner: {
        color: '#FFD700',
        fontSize: 20,
    },
    badgeContainer: {
        marginTop: 6,
    },
    podiumWinBadge: {
        backgroundColor: '#FFD700',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 2,
        marginTop: 6,
    },
    podiumWinBadgeText: {
        color: '#000',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 1.2,
    },
});
