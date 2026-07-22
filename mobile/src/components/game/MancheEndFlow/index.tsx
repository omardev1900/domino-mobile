import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, ZoomIn, FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { GameState } from '../../../core/types';
import SoundManager from '../../../core/audio/SoundManager';
import { getAvatarImage, AvatarId } from '../../../core/avatars';
import { calculateHandPoints } from '../../../core/ScoringEngine';

interface MancheEndFlowProps {
    gameState: GameState;
    visible: boolean;
    localPlayerId: string;
    onContinue: () => void;
    isHost: boolean;
}

export const MancheEndFlow: React.FC<MancheEndFlowProps> = ({
    gameState,
    visible,
    localPlayerId,
    onContinue,
    isHost,
}) => {
    const reducedMotion = useReducedMotion();
    const { height } = useWindowDimensions();
    const isCompact = height < 500;
    
    const [autoAdvanceSeconds, setAutoAdvanceSeconds] = useState<number | null>(null);
    const AUTO_ADVANCE_MS = 2800;

    const isBoude = gameState.phase === 'BOUDE';
    const mancheResult = gameState.mancheResult;

    // Calcul du vainqueur (identique à UnifiedResultOverlay)
    const boudeWinnerId = (() => {
        if (!isBoude) return null;
        const scores = gameState.players.map(p => ({ id: p.id, score: calculateHandPoints(p.hand) }));
        const minScore = Math.min(...scores.map(s => s.score));
        const winners = scores.filter(s => s.score === minScore);
        return winners.length === 1 ? winners[0].id : null;
    })();

    const winnerId = isBoude
        ? boudeWinnerId
        : mancheResult === 'CHIRE'
            ? null
            : (gameState.players.find(p => p.id === gameState.firstPlayerOfRound)?.id
                || gameState.players.find(p => p.hand.length === 0)?.id);

    const winner = gameState.players.find(p => p.id === winnerId);

    const getTitle = () => {
        if (isBoude) return {
            main: '🚫 PARTIE BLOQUÉE',
            sub: boudeWinnerId
                ? `${winner?.name} gagne !`
                : 'Personne ne gagne.',
        };
        if (mancheResult === 'CHIRE') return { main: '⚡ CHIRÉ !!', sub: 'Manche annulée, passage automatique.' };
        if (mancheResult === 'COCHON') return { main: '🐷 COCHON !', sub: 'Une manche de prestige !' };
        return {
            main: '🏆 MANCHE GAGNÉE',
            sub: winner ? `${winner.name} remporte la manche` : 'Victoire nette',
        };
    };

    const { main: titleMain, sub: titleSub } = getTitle();

    useEffect(() => {
        if (!visible) return;

        // Sons spécifiques selon le résultat de la manche
        if (isBoude) {
            SoundManager.playSound('notify');
        } else if (mancheResult === 'CHIRE') {
            SoundManager.playSound('uhoh');
        } else if (mancheResult === 'COCHON') {
            SoundManager.playSound('applause');
        } else {
            SoundManager.playSound('mancheEnd');
        }

        // Auto-advance for CHIRE (Manche annulée)
        if (mancheResult === 'CHIRE') {
            setAutoAdvanceSeconds(Math.ceil(AUTO_ADVANCE_MS / 1000));
            const countdown = setInterval(() => {
                setAutoAdvanceSeconds(prev => (prev === null || prev <= 1) ? 1 : prev - 1);
            }, 1000);

            const autoAdvance = isHost ? setTimeout(() => onContinue(), AUTO_ADVANCE_MS) : null;
            return () => {
                clearInterval(countdown);
                if (autoAdvance) clearTimeout(autoAdvance);
            };
        }
    }, [visible, isBoude, mancheResult, isHost, onContinue]);

    if (!visible) return null;

    return (
        <View style={styles.container} pointerEvents="box-none">
            <Animated.View style={styles.content} entering={reducedMotion ? undefined : FadeIn.duration(400)}>
                {/* Header Animé */}
                <Animated.View entering={reducedMotion ? undefined : ZoomIn.duration(400).springify().damping(14)} style={styles.titlePill}>
                    <Text style={[styles.titleMain, mancheResult === 'CHIRE' && styles.titleChire, mancheResult === 'COCHON' && styles.titleCochon]}>
                        {titleMain}
                    </Text>
                    <Text style={styles.titleSub}>{titleSub}</Text>
                </Animated.View>

                {/* Avatar du vainqueur (si existant et différent de Chiré/Cochon) */}
                {winner && mancheResult !== 'CHIRE' && (
                    <Animated.View entering={reducedMotion ? undefined : FadeInUp.delay(200).duration(400).springify()} style={[styles.heroContainer, isCompact && { marginTop: 20 }]}>
                        <View style={styles.avatarWrapper}>
                            <Image
                                source={getAvatarImage((winner.avatarId as AvatarId) || 'avatar_default')}
                                style={[styles.avatar, isCompact && { width: 90, height: 90, borderRadius: 45 }]}
                                contentFit="cover"
                            />
                            {mancheResult !== 'BOUDE' && <Text style={[styles.crown, isCompact && { fontSize: 35, top: -15, left: -10 }]}>👑</Text>}
                        </View>
                        <Text style={[styles.winnerName, winner.id === localPlayerId && styles.localWinnerName, isCompact && { fontSize: 18, marginTop: 10 }]}>
                            {winner.id === localPlayerId ? 'Vous avez gagné !' : winner.name}
                        </Text>
                    </Animated.View>
                )}

                <View style={{ flex: 1 }} />

                {/* Bouton Continuer / Auto-advance */}
                <Animated.View entering={reducedMotion ? undefined : FadeInUp.delay(400).duration(300)} style={styles.footer}>
                    {mancheResult === 'CHIRE' ? (
                        <View style={[styles.btn, styles.disabledBtn]}>
                            <Ionicons name="flash-outline" size={20} color="#FFD700" />
                            <Text style={styles.btnText}>
                                {isHost ? `Suite automatique dans ${autoAdvanceSeconds}s...` : "Attente de l'hôte..."}
                            </Text>
                        </View>
                    ) : isHost ? (
                        <TouchableOpacity style={styles.btn} onPress={onContinue} activeOpacity={0.85}>
                            <Ionicons name="arrow-forward" size={20} color="#000" />
                            <Text style={styles.btnText}>CONTINUER</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={[styles.btn, styles.disabledBtn]}>
                            <Text style={[styles.btnText, { color: 'rgba(255,255,255,0.6)' }]}>Attente de l'hôte...</Text>
                        </View>
                    )}
                </Animated.View>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1000,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    titlePill: {
        marginTop: 10,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 30,
        paddingVertical: 15,
        borderRadius: 25,
        borderWidth: 2,
        borderColor: 'rgba(255,215,0,0.4)',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 10,
        elevation: 10,
    },
    titleMain: {
        fontSize: 28,
        fontWeight: '900',
        color: '#FFD700',
        textTransform: 'uppercase',
        letterSpacing: 2,
        textAlign: 'center',
    },
    titleChire: {
        color: '#FF6B6B',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 1, height: 2 },
        textShadowRadius: 2,
    },
    titleCochon: {
        color: '#FF9800',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 1, height: 2 },
        textShadowRadius: 2,
    },
    titleSub: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        fontWeight: 'bold',
        marginTop: 6,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    heroContainer: {
        alignItems: 'center',
        marginTop: 60,
    },
    avatarWrapper: {
        position: 'relative',
    },
    avatar: {
        width: 140,
        height: 140,
        borderRadius: 70,
        borderWidth: 4,
        borderColor: '#FFD700',
    },
    crown: {
        position: 'absolute',
        top: -25,
        left: -15,
        fontSize: 45,
        transform: [{ rotate: '-15deg' }],
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 2, height: 2 },
        textShadowRadius: 4,
    },
    winnerName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'rgba(255,255,255,0.9)',
        marginTop: 15,
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
    localWinnerName: {
        color: '#FFD700',
    },
    footer: {
        width: '100%',
        alignItems: 'center',
        marginBottom: 40,
    },
    btn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFD700',
        paddingHorizontal: 30,
        paddingVertical: 15,
        borderRadius: 25,
        gap: 10,
        minWidth: 200,
        elevation: 5,
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 5,
    },
    disabledBtn: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderColor: 'rgba(255,255,255,0.2)',
        borderWidth: 1,
        shadowOpacity: 0,
        elevation: 0,
    },
    btnText: {
        color: '#000',
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
});
