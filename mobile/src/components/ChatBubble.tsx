import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    runOnJS,
    FadeIn,
    ZoomIn
} from 'react-native-reanimated';

interface ChatBubbleProps {
    content: string;
    position?: 'top' | 'bottom'; // NEW: Direction relative to avatar
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ content, position = 'top' }) => {
    const translateY = useSharedValue(0);
    const opacity = useSharedValue(0);

    const isBottom = position === 'bottom';

    useEffect(() => {
        // Entry animation: -25 for top (up), +25 for bottom (down)
        translateY.value = withSpring(isBottom ? 25 : -25);
        opacity.value = withTiming(1, { duration: 300 });

        return () => {
            // No-op cleanup
        };
    }, [content, isBottom]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
        opacity: opacity.value,
    }));

    const isEmoji = content ? /[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(content) || content.length <= 2 : false;

    return (
        <Animated.View
            style={[
                styles.container,
                isBottom ? styles.containerBottom : styles.containerTop,
                animatedStyle
            ]}
            pointerEvents="none"
        >
            <Text style={[styles.text, isEmoji ? styles.emojiText : styles.messageText]}>
                {content}
            </Text>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        alignSelf: 'center',
        backgroundColor: 'transparent',
        zIndex: 1000,
    },
    containerTop: {
        top: -10, // Initial position, animated to -25
    },
    containerBottom: {
        bottom: -10, // Initial position, animated to +25
    },
    text: {
        fontWeight: 'bold',
        color: 'white',
        textAlign: 'center',
        textShadowColor: 'rgba(0, 0, 0, 0.9)',
        textShadowOffset: { width: 2, height: 2 },
        textShadowRadius: 10,
    },
    messageText: {
        fontSize: 18,
    },
    emojiText: {
        fontSize: 30,
    },
});
