import React from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Linking,
    Platform,
    Alert,
} from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { ForceUpdateInfo } from '../hooks/useForceUpdate';

interface ForceUpdateModalProps {
    info: ForceUpdateInfo;
}

export function ForceUpdateModal({ info }: ForceUpdateModalProps) {
    const handleUpdate = async () => {
        const marketUrl = 'market://details?id=com.dominomartinique.mobile';
        const fallbackUrl = info.updateUrl || 'https://play.google.com/store/apps/details?id=com.dominomartinique.mobile';

        try {
            const canOpenMarket = await Linking.canOpenURL(marketUrl);
            if (canOpenMarket) {
                await Linking.openURL(marketUrl);
            } else {
                await Linking.openURL(fallbackUrl);
            }
        } catch (err) {
            Alert.alert(
                "Mise à jour",
                "Impossible d'ouvrir le Play Store automatiquement. Vous pouvez le faire manuellement en cherchant 'Domino Martiniquais'."
            );
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.overlay}>
                <Animated.View
                    entering={FadeIn.duration(300)}
                    style={styles.backdrop}
                />
                <Animated.View
                    entering={ZoomIn.springify().damping(18).stiffness(220)}
                    style={styles.card}
                >
                    {/* Icône */}
                    <View style={styles.iconCircle}>
                        <Text style={styles.iconText}>🚀</Text>
                    </View>

                    {/* Titre */}
                    <Text style={styles.title}>Mise à jour requise</Text>

                    <Text style={styles.subtitle}>
                        {info.message || "Une nouvelle version de l'application est disponible. Veuillez mettre à jour pour continuer."}
                    </Text>

                    {/* Bouton de mise à jour */}
                    <TouchableOpacity
                        id="btn-force-update"
                        style={styles.updateBtn}
                        onPress={handleUpdate}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.updateBtnText}>Mettre à jour</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1A0E2E',
    },
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 28,
        zIndex: 9999,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#1A0E2E',
    },
    card: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#1E1140',
        borderRadius: 24,
        padding: 28,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FFD700',
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
        backgroundColor: 'rgba(255,215,0,0.15)',
        borderWidth: 2,
        borderColor: 'rgba(255,215,0,0.4)',
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
        color: '#FFD700',
        marginBottom: 12,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 28,
    },
    updateBtn: {
        width: '100%',
        backgroundColor: '#FFD700',
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
    },
    updateBtnText: {
        fontSize: 16,
        fontWeight: '900',
        color: '#1A0E2E',
    },
});
