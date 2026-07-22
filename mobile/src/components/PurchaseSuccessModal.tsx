import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Dimensions, TouchableOpacity } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSpring,
    withRepeat,
    withSequence,
    interpolate,
    Extrapolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface PurchaseSuccessModalProps {
    visible: boolean;
    itemName: string;
    onClose: () => void;
    onEquip?: () => void;
}

const Particle = ({ delay, index }: { delay: number; index: number }) => {
    const translateY = useSharedValue(0);
    const opacity = useSharedValue(0);
    const rotate = useSharedValue(0);

    useEffect(() => {
        // Drop and fade out animation
        translateY.value = withSequence(
            withTiming(0, { duration: 0 }),
            withTiming(-height * 0.4 + Math.random() * -100, { duration: 400 + delay }),
            withTiming(height, { duration: 2000 })
        );

        opacity.value = withSequence(
            withTiming(0, { duration: 0 }),
            withTiming(1, { duration: 200 + delay }),
            withTiming(0, { duration: 1500 })
        );

        rotate.value = withRepeat(
            withTiming(Math.random() * 360 * (index % 2 === 0 ? 1 : -1), { duration: 2000 }),
            -1,
            false
        );
    }, []);

    const style = useAnimatedStyle(() => ({
        transform: [
            { translateY: translateY.value },
            { rotate: `${rotate.value}deg` },
            { translateX: Math.sin(translateY.value / 50) * 50 }, // slight sway
        ],
        opacity: opacity.value,
        backgroundColor: index % 3 === 0 ? '#FFD700' : index % 2 === 0 ? '#FF6B6B' : '#4ECDC4',
    }));

    return <Animated.View style={[styles.particle, style, { left: (width / 20) * (index % 20) }]} />;
};

export const PurchaseSuccessModal: React.FC<PurchaseSuccessModalProps> = ({
    visible,
    itemName,
    onClose,
    onEquip,
}) => {
    const scale = useSharedValue(0);
    const glowOpacity = useSharedValue(0.5);

    useEffect(() => {
        if (visible) {
            scale.value = withSpring(1, { damping: 12, stiffness: 100 });
            glowOpacity.value = withRepeat(
                withSequence(
                    withTiming(1, { duration: 1000 }),
                    withTiming(0.5, { duration: 1000 })
                ),
                -1,
                true
            );
        } else {
            scale.value = withTiming(0, { duration: 200 });
            glowOpacity.value = 0;
        }
    }, [visible]);

    const containerStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const glowStyle = useAnimatedStyle(() => ({
        opacity: glowOpacity.value,
        transform: [{ scale: interpolate(glowOpacity.value, [0.5, 1], [1, 1.2], Extrapolate.CLAMP) }],
    }));

    if (!visible) return null;

    // Generate 30 particles
    const particles = Array.from({ length: 30 }).map((_, i) => (
        <Particle key={i} index={i} delay={Math.random() * 300} />
    ));

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={StyleSheet.absoluteFill}>
                    {particles}
                </View>

                <Animated.View style={[styles.glowContainer, glowStyle]}>
                    <View style={styles.glow} />
                </Animated.View>

                <Animated.View style={[styles.contentContainer, containerStyle]}>
                    <LinearGradient
                        colors={['#2A1B3D', '#1A0B2E']}
                        style={styles.card}
                    >
                        <View style={styles.iconContainer}>
                            <Ionicons name="gift" size={64} color="#FFD700" />
                        </View>

                        <Text style={styles.title}>ACHAT RÉUSSI !</Text>
                        <Text style={styles.subtitle}>Vous avez acquis :</Text>
                        <Text style={styles.itemName}>{itemName}</Text>

                        <View style={styles.buttonContainer}>
                            {onEquip && (
                                <TouchableOpacity style={styles.equipButton} onPress={onEquip}>
                                    <Text style={styles.equipButtonText}>UTILISER MAINTENANT</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                                <Text style={styles.closeButtonText}>FERMER</Text>
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    particle: {
        position: 'absolute',
        bottom: 0,
        width: 10,
        height: 10,
        borderRadius: 5,
        zIndex: 5,
    },
    glowContainer: {
        position: 'absolute',
        width: 300,
        height: 300,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    glow: {
        width: 250,
        height: 250,
        borderRadius: 125,
        backgroundColor: 'rgba(255, 215, 0, 0.3)',
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 50,
        elevation: 10,
    },
    contentContainer: {
        width: '85%',
        maxWidth: 400,
        zIndex: 10,
    },
    card: {
        borderRadius: 24,
        padding: 30,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFD700',
        overflow: 'hidden',
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255, 215, 0, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        color: '#FFD700',
        marginBottom: 10,
        textAlign: 'center',
        textShadowColor: 'rgba(255, 215, 0, 0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    subtitle: {
        fontSize: 16,
        color: '#A0A0A0',
        marginBottom: 5,
        textAlign: 'center',
    },
    itemName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 30,
        textAlign: 'center',
    },
    buttonContainer: {
        width: '100%',
        gap: 12,
    },
    equipButton: {
        backgroundColor: '#FFD700',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 5,
    },
    equipButtonText: {
        color: '#1A0B2E',
        fontSize: 16,
        fontWeight: 'bold',
    },
    closeButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    closeButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});
