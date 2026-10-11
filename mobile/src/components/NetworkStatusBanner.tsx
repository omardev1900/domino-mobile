import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StableNetworkStatus } from '../hooks/useStableNetworkStatus';

interface NetworkStatusBannerProps {
    status: StableNetworkStatus;
    onRetry: () => void;
}

/** A non-blocking network signal: gameplay state stays visible during recovery. */
export function NetworkStatusBanner({ status, onRetry }: NetworkStatusBannerProps) {
    if (status === 'online') return null;

    const isChecking = status === 'checking';
    return (
        <View pointerEvents="box-none" style={styles.container}>
            <View style={styles.banner}>
                {isChecking ? <ActivityIndicator color="#FFD700" size="small" /> : <Ionicons name="wifi-outline" color="#FFD700" size={20} />}
                <Text style={styles.text}>
                    {isChecking ? 'Verification de la connexion…' : 'Connexion perdue — reprise automatique en cours'}
                </Text>
                {!isChecking && (
                    <TouchableOpacity onPress={onRetry} style={styles.retry} accessibilityRole="button" accessibilityLabel="Reessayer la connexion">
                        <Text style={styles.retryText}>Reessayer</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { position: 'absolute', top: 14, left: 14, right: 14, alignItems: 'center', zIndex: 99999, elevation: 99999 },
    banner: { flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: 560, backgroundColor: 'rgba(26, 14, 46, 0.96)', borderColor: 'rgba(255, 215, 0, 0.45)', borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10 },
    text: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', flexShrink: 1 },
    retry: { backgroundColor: 'rgba(255, 215, 0, 0.18)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
    retryText: { color: '#FFD700', fontSize: 12, fontWeight: '800' },
});
