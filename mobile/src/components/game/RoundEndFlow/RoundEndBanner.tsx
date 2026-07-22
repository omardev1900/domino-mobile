import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { ZoomIn, ZoomOut, useReducedMotion } from 'react-native-reanimated';

interface RoundEndBannerProps {
    isBoude: boolean;
    visible: boolean;
}

export const RoundEndBanner: React.FC<RoundEndBannerProps> = ({ isBoude, visible }) => {
    const reducedMotion = useReducedMotion();

    if (!visible) return null;

    const text = isBoude ? 'PARTIE BLOQUÉE' : 'FIN DU ROUND';
    const color = isBoude ? '#FF8C00' : '#FFD700';

    return (
        <Animated.View
            entering={reducedMotion ? undefined : ZoomIn.duration(350).springify()}
            exiting={reducedMotion ? undefined : ZoomOut.duration(200)}
            style={styles.container}
            pointerEvents="none"
        >
            <View style={[styles.banner, { borderColor: color, shadowColor: color }]}>
                <Text style={[styles.text, { color }]}>{text}</Text>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: '30%',
        alignSelf: 'center',
        zIndex: 1450,
    },
    banner: {
        backgroundColor: 'rgba(0,0,0,0.85)',
        paddingHorizontal: 40,
        paddingVertical: 15,
        borderRadius: 30,
        borderWidth: 2,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 15,
        elevation: 10,
    },
    text: {
        fontSize: 26,
        fontWeight: '900',
        letterSpacing: 2,
        textTransform: 'uppercase',
    },
});
