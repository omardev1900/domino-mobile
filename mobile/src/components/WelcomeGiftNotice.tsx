import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type WelcomeGiftStatus =
    | { kind: 'pending' }
    | { kind: 'retry' }
    | { kind: 'credited'; amount: number };

interface WelcomeGiftNoticeProps {
    status: WelcomeGiftStatus;
    onRetry: () => void;
    onClose: () => void;
}

export function WelcomeGiftNotice({ status, onRetry, onClose }: WelcomeGiftNoticeProps) {
    const message = status.kind === 'credited'
        ? `Cadeau de bienvenue : ${status.amount} pièces reçues.`
        : status.kind === 'retry'
            ? 'Cadeau de bienvenue temporairement indisponible.'
            : 'Crédit du cadeau de bienvenue en cours…';

    return (
        <View style={styles.notice}>
            <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>
            {status.kind !== 'pending' && (
                <TouchableOpacity
                    accessibilityRole="button"
                    onPress={status.kind === 'retry' ? onRetry : onClose}
                    style={styles.action}
                >
                    <Text style={styles.actionLabel}>{status.kind === 'retry' ? 'Réessayer' : 'Fermer'}</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    notice: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 10,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: '#3C2956',
    },
    message: { flex: 1, color: '#FFFFFF', paddingVertical: 8 },
    action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
    actionLabel: { color: '#FFD700', fontWeight: '700' },
});
