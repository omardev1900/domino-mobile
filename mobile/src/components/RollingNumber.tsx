import React, { useEffect, useState } from 'react';
import { Text, TextProps } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedProps,
    withTiming,
    Easing,
    runOnJS
} from 'react-native-reanimated';

interface RollingNumberProps extends TextProps {
    value: number;
    prefix?: string;
    suffix?: string;
    duration?: number;
}

export default function RollingNumber({ value, prefix = '', suffix = '', duration = 1500, style, ...textProps }: RollingNumberProps) {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        if (value === 0) {
            setDisplayValue(0);
            return;
        }

        let startTimestamp: number | null = null;
        let animationFrameId: number;

        const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            
            // Linear progression
            setDisplayValue(Math.floor(progress * value));

            if (progress < 1) {
                animationFrameId = requestAnimationFrame(step);
            } else {
                setDisplayValue(value);
            }
        };

        animationFrameId = requestAnimationFrame(step);

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [value, duration]);

    // Formate la valeur avec séparateur de milliers
    const formattedValue = displayValue.toLocaleString();

    return (
        <Text style={style} {...textProps}>
            {prefix}{formattedValue}{suffix}
        </Text>
    );
}
