import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Circle } from 'react-native-svg';

export type LeagueFrameId =
    | 'frame_apprenti_1' | 'frame_apprenti_2' | 'frame_apprenti_3'
    | 'frame_maitre_1'   | 'frame_maitre_2'   | 'frame_maitre_3'
    | 'frame_roi'
    | 'frame_legende';

interface AvatarFrameProps {
    frameId?: LeagueFrameId | string | null;
    size: number;
}

export const AvatarFrame: React.FC<AvatarFrameProps> = ({ frameId, size }) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (frameId === 'frame_roi' || frameId === 'frame_legende') {
            // Pulsing effect for high-tier frames
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.05,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    })
                ])
            ).start();

            // Rotation effect for fire
            if (frameId === 'frame_legende') {
                Animated.loop(
                    Animated.timing(rotateAnim, {
                        toValue: 1,
                        duration: 3000,
                        useNativeDriver: true,
                    })
                ).start();
            }
        } else {
            pulseAnim.setValue(1);
            rotateAnim.setValue(0);
        }
    }, [frameId, pulseAnim, rotateAnim]);

    if (!frameId) return null;

    const strokeWidth = size * 0.08;
    const padding = strokeWidth / 2; // Expand container to prevent clipping
    const containerSize = size + padding * 2;
    const center = containerSize / 2;
    const radius = size / 2;

    const spin = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    const getColors = () => {
        switch (frameId) {
            case 'frame_apprenti_1': return ['#C8C8C8', '#E8E8E8', '#C0C0C0'];
            case 'frame_apprenti_2': return ['#909090', '#B0B0B0', '#707070'];
            case 'frame_apprenti_3': return ['#505050', '#707070', '#303030'];
            case 'frame_maitre_1':   return ['#FFE066', '#FFF3A0', '#FFD700'];
            case 'frame_maitre_2':   return ['#FFD700', '#FFF8DC', '#FFA500'];
            case 'frame_maitre_3':   return ['#B8860B', '#DAA520', '#8B6914'];
            case 'frame_roi':        return ['#3A86FF', '#74B9FF', '#2172E8'];
            case 'frame_legende':    return ['#DC143C', '#FF4500', '#FFD700', '#DC143C'];
            default: return null;
        }
    };

    const colors = getColors();
    if (!colors) return null;

    return (
        <View style={[StyleSheet.absoluteFillObject, { justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }]}>
            <Animated.View style={{
                width: containerSize,
                height: containerSize,
                transform: [
                    { scale: pulseAnim },
                    { rotate: frameId === 'frame_legende' ? spin : '0deg' }
                ]
            }}>
                <Svg width={containerSize} height={containerSize}>
                    <Defs>
                        <LinearGradient id={`grad-${frameId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                            {colors.map((color, index) => (
                                <Stop key={index} offset={`${(index / (colors.length - 1)) * 100}%`} stopColor={color} />
                            ))}
                        </LinearGradient>
                    </Defs>
                    <Circle
                        cx={center}
                        cy={center}
                        r={radius}
                        stroke={`url(#grad-${frameId})`}
                        strokeWidth={strokeWidth}
                        fill="none"
                    />
                </Svg>
            </Animated.View>
        </View>
    );
};
