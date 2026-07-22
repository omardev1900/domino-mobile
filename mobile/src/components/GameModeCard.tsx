import React, { useRef } from 'react';
import { 
    View, 
    Text, 
    TouchableOpacity, 
    StyleSheet, 
    Animated as RNAnimated
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';

interface GameModeCardProps {
    id: string;
    title: string;
    description: string;
    icon: string;
    colors: [string, string, ...string[]];
    onPress: () => void;
    delay?: number;
    compact?: boolean; // Keep for compatibility if used, though spec doesn't explicitly need it
}

export const GameModeCard: React.FC<GameModeCardProps> = ({
    title,
    description,
    icon,
    colors,
    onPress,
    delay = 0,
}) => {
    const scaleAnim = useRef(new RNAnimated.Value(1)).current;

    const handlePressIn = () => RNAnimated.spring(scaleAnim, {
        toValue: 0.97,
        useNativeDriver: true,
        speed: 50,
    }).start();

    const handlePressOut = () => RNAnimated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 50,
    }).start();

    return (
        <Animated.View 
            entering={FadeInUp.delay(delay).duration(400)}
            style={styles.wrapper}
        >
            <RNAnimated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    onPress={onPress}
                >
                    <LinearGradient 
                        colors={colors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.card}
                    >
                        <Text style={styles.icon}>{icon}</Text>
                        <Text style={styles.title}>{title}</Text>
                        <Text style={styles.description} numberOfLines={2}>
                            {description}
                        </Text>
                    </LinearGradient>
                </TouchableOpacity>
            </RNAnimated.View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
    },
    card: {
        borderRadius: 16,
        padding: 14,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
    },
    icon: {
        fontSize: 36,
        marginBottom: 12,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 6,
    },
    description: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.85)',
        textAlign: 'center',
        lineHeight: 18,
        maxWidth: '100%',
    },
});

