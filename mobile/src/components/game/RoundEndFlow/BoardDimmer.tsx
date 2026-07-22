import React, { useEffect } from 'react';
import Animated, { withTiming, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { StyleSheet } from 'react-native';

interface BoardDimmerProps {
    visible: boolean;
}

export const BoardDimmer: React.FC<BoardDimmerProps> = ({ visible }) => {
    const opacity = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            opacity.value = withTiming(0.45, { duration: 400 });
        } else {
            opacity.value = withTiming(0, { duration: 300 });
        }
    }, [visible]);

    const style = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    return (
        <Animated.View
            style={[StyleSheet.absoluteFillObject, styles.dimmer, style]}
            pointerEvents="none"
        />
    );
};

const styles = StyleSheet.create({
    dimmer: {
        backgroundColor: '#000000',
        zIndex: 1400, // Just below the rest of the flow
    },
});
