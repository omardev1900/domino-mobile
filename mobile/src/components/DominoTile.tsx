import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeIn, ZoomIn, useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, interpolateColor } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { DominoSide } from '../core/types';
import HapticManager from '../core/audio/HapticManager';
import { SkinConfig } from '../core/store.types';

interface DominoTileProps {
    left: DominoSide;
    right: DominoSide;
    size?: number; // Width of the tile (height will be 2x)
    orientation?: 'vertical' | 'horizontal';
    onPress?: () => void;
    onPressInAction?: () => void;
    disabled?: boolean;
    entering?: any; // Reanimated entering prop
    noMargin?: boolean; // Remove margin for board tiles
    isPlayable?: boolean; // Should the tile glow?
    skinConfig?: SkinConfig; // Cosmetic skin configuration
    animateOnMount?: boolean;
    disablePressScale?: boolean;
}

// Logic for pip positions
const DOT_POSITIONS: Record<number, number[][]> = {
    0: [],
    1: [[0.5, 0.5]],
    2: [[0.28, 0.28], [0.72, 0.72]],
    3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
    4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
    5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
    6: [[0.28, 0.22], [0.28, 0.5], [0.28, 0.78], [0.72, 0.22], [0.72, 0.5], [0.72, 0.78]],
};

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export const DominoTile: React.FC<DominoTileProps> = ({
    left,
    right,
    size = 40,
    orientation = 'vertical',
    onPress,
    onPressInAction,
    disabled = false,
    entering,
    noMargin = false,
    isPlayable = false,
    skinConfig,
    animateOnMount = true,
    disablePressScale = false
}) => {
    const isVertical = orientation === 'vertical';
    const width = isVertical ? size : size * 2;
    const height = isVertical ? size * 2 : size;

    const glowValue = useSharedValue(0);
    const pressScale = useSharedValue(1);

    React.useEffect(() => {
        if (isPlayable) {
            glowValue.value = withRepeat(
                withSequence(
                    withTiming(1, { duration: 1000 }),
                    withTiming(0.4, { duration: 1000 })
                ),
                -1,
                true
            );
        } else {
            glowValue.value = 0;
        }
    }, [isPlayable]);

    // Apply skin aesthetics
    // Base defaults if no config is available
    let gradientColors = ['#f0e68c', '#eee8aa', '#bdb76b']; // Ivory
    const DEFAULT_PIP_COLOR = '#615e53ff'; // Couleur des points dominos
    let pipColor = DEFAULT_PIP_COLOR;
    let dividerColor = 'rgba(0,0,0,0.15)';

    if (skinConfig) {
        gradientColors = [
            skinConfig.dominoBackgroundColor,
            skinConfig.dominoBackgroundColor,
            skinConfig.dominoBackgroundColor
        ];
        // Normalise to lowercase to handle potential casing differences from Firestore
        const dotColor = skinConfig.dominoDotColor?.toLowerCase?.() ?? '';
        // If the skin uses pure black (legacy default), replace with our visible brown
        pipColor = (dotColor === '#000000' || dotColor === '#000') ? DEFAULT_PIP_COLOR : skinConfig.dominoDotColor;
        dividerColor = skinConfig.dominoLineColor;
    }

    const animatedGlowStyle = useAnimatedStyle(() => {
        return {
            shadowColor: '#FFD700',
            shadowOpacity: withTiming(isPlayable ? 1 : 0), // Max opacity
            shadowRadius: 15 + glowValue.value * 25, // Massive glow radius
            elevation: isPlayable ? 20 : 5, // Android elevation boost
            borderColor: interpolateColor(
                glowValue.value,
                [0, 1],
                ['transparent', '#FFD700']
            ),
            borderWidth: isPlayable ? 3 : 0,
            transform: [{ scale: pressScale.value }]
        };
    });

    const handlePressIn = () => {
        if (!disabled && (onPress || onPressInAction)) {
            if (!disablePressScale) {
                pressScale.value = withTiming(0.92, { duration: 100 });
            }
            HapticManager.triggerLightSelection();
            onPressInAction?.();
        }
    };

    const handlePressOut = () => {
        if (!disablePressScale) {
            pressScale.value = withTiming(1, { duration: 100 });
        }
    };

    const renderHalfSVG = (value: DominoSide, isSideHorizontal: boolean) => {
        let pips = [...DOT_POSITIONS[value]];

        // Special logic for 6: Rotate dots if horizontal (3 colonnes → 3 lignes)
        if (value === 6 && isSideHorizontal) {
            pips = [
                [0.22, 0.28], [0.5, 0.28], [0.78, 0.28],
                [0.22, 0.72], [0.5, 0.72], [0.78, 0.72]
            ];
        }

        const dotRadius = size * 0.09;
        return (
            <Svg width={size} height={size} viewBox="0 0 100 100">
                {pips.map(([x, y], idx) => (
                    <Circle
                        key={idx}
                        cx={x * 100}
                        cy={y * 100}
                        r={dotRadius * 2.4} // Taille des points dominos
                        fill={pipColor}
                    />
                ))}
            </Svg>
        );
    };

    return (
        <Animated.View entering={animateOnMount ? (entering || ZoomIn.duration(400)) : undefined} style={{ opacity: 1 }}>
            <AnimatedTouchableOpacity
                activeOpacity={0.9}
                onPress={onPress ? onPress : () => {}}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={disabled || (!onPress && !onPressInAction)}
                style={[
                    styles.baseContainer,
                    noMargin ? { margin: 0 } : { margin: 4 },
                    { width, height, flexDirection: isVertical ? 'column' : 'row' },
                    animatedGlowStyle,
                ]}
            >
                {/* Visual Background with native Linear Gradient (respecte le borderRadius du parent, pas de double antialiasing) */}
                <LinearGradient
                    colors={[gradientColors[0], gradientColors[1], gradientColors[2]] as const}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />


                {/* Left/Top Half */}
                <View style={styles.half}>
                    {renderHalfSVG(left, !isVertical)}
                </View>

                {/* Center Divider */}
                <View style={[
                    styles.divider,
                    isVertical
                        ? { width: size * 0.8, height: size * 0.05 }
                        : { width: size * 0.05, height: size * 0.8 }
                ]}>
                    <View style={[styles.dividerLine, { backgroundColor: dividerColor }]} />
                </View>

                {/* Right/Bottom Half */}
                <View style={styles.half}>
                    {renderHalfSVG(right, !isVertical)}
                </View>

                {/* Bevel Overlay for 3D look */}
                <View style={styles.bevelOverlay} pointerEvents="none" />
            </AnimatedTouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    baseContainer: {
        backgroundColor: '#eee8aa',
        borderRadius: 8,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        // Shadow for depth
        shadowColor: '#000',
        shadowOffset: { width: 4, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
        elevation: 10,
        borderWidth: 0,
    },
    half: {
        flex: 1,
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 2,
    },
    divider: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    dividerLine: {
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.15)',
        borderRadius: 1,
    },
    bevelOverlay: {
        ...StyleSheet.absoluteFillObject,
        borderWidth: 0,
        borderRadius: 8,
    },
});
