import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MultiResumeInfo } from '../hooks/useMultiResume';
import SoundManager from '../core/audio/SoundManager';
import { Ionicons } from '@expo/vector-icons';

interface MultiResumeModalProps {
    resumeInfo: MultiResumeInfo;
    onResume: () => void;
    onAbandon: () => void;
}

export function MultiResumeModal({ resumeInfo, onResume, onAbandon }: MultiResumeModalProps) {
    const [isAbandoning, setIsAbandoning] = useState(false);
    const [isResuming, setIsResuming] = useState(false);

    const handleResume = () => {
        SoundManager.playSound('notify');
        setIsResuming(true);
        onResume();
    };

    const handleAbandon = async () => {
        SoundManager.playSound('notify');
        setIsAbandoning(true);
        await onAbandon();
    };

    return (
        <Modal
            transparent
            visible
            animationType="fade"
            onRequestClose={() => {}}
        >
            <View style={styles.overlay}>
                <LinearGradient
                    colors={['#2A1A4A', '#1A0E2E']}
                    style={styles.card}
                >
                    <View style={styles.header}>
                        <View style={styles.iconContainer}>
                            <Ionicons name="people" size={24} color="#FFD700" />
                        </View>
                        <Text style={styles.title}>Partie en cours</Text>
                    </View>

                    <Text style={styles.text}>
                        Vous avez une table multijoueur en attente ou en cours.
                    </Text>

                    {resumeInfo.status === 'PLAYING' && (
                        <View style={styles.warningBox}>
                            <Ionicons name="warning" size={16} color="#E74C3C" />
                            <Text style={styles.warningText}>
                                Vous avez quitté une partie en cours ! Vous devez la rejoindre pour éviter une pénalité et la perte de votre mise (100 coins).
                            </Text>
                        </View>
                    )}

                    <View style={styles.buttonRow}>
                        <TouchableOpacity 
                            onPress={handleAbandon} 
                            style={styles.abandonButton}
                            disabled={isAbandoning || isResuming}
                        >
                            {isAbandoning ? (
                                <ActivityIndicator color="#E74C3C" />
                            ) : (
                                <Text style={styles.abandonText}>
                                    {resumeInfo.status === 'PLAYING' ? 'Quitter' : 'Ignorer'}
                                </Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={handleResume} 
                            style={styles.resumeButton}
                            disabled={isAbandoning || isResuming}
                        >
                            <LinearGradient
                                colors={['#FFD700', '#FFA500']}
                                style={styles.resumeGradient}
                            >
                                {isResuming ? (
                                    <ActivityIndicator color="#1a0505" />
                                ) : (
                                    <Text style={styles.resumeText}>Rejoindre</Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        zIndex: 100000,
        elevation: 100000,
    },
    card: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.3)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,215,0,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.3)',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFD700',
    },
    text: {
        fontSize: 16,
        color: '#FFF',
        lineHeight: 22,
        marginBottom: 20,
    },
    warningBox: {
        flexDirection: 'row',
        backgroundColor: 'rgba(231, 76, 60, 0.1)',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(231, 76, 60, 0.3)',
        marginBottom: 20,
        alignItems: 'flex-start',
    },
    warningText: {
        color: '#E74C3C',
        fontSize: 13,
        marginLeft: 8,
        flex: 1,
        lineHeight: 18,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
    },
    abandonButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    abandonText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 15,
        fontWeight: '600',
    },
    resumeButton: {
        flex: 1,
        borderRadius: 12,
        overflow: 'hidden',
    },
    resumeGradient: {
        paddingVertical: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    resumeText: {
        color: '#1a0505',
        fontSize: 15,
        fontWeight: 'bold',
    },
});
