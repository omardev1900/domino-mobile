import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface DailyGiftInfoModalProps {
    visible: boolean;
    amount: number;
    onClose: () => void;
}

export function DailyGiftInfoModal({ visible, amount, onClose }: DailyGiftInfoModalProps) {
    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <LinearGradient colors={['#2A1B3D', '#1A0B2E']} style={styles.card}>
                    <Text style={styles.icon} accessibilityElementsHidden>🎁</Text>
                    <Text style={styles.title}>CADEAU DU JOUR</Text>
                    <Text style={styles.message}>
                        Vous avez reçu <Text style={styles.amount}>{amount} coins</Text>
                    </Text>
                    <Text style={styles.confirmation}>Ils ont été ajoutés à votre solde.</Text>

                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Fermer le cadeau du jour"
                        activeOpacity={0.85}
                        onPress={onClose}
                        style={styles.button}
                    >
                        <LinearGradient colors={['#FFD700', '#FFA500']} style={styles.buttonGradient}>
                            <Text style={styles.buttonText}>SUPER !</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <Text style={styles.nextGift}>Prochain cadeau dans 24 heures</Text>
                </LinearGradient>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: 'rgba(0, 0, 0, 0.88)',
    },
    card: {
        width: '100%',
        maxWidth: 420,
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 28,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: '#FFD700',
    },
    icon: {
        marginBottom: 12,
        fontSize: 54,
    },
    title: {
        color: '#FFD700',
        fontSize: 22,
        fontWeight: '900',
        letterSpacing: 1.5,
        textAlign: 'center',
    },
    message: {
        marginTop: 18,
        color: '#FFFFFF',
        fontSize: 19,
        fontWeight: '700',
        lineHeight: 27,
        textAlign: 'center',
    },
    amount: {
        color: '#FFD700',
        fontWeight: '900',
    },
    confirmation: {
        marginTop: 6,
        color: 'rgba(255, 255, 255, 0.72)',
        fontSize: 14,
        textAlign: 'center',
    },
    button: {
        width: '100%',
        marginTop: 24,
        borderRadius: 14,
        overflow: 'hidden',
    },
    buttonGradient: {
        alignItems: 'center',
        paddingVertical: 13,
    },
    buttonText: {
        color: '#1A0B2E',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 1,
    },
    nextGift: {
        marginTop: 18,
        color: 'rgba(255, 255, 255, 0.65)',
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
    },
});
