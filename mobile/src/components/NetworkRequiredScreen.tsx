import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import SoundManager from '../core/audio/SoundManager';

interface NetworkRequiredScreenProps {
    onRetry: () => void;
    isChecking?: boolean;
}

export function NetworkRequiredScreen({ onRetry, isChecking = false }: NetworkRequiredScreenProps) {
    const { height } = useWindowDimensions();

    const handlePressRetry = () => {
        SoundManager.playSfx('click');
        if (typeof onRetry === 'function') {
            onRetry();
        }
    };

    return (
        <LinearGradient
            colors={['#2D1B4E', '#1A0E2E']}
            style={[styles.container, { minHeight: height }]}
        >
            <View style={styles.card}>
                {/* Icône de statut réseau */}
                <View style={styles.iconContainer}>
                    <Ionicons name="wifi-outline" size={72} color="#FFD700" />
                    <View style={styles.slashOverlay}>
                        <View style={styles.slash} />
                    </View>
                </View>

                {/* Titre */}
                <Text style={styles.title}>Connexion requise</Text>

                {/* Description */}
                <Text style={styles.description}>
                    Domino Martiniquais nécessite une connexion Internet active pour fonctionner, y compris en mode Solo.
                </Text>
                <Text style={styles.subDescription}>
                    Cela permet de sécuriser vos gains de Coins, de recalculer votre Grade dans la Ligue des Cochons et de sauvegarder vos statistiques.
                </Text>

                {/* Bouton Réessayer */}
                <TouchableOpacity
                    onPress={handlePressRetry}
                    disabled={isChecking}
                    activeOpacity={0.8}
                    style={[styles.button, isChecking && styles.buttonDisabled]}
                >
                    <LinearGradient
                        colors={['#FFE566', '#FFD700', '#FFA500']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.buttonGradient}
                    >
                        {isChecking ? (
                            <ActivityIndicator color="#1a0505" size="small" />
                        ) : (
                            <View style={styles.buttonContent}>
                                <Ionicons name="refresh" size={20} color="#1a0505" style={styles.buttonIcon} />
                                <Text style={styles.buttonText}>Réessayer</Text>
                            </View>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    card: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: 'rgba(26, 14, 46, 0.72)',
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 215, 0, 0.18)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 10,
    },
    iconContainer: {
        position: 'relative',
        marginBottom: 24,
        width: 100,
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    slashOverlay: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        transform: [{ rotate: '-45deg' }],
    },
    slash: {
        width: 6,
        height: 80,
        backgroundColor: '#E74C3C',
        borderRadius: 3,
        borderWidth: 2,
        borderColor: '#1A0E2E',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFD700',
        marginBottom: 16,
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    description: {
        fontSize: 16,
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 12,
        lineHeight: 22,
        fontWeight: '600',
    },
    subDescription: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.65)',
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 18,
    },
    button: {
        width: '100%',
        borderRadius: 28,
        overflow: 'hidden',
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 6,
    },
    buttonDisabled: {
        opacity: 0.6,
        shadowOpacity: 0,
        elevation: 0,
    },
    buttonGradient: {
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 28,
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonIcon: {
        marginRight: 8,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a0505',
        letterSpacing: 1,
    },
});
