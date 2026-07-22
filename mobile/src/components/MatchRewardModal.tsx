import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, useWindowDimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, withSequence, withRepeat } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AdRewardButton } from './AdRewardButton';
import SoundManager from '../core/audio/SoundManager';
import { PremiumButton } from './common/PremiumButton';

interface MatchRewardModalProps {
    visible: boolean;
    amount: number;
    onClose: () => void;
    onClaim: () => void;
}

export const MatchRewardModal: React.FC<MatchRewardModalProps> = ({ visible, amount, onClose, onClaim }) => {
    const { width, height } = useWindowDimensions();

    const scale = useSharedValue(0);
    const glowOpacity = useSharedValue(0.5);

    useEffect(() => {
        if (visible) {
            SoundManager.playSound('notify');
            scale.value = withSpring(1, { damping: 12, stiffness: 100 });
            glowOpacity.value = withRepeat(
                withSequence(
                    withTiming(1, { duration: 900 }),
                    withTiming(0.4, { duration: 900 })
                ),
                -1,
                true
            );
        } else {
            scale.value = withTiming(0, { duration: 200 });
            glowOpacity.value = 0;
        }
    }, [visible]);

    const overlayStyle = useAnimatedStyle(() => ({
        opacity: withTiming(visible ? 1 : 0, { duration: 300 }),
    }));

    const cardStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="none">
            <Animated.View style={[styles.overlay, overlayStyle]}>
                <Animated.View style={[styles.cardContainer, cardStyle, { width: Math.min(width * 0.85, 400) }]}>
                    <LinearGradient
                        colors={['rgba(255, 215, 0, 0.15)', 'transparent']}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                    />
                    
                    <PremiumButton 
                        style={styles.closeBtn} 
                        onPress={onClose} 
                        soundName="notify"
                        hitSlop={{ top: 20, right: 20, bottom: 20, left: 20 }}
                    >
                        <Ionicons name="close" size={24} color="rgba(255,255,255,0.5)" />
                    </PremiumButton>

                    <View style={styles.iconContainer}>
                        <Text style={styles.icon}>📺</Text>
                    </View>
                    
                    <Text style={styles.title}>Bonus Fin de Partie</Text>
                    <Text style={styles.subtitle}>Clique sur la pub pour gagner {amount} pièces !</Text>
                    
                    <View style={styles.btnWrap}>
                        <AdRewardButton
                            coinsAmount={amount}
                            onClaim={async () => {
                                SoundManager.playSound('win');
                                await onClaim();
                                setTimeout(onClose, 2000); // Ferme automatiquement après l'animation de succès
                            }}
                            enterDelay={0}
                            variant="prominent"
                        />
                    </View>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    cardContainer: {
        backgroundColor: '#1E1B2A',
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 215, 0, 0.3)',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
        elevation: 10,
    },
    closeBtn: {
        position: 'absolute',
        top: 8,
        right: 8,
        padding: 16,
        zIndex: 10,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255, 215, 0, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        borderWidth: 2,
        borderColor: 'rgba(255, 215, 0, 0.4)',
    },
    icon: {
        fontSize: 32,
    },
    title: {
        color: '#FFD700',
        fontSize: 18,
        fontWeight: '900',
        marginBottom: 4,
        textAlign: 'center',
    },
    subtitle: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 16,
        lineHeight: 18,
    },
    btnWrap: {
        width: '100%',
    }
});
