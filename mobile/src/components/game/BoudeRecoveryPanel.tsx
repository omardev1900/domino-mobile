import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface BoudeRecoveryPanelProps {
    visible: boolean;
    isRetrying: boolean;
    onRetry: () => void;
    onExit: () => void;
}

export const BoudeRecoveryPanel: React.FC<BoudeRecoveryPanelProps> = ({
    visible,
    isRetrying,
    onRetry,
    onExit,
}) => {
    if (!visible) return null;

    return (
        <View style={styles.backdrop} accessibilityViewIsModal>
            <View style={styles.card}>
                <Text style={styles.icon}>⚠️</Text>
                <Text style={styles.title}>Impossible de continuer automatiquement</Text>
                <Text style={styles.message}>
                    La partie est toujours sauvegardée. Vous pouvez réessayer ou revenir à l’accueil et la reprendre plus tard.
                </Text>
                <View style={styles.actions}>
                    <TouchableOpacity
                        accessibilityRole="button"
                        disabled={isRetrying}
                        onPress={onRetry}
                        style={[styles.button, styles.retryButton, isRetrying && styles.disabledButton]}
                    >
                        {isRetrying ? (
                            <ActivityIndicator color="#241507" />
                        ) : (
                            <Text style={styles.retryText}>Réessayer</Text>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        accessibilityRole="button"
                        onPress={onExit}
                        style={[styles.button, styles.exitButton]}
                    >
                        <Text style={styles.exitText}>Quitter et reprendre plus tard</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        backgroundColor: 'rgba(5, 3, 12, 0.9)',
        elevation: 2000,
        justifyContent: 'center',
        padding: 24,
        zIndex: 2000,
    },
    card: {
        alignItems: 'center',
        backgroundColor: '#211631',
        borderColor: '#FFB74D',
        borderRadius: 24,
        borderWidth: 2,
        maxWidth: 520,
        padding: 24,
        width: '100%',
    },
    icon: { fontSize: 44 },
    title: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: '900',
        marginTop: 8,
        textAlign: 'center',
    },
    message: {
        color: 'rgba(255,255,255,0.82)',
        fontSize: 15,
        lineHeight: 21,
        marginTop: 12,
        textAlign: 'center',
    },
    actions: { gap: 10, marginTop: 22, width: '100%' },
    button: {
        alignItems: 'center',
        borderRadius: 14,
        justifyContent: 'center',
        minHeight: 48,
        paddingHorizontal: 16,
    },
    retryButton: { backgroundColor: '#FFB74D' },
    exitButton: { borderColor: 'rgba(255,255,255,0.4)', borderWidth: 1 },
    disabledButton: { opacity: 0.65 },
    retryText: { color: '#241507', fontSize: 16, fontWeight: '900' },
    exitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', textAlign: 'center' },
});
