/**
 * AdRewardButton.tsx
 *
 * ╔══════════════════════════════════════════════════════╗
 * ║  Bouton réutilisable "Voir une pub → +X coins"      ║
 * ║  • Un seul clic par montage (guard interne)         ║
 * ║  • Affiche un message de confirmation après         ║
 * ║  • Entièrement piloté par les props (stateless)     ║
 * ║  • Compatible avec tous les placements de l'app     ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * Usage :
 *   <AdRewardButton
 *     coinsAmount={100}
 *     onClaim={async () => { await economyService.creditAdReward(userId); }}
 *   />
 */

import React, { useState } from 'react';
import { TouchableOpacity, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRewardedAd, TestIds, AdMobIds } from '../core/services/AdMobAdapter';
import { Platform, Alert } from 'react-native';

export interface AdRewardButtonProps {
    /** Montant crédité après la pub (affiché dans le bouton). */
    coinsAmount: number;
    /**
     * Callback appelé quand l'utilisateur clique.
     * Peut être async — le bouton passe en état "chargement" pendant l'exécution.
     */
    onClaim: () => void | Promise<void>;
    /** Libellé principal du bouton (défaut : "Voir une pub"). */
    label?: string;
    /** Désactive le bouton sans l'appel onClaim (ex: déjà utilisé dans la session). */
    disabled?: boolean;
    /** Variante visuelle : 'default' (fond sombre) | 'prominent' (fond doré). */
    variant?: 'default' | 'prominent';
    /** Délai d'entrée pour l'animation (ms). Défaut : 0. */
    enterDelay?: number;
}

export const AdRewardButton: React.FC<AdRewardButtonProps> = ({
    coinsAmount,
    onClaim,
    label = 'Voir une pub',
    disabled = false,
    variant = 'default',
    enterDelay = 0,
}) => {
    const [claimed, setClaimed] = useState(false);
    const [loading, setLoading] = useState(false);

    const AD_FALLBACK_TIMEOUT_MS = 8000;
    const fallbackTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const isWaitingRef = React.useRef(false);

    // Google AdMob Rewarded
    const { isLoaded: isAdMobLoaded, isClosed: isAdMobClosed, isEarnedReward, error: rewardError, load: loadAdMob, show: showAdMob } = useRewardedAd(AdMobIds.REWARDED_FIN_PARTIE);

    React.useEffect(() => {
        if (Platform.OS !== 'web') {
            loadAdMob();
        }
    }, [loadAdMob]);

    React.useEffect(() => {
        if (isAdMobClosed) {
            isWaitingRef.current = false;
            if (fallbackTimerRef.current) {
                clearTimeout(fallbackTimerRef.current);
                fallbackTimerRef.current = null;
            }
            const processReward = async () => {
                if (isEarnedReward) {
                    try {
                        await onClaim();
                        setClaimed(true);
                    } catch (e) {
                        console.error("Erreur après visionnage pub AdMob :", e);
                    }
                }
                setLoading(false);
                if (Platform.OS !== 'web') {
                    loadAdMob();
                }
            };
            processReward();
        }
    }, [isAdMobClosed, isEarnedReward, loadAdMob]);

    const handlePress = async () => {
        if (claimed || loading || disabled) return;
        setLoading(true);
        try {
            if (Platform.OS === 'web') {
                await onClaim();
                setClaimed(true);
                setLoading(false);
                return;
            }

            if (isAdMobLoaded) {
                showAdMob();
                return;
            }
            
            loadAdMob();
            isWaitingRef.current = true;
            fallbackTimerRef.current = setTimeout(async () => {
                if (isWaitingRef.current) {
                    isWaitingRef.current = false;
                    try {
                        await onClaim();
                        setClaimed(true);
                    } catch (e) {
                        console.error("Erreur fallback pub :", e);
                    }
                    setLoading(false);
                }
            }, AD_FALLBACK_TIMEOUT_MS);
        } catch (e) {
            console.error("Erreur chargement pub :", e);
            setLoading(false);
            Alert.alert("Erreur", "Une erreur est survenue lors du chargement de la publicité.");
        }
    };

    const isProminent = variant === 'prominent';

    if (claimed) {
        return (
            <Animated.View entering={FadeIn.duration(300)} style={styles.confirmWrap}>
                <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                <Text style={styles.confirmText}>+{coinsAmount} coins crédités !</Text>
            </Animated.View>
        );
    }

    return (
        <Animated.View
            entering={FadeInUp.delay(enterDelay).duration(280)}
            style={styles.wrap}
        >
            <TouchableOpacity
                style={[
                    styles.btn,
                    isProminent && styles.btnProminent,
                    (disabled || loading) && styles.btnDisabled,
                ]}
                activeOpacity={0.82}
                onPress={handlePress}
                disabled={disabled || loading}
                accessibilityLabel={`${label} pour gagner ${coinsAmount} coins`}
                accessibilityRole="button"
            >
                {loading ? (
                    <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />
                ) : (
                    <Text style={styles.icon}>📺</Text>
                )}

                <View style={styles.textBlock}>
                    <Text style={[styles.labelText, isProminent && styles.labelTextProminent]}>
                        {label}
                    </Text>
                    <Text style={styles.bonusText}>+{coinsAmount} 🪙</Text>
                </View>

                <Ionicons
                    name="play-circle"
                    size={22}
                    color={isProminent ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.75)'}
                />
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    wrap: {
        alignItems: 'center',
        marginTop: 10,
        width: '100%',
        paddingHorizontal: 4,
    },

    // ── Variante par défaut (fond sombre, discret) ──
    btn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.16)',
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 16,
        width: '100%',
    },

    // ── Variante prominente (fond doré, appel à l'action fort) ──
    btnProminent: {
        backgroundColor: 'rgba(255,215,0,0.15)',
        borderColor: 'rgba(255,215,0,0.5)',
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 5,
    },

    btnDisabled: {
        opacity: 0.45,
    },

    icon: {
        fontSize: 22,
    },

    textBlock: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },

    labelText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 13,
        fontWeight: '700',
    },

    labelTextProminent: {
        color: '#FFD700',
        fontSize: 14,
    },

    bonusText: {
        color: '#FFD700',
        fontSize: 12,
        fontWeight: '900',
    },

    // ── Confirmation post-clic ──
    confirmWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
        justifyContent: 'center',
    },

    confirmText: {
        color: '#4CAF50',
        fontWeight: '700',
        fontSize: 13,
    },
});
