/**
 * EconomyHeader.tsx
 *
 * Barre de statut économique globale — Coins 🪙 + Diamonds 💎
 * Se rafraîchit automatiquement au focus de l'écran parent.
 *
 * Usage :
 *   <EconomyHeader refreshTrigger={focusTrigger} />
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withTiming, withSequence } from 'react-native-reanimated';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { economyService } from '../core/services/economy.service';
import { PlayerEconomy } from '../core/economy.types';

const XPIcon = () => (
    <Svg width="18" height="18" viewBox="0 0 24 24">
        <Circle cx="12" cy="12" r="11" fill="#A5D6A7" />
        <SvgText
            x="12"
            y="16"
            fill="#1A0E2E"
            fontSize="11"
            fontWeight="bold"
            textAnchor="middle"
        >
            XP
        </SvgText>
    </Svg>
);

interface EconomyHeaderProps {
    /** Changer cette valeur pour forcer un refresh (ex: date au focus) */
    refreshTrigger?: any;
    /** Callback optionnel à appeler quand l'utilisateur tape sur les coins */
    onCoinsPress?: () => void;
    /** Callback optionnel à appeler quand l'utilisateur tape sur les diamonds */
    onDiamondsPress?: () => void;
    /** Callback optionnel à appeler quand l'utilisateur tape sur l'XP */
    onXpPress?: () => void;
    /** Cacher l'XP (ex: dans la boutique) */
    hideXp?: boolean;
}

export function EconomyHeader({ refreshTrigger, onCoinsPress, onDiamondsPress, onXpPress, hideXp }: EconomyHeaderProps) {
    const [economy, setEconomy] = useState<PlayerEconomy>({
        coins: 0, xp: 0, level: 1, diamonds: 0, leaguePoints: 0, leagueGrade: null,
    });

    const coinsScale = useSharedValue(1);
    const prevCoins = React.useRef(0);

    useEffect(() => {
        economyService.getEconomy().then(eco => {
            if (eco.coins !== prevCoins.current && prevCoins.current !== 0) {
                // Pulse animation when coins change
                coinsScale.value = withSequence(
                    withTiming(1.3, { duration: 150 }),
                    withTiming(1, { duration: 200 }),
                );
            }
            prevCoins.current = eco.coins;
            setEconomy(eco);
        });
    }, [refreshTrigger]);

    const coinsAnimStyle = useAnimatedStyle(() => ({
        transform: [{ scale: coinsScale.value }],
    }));

    const formatAmount = (n: number) => {
        // Affiche les chiffres en entier avec séparateur de milliers (ex: 2.100)
        return Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    return (
        <Animated.View entering={FadeIn.duration(400)} style={styles.container}>
            {/* Coins */}
            <TouchableOpacity
                style={styles.card}
                onPress={onCoinsPress}
                activeOpacity={onCoinsPress ? 0.7 : 1}
            >
                <Text style={styles.pillIcon}>🪙</Text>
                <Animated.Text style={[styles.pillValue, coinsAnimStyle]}>
                    {formatAmount(economy.coins)}
                </Animated.Text>
            </TouchableOpacity>

            {/* Diamonds */}
            <TouchableOpacity
                style={styles.card}
                onPress={onDiamondsPress}
                activeOpacity={onDiamondsPress ? 0.7 : 1}
            >
                <Text style={styles.pillIcon}>💎</Text>
                <Text style={[styles.pillValue, styles.diamondValue]}>
                    {formatAmount(economy.diamonds)}
                </Text>
            </TouchableOpacity>

            {/* XP */}
            {!hideXp && (
                <TouchableOpacity
                    style={styles.card}
                    onPress={onXpPress}
                    activeOpacity={onXpPress ? 0.7 : 1}
                >
                    <XPIcon />
                    <Text style={[styles.pillValue, styles.xpValue]}>
                        {formatAmount(economy.xp)}
                    </Text>
                </TouchableOpacity>
            )}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12, // Identité visuelle plus aérée
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.35)',
        borderRadius: 20,
        paddingHorizontal: 12,
        height: 32, // Hauteur fixe pour éviter le crop et assurer l'uniformité
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.25)',
        gap: 6,
    },
    pillIcon: {
        fontSize: 14,
    },
    pillValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFD700',
        letterSpacing: 0.3,
        minWidth: 28,
        textAlign: 'center',
    },
    diamondValue: {
        color: '#60DCFF',
    },
    xpValue: {
        color: '#A5D6A7',
    },
});
