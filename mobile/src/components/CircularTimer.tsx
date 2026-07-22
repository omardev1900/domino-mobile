import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withTiming, Easing } from 'react-native-reanimated';

interface CircularTimerProps {
    duration: number; // in seconds
    isActive: boolean;
    onTimeout: () => void;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const CircularTimer: React.FC<CircularTimerProps> = ({ duration, isActive, onTimeout }) => {
    const [timeLeft, setTimeLeft] = useState(duration);
    const progress = useSharedValue(1);

    const size = 50;
    const strokeWidth = 4;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    useEffect(() => {
        if (isActive) {
            setTimeLeft(duration);
            progress.value = 1;
            progress.value = withTiming(0, {
                duration: duration * 1000,
                easing: Easing.linear,
            });

            const interval = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        onTimeout();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            return () => clearInterval(interval);
        } else {
            setTimeLeft(duration);
            progress.value = 1;
        }
    }, [isActive, duration]);

    const animatedProps = useAnimatedProps(() => ({
        strokeDashoffset: circumference * (1 - progress.value),
    }));

    const isLowTime = timeLeft <= 5;

    return (
        <View style={styles.container}>
            <Svg width={size} height={size} style={styles.svg}>
                {/* Background circle */}
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth={strokeWidth}
                    fill="none"
                />
                {/* Animated progress circle */}
                <AnimatedCircle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={isLowTime ? '#e74c3c' : '#2ecc71'}
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeDasharray={`${circumference} ${circumference}`}
                    animatedProps={animatedProps}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
            </Svg>
            <Text style={[styles.text, isLowTime && styles.textWarning]}>{timeLeft}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 50,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    svg: {
        position: 'absolute',
    },
    text: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    textWarning: {
        color: '#e74c3c',
    },
});
