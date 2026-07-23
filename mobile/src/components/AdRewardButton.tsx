import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { classifyRewardedAdError } from '../core/ads/rewardedAdPolicy';
import { AdMobIds, useRewardedAd } from '../core/services/AdMobAdapter';
import { LogService } from '../core/services/LogService';

export type AdRewardClaimSource = 'admob' | 'no_fill';

export interface AdRewardButtonProps {
    coinsAmount: number;
    onClaim: (source: AdRewardClaimSource) => void | Promise<void>;
    label?: string;
    disabled?: boolean;
    variant?: 'default' | 'prominent';
    enterDelay?: number;
}

type RewardButtonState = 'idle' | 'loading' | 'no_fill' | 'claiming' | 'claimed';

const AD_LOAD_TIMEOUT_MS = 8000;
const LATE_REWARD_GRACE_MS = 1000;

export const AdRewardButton: React.FC<AdRewardButtonProps> = ({
    coinsAmount,
    onClaim,
    label = 'Voir une pub',
    disabled = false,
    variant = 'default',
    enterDelay = 0,
}) => {
    const [buttonState, setButtonState] = useState<RewardButtonState>('idle');
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingShowRef = useRef(false);
    const awaitingRewardRef = useRef(false);
    const claimStartedRef = useRef(false);

    const {
        isLoaded,
        isClosed,
        isEarnedReward,
        error: rewardError,
        load,
        show,
    } = useRewardedAd(AdMobIds.REWARDED_FIN_PARTIE);

    const clearLoadTimer = useCallback(() => {
        if (loadTimerRef.current) {
            clearTimeout(loadTimerRef.current);
            loadTimerRef.current = null;
        }
    }, []);

    const claimOnce = useCallback(async (source: AdRewardClaimSource) => {
        if (claimStartedRef.current) return;
        claimStartedRef.current = true;
        pendingShowRef.current = false;
        awaitingRewardRef.current = false;
        clearLoadTimer();
        setButtonState('claiming');
        setStatusMessage(null);

        try {
            await onClaim(source);
            setButtonState('claimed');
        } catch (error) {
            claimStartedRef.current = false;
            setButtonState(source === 'no_fill' ? 'no_fill' : 'idle');
            setStatusMessage('Bonus non credite. Reessayez.');
            LogService.error('AdRewardButton', 'Reward claim failed', error);
        }
    }, [clearLoadTimer, onClaim]);

    useEffect(() => {
        if (Platform.OS !== 'web') load();
    }, [load]);

    useEffect(() => () => {
        clearLoadTimer();
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    }, [clearLoadTimer]);

    useEffect(() => {
        if (!rewardError) return;

        clearLoadTimer();
        pendingShowRef.current = false;
        awaitingRewardRef.current = false;
        const failure = classifyRewardedAdError(rewardError);
        LogService.warn('AdRewardButton', `Rewarded ad load failed: ${failure}`, rewardError);

        if (failure === 'NO_FILL') {
            setButtonState('no_fill');
            setStatusMessage('Aucune pub disponible. Le bonus est offert.');
            return;
        }

        setButtonState('idle');
        setStatusMessage(
            failure === 'NETWORK'
                ? 'Connexion requise pour charger la publicite.'
                : 'Publicite indisponible. Reessayez plus tard.'
        );
    }, [clearLoadTimer, rewardError]);

    useEffect(() => {
        if (!isLoaded || !pendingShowRef.current || claimStartedRef.current) return;

        clearLoadTimer();
        pendingShowRef.current = false;
        awaitingRewardRef.current = true;
        setStatusMessage(null);
        try {
            show();
        } catch (error) {
            awaitingRewardRef.current = false;
            setButtonState('idle');
            setStatusMessage('Impossible d afficher la publicite.');
            LogService.error('AdRewardButton', 'Rewarded ad show failed', error);
        }
    }, [clearLoadTimer, isLoaded, show]);

    useEffect(() => {
        if (isEarnedReward && awaitingRewardRef.current) {
            void claimOnce('admob');
        }
    }, [claimOnce, isEarnedReward]);

    useEffect(() => {
        if (!isClosed) return;

        clearLoadTimer();
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        closeTimerRef.current = setTimeout(() => {
            awaitingRewardRef.current = false;
            if (!claimStartedRef.current) {
                setButtonState('idle');
                setStatusMessage('Publicite fermee avant la recompense.');
            }
            load();
        }, LATE_REWARD_GRACE_MS);
    }, [clearLoadTimer, isClosed, load]);

    const handlePress = useCallback(() => {
        if (
            Platform.OS === 'web'
            || disabled
            || buttonState === 'loading'
            || buttonState === 'claiming'
            || buttonState === 'claimed'
        ) {
            return;
        }

        if (buttonState === 'no_fill') {
            void claimOnce('no_fill');
            return;
        }

        setButtonState('loading');
        setStatusMessage(null);
        if (isLoaded) {
            awaitingRewardRef.current = true;
            try {
                show();
            } catch (error) {
                awaitingRewardRef.current = false;
                setButtonState('idle');
                setStatusMessage('Impossible d afficher la publicite.');
                LogService.error('AdRewardButton', 'Rewarded ad show failed', error);
            }
            return;
        }

        pendingShowRef.current = true;
        load();
        clearLoadTimer();
        loadTimerRef.current = setTimeout(() => {
            pendingShowRef.current = false;
            setButtonState('idle');
            setStatusMessage('Chargement trop long. Reessayez.');
        }, AD_LOAD_TIMEOUT_MS);
    }, [buttonState, claimOnce, clearLoadTimer, disabled, isLoaded, load, show]);

    if (Platform.OS === 'web') return null;

    const isProminent = variant === 'prominent';
    const isBusy = buttonState === 'loading' || buttonState === 'claiming';
    const isNoFill = buttonState === 'no_fill';

    if (buttonState === 'claimed') {
        return (
            <Animated.View entering={FadeIn.duration(300)} style={styles.confirmWrap}>
                <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                <Text style={styles.confirmText}>+{coinsAmount} coins credites !</Text>
            </Animated.View>
        );
    }

    return (
        <Animated.View entering={FadeInUp.delay(enterDelay).duration(280)} style={styles.wrap}>
            <TouchableOpacity
                style={[
                    styles.btn,
                    isProminent && styles.btnProminent,
                    (disabled || isBusy) && styles.btnDisabled,
                ]}
                activeOpacity={0.82}
                onPress={handlePress}
                disabled={disabled || isBusy}
                accessibilityLabel={
                    isNoFill
                        ? `Recuperer le bonus offert de ${coinsAmount} coins`
                        : `${label} pour gagner ${coinsAmount} coins`
                }
                accessibilityRole="button"
            >
                {isBusy ? (
                    <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />
                ) : (
                    <Ionicons name={isNoFill ? 'gift-outline' : 'tv-outline'} size={22} color="#FFD700" />
                )}

                <View style={styles.textBlock}>
                    <Text style={[styles.labelText, isProminent && styles.labelTextProminent]}>
                        {isNoFill ? 'Recuperer le bonus' : label}
                    </Text>
                    <Text style={styles.bonusText}>+{coinsAmount} coins</Text>
                </View>

                <Ionicons
                    name={isNoFill ? 'gift' : 'play-circle'}
                    size={22}
                    color={isProminent ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.75)'}
                />
            </TouchableOpacity>
            {statusMessage && <Text style={styles.statusText}>{statusMessage}</Text>}
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
    btn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.16)',
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 16,
        width: '100%',
    },
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
    statusText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        marginTop: 8,
        textAlign: 'center',
    },
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
