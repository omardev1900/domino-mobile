import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
    FadeIn,
    FadeOut,
    ZoomIn,
    ZoomOut,
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withSequence,
    withTiming,
    interpolate,
    Extrapolate
} from 'react-native-reanimated';

interface GameAnnouncerProps {
    message: string;
    subMessage?: string;
    onFinished?: () => void;
    type?: 'COCHON' | 'CHIRE' | 'PARTIE_END' | 'BOUDE';
}

export const GameAnnouncer: React.FC<GameAnnouncerProps> = ({
    message,
    subMessage,
    onFinished,
    type = 'PARTIE_END'
}) => {
    const glow = useSharedValue(0);
    const isMajorEvent = ['COCHON', 'CHIRE', 'BOUDE'].includes(type);

    useEffect(() => {
        glow.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 500 }),
                withTiming(0.5, { duration: 500 })
            ),
            -1,
            true
        );

        const timer = setTimeout(() => {
            onFinished?.();
        }, 3000);

        return () => clearTimeout(timer);
    }, []);

    const glowStyle = useAnimatedStyle(() => {
        const shadowRadius = interpolate(glow.value, [0.5, 1], [10, 25], Extrapolate.CLAMP);
        const opacity = interpolate(glow.value, [0.5, 1], [0.6, 1], Extrapolate.CLAMP);

        return {
            textShadowColor: type === 'COCHON' ? '#FFD700' : type === 'CHIRE' ? '#FF4500' : '#FFF',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: shadowRadius,
            opacity: opacity,
        };
    });

    const getColors = () => {
        switch (type) {
            case 'COCHON': return ['#FFD700', '#FFA500'];
            case 'CHIRE': return ['#FF4500', '#FF0000'];
            case 'BOUDE': return ['#FF8C00', '#FF4500'];
            default: return ['#FFFFFF', '#BDBDBD'];
        }
    };

    const colors = getColors();

    return (
        <Animated.View
            entering={FadeIn.duration(400)}
            exiting={FadeOut.duration(400)}
            style={[
                styles.container,
                isMajorEvent && { backgroundColor: 'rgba(0,0,0,0.6)' }
            ]}
            pointerEvents="none"
        >
            <Animated.View
                entering={ZoomIn.duration(500).springify()}
                exiting={ZoomOut.duration(300)}
                style={styles.announcerBox}
            >
                <Animated.Text style={[
                    styles.mainText,
                    { color: colors[0] },
                    glowStyle
                ]}>
                    {message}
                </Animated.Text>
                {subMessage ? (
                    <Text style={styles.subText}>{subMessage}</Text>
                ) : null}
            </Animated.View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999, // Ensure it's above everything
    },
    announcerBox: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 30,
    },
    mainText: {
        fontSize: 72,
        fontWeight: '900',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 4,
    },
    subText: {
        fontSize: 24,
        color: '#FFF',
        fontWeight: 'bold',
        marginTop: 15,
        textTransform: 'uppercase',
        letterSpacing: 2,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
});

