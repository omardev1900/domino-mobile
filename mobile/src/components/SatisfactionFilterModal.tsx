import React from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Platform,
    TouchableWithoutFeedback
} from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import * as StoreReview from 'expo-store-review';

interface SatisfactionFilterModalProps {
    visible: boolean;
    onDismiss: () => void;
    onFeedback: () => void;
    onAnswered: () => void;
}

export function SatisfactionFilterModal({
    visible,
    onDismiss,
    onFeedback,
    onAnswered
}: SatisfactionFilterModalProps) {

    if (!visible) return null;

    const handleLoveIt = async () => {
        onAnswered();
        try {
            if (await StoreReview.hasAction()) {
                await StoreReview.requestReview();
            }
        } catch (e) {
            console.warn("StoreReview error", e);
        }
    };

    const handleOkay = () => {
        onAnswered();
        onFeedback();
    };

    const handleNotReally = () => {
        onAnswered();
        onFeedback();
    };

    return (
        <Modal
            transparent
            animationType="none"
            visible={visible}
            onRequestClose={onDismiss}
            statusBarTranslucent
        >
            <TouchableWithoutFeedback onPress={onDismiss}>
                <View style={styles.overlay}>
                    <Animated.View
                        entering={FadeIn.duration(300)}
                        style={styles.backdrop}
                    />
                    
                    <TouchableWithoutFeedback>
                        <Animated.View
                            entering={ZoomIn.springify().damping(18).stiffness(220)}
                            style={styles.card}
                        >
                            {/* Icône */}
                            <View style={styles.iconCircle}>
                                <Text style={styles.iconText}>🤔</Text>
                            </View>

                            {/* Titre */}
                            <Text style={styles.title}>Tu t'amuses bien ?</Text>

                            <Text style={styles.subtitle}>
                                Ton avis est super important pour nous aider à améliorer Domino Martiniquais !
                            </Text>

                            {/* Boutons */}
                            <View style={styles.buttonsContainer}>
                                <TouchableOpacity
                                    style={[styles.btn, styles.btnLove]}
                                    onPress={handleLoveIt}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.btnLoveText}>Oui, j'adore ! 😍</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.btn, styles.btnOkay]}
                                    onPress={handleOkay}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.btnText}>Euh, ça va 😕</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.btn, styles.btnBad]}
                                    onPress={handleNotReally}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.btnText}>Non, pas trop 😕</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Fermer (Plus tard) */}
                            <TouchableOpacity
                                style={styles.laterBtn}
                                onPress={onDismiss}
                            >
                                <Text style={styles.laterText}>Plus tard</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 28,
        zIndex: 9998,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(26, 14, 46, 0.85)',
    },
    card: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#1E1140',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#9E86FF',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.6,
                shadowRadius: 24,
            },
            android: { elevation: 20 },
        }),
    },
    iconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(158,134,255,0.15)',
        borderWidth: 2,
        borderColor: 'rgba(158,134,255,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    iconText: {
        fontSize: 32,
    },
    title: {
        fontSize: 22,
        fontWeight: '900',
        color: '#FFFFFF',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    buttonsContainer: {
        width: '100%',
        gap: 12,
    },
    btn: {
        width: '100%',
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
        borderWidth: 1,
    },
    btnLove: {
        backgroundColor: '#FFD700',
        borderColor: '#FFD700',
    },
    btnLoveText: {
        fontSize: 16,
        fontWeight: '900',
        color: '#1A0E2E',
    },
    btnOkay: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderColor: 'rgba(255,255,255,0.1)',
    },
    btnBad: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderColor: 'rgba(255,255,255,0.1)',
    },
    btnText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    laterBtn: {
        marginTop: 20,
        padding: 8,
    },
    laterText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.5)',
        fontWeight: '500',
    }
});
