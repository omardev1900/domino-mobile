import React, { useEffect, useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Player, Domino } from '../../../core/types';
import { DominoTile } from '../../DominoTile';
import RollingNumber from '../../RollingNumber';

interface PlayerRevealBlockProps {
    player: Player;
    position: 'top-left' | 'top-right' | 'bottom';
    phase: 'idle' | 'dimming' | 'reveal' | 'counting' | 'result';
    onCountComplete?: () => void;
    skipCounting?: boolean;
}

export const PlayerRevealBlock: React.FC<PlayerRevealBlockProps> = ({
    player,
    position,
    phase,
    onCountComplete,
    skipCounting
}) => {
    const reducedMotion = useReducedMotion();
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const isCompact = width < 430;
    
    const [currentScore, setCurrentScore] = useState(0);

    const handScore = player.hand.reduce((s, d) => s + d.left + d.right, 0);

    useEffect(() => {
        if (skipCounting) {
            setCurrentScore(handScore);
        } else if (phase === 'counting') {
            setCurrentScore(handScore);
            // Simulate count duration (Accélérée)
            const timer = setTimeout(() => {
                onCountComplete?.();
            }, 1200);
            return () => clearTimeout(timer);
        } else if (phase === 'idle' || phase === 'dimming') {
            setCurrentScore(0);
        }
    }, [phase, handScore, onCountComplete, skipCounting]);

    if (phase === 'idle' || phase === 'dimming') return null;

    const isTopRight = position === 'top-right';
    const isTopLeft = position === 'top-left';
    const isBottom = position === 'bottom';

    const dominoSize = isCompact ? 22 : 30;

    return (
        <View style={[
            styles.container,
            isTopRight && { top: 20, right: Math.max(insets.right + 10, 10) + 70, alignItems: 'flex-end' },
            isTopLeft && { top: 20, left: Math.max(insets.left + 10, 10) + 70, alignItems: 'flex-start' },
            isBottom && { bottom: Math.max(insets.bottom + 10, 20), left: Math.max(insets.left + 10, 10) + 110, alignItems: 'flex-start' },
        ]} pointerEvents="none">
            
            <View style={[
                styles.handRow,
                isTopRight && styles.handRowRight,
                isTopLeft && styles.handRowLeft,
                isBottom && styles.handRowLeft,
            ]}>
                {player.hand.map((d, i) => (
                    <Animated.View 
                        key={i} 
                        entering={reducedMotion ? undefined : FadeIn.delay(i * 150).duration(400)}
                    >
                        <DominoTile
                            left={d.left as any}
                            right={d.right as any}
                            size={dominoSize}
                            orientation="vertical"
                            disabled
                            noMargin
                        />
                    </Animated.View>
                ))}
            </View>

            {(phase === 'counting' || phase === 'result') && (
                <View style={styles.scoreContainer}>
                    <RollingNumber 
                        value={currentScore} 
                        style={styles.scoreText} 
                        duration={1200} 
                    />
                    <Animated.Text style={styles.ptsText}> pts</Animated.Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        zIndex: 1450,
        alignItems: 'center',
    },
    handRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        marginBottom: 8,
    },
    handRowRight: {
        justifyContent: 'flex-end',
    },
    handRowLeft: {
        justifyContent: 'flex-start',
    },

    scoreContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.4)',
    },
    scoreText: {
        color: '#FFD700',
        fontSize: 18,
        fontWeight: 'bold',
    },
    ptsText: {
        color: 'rgba(255,215,0,0.8)',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 2,
    },
});
