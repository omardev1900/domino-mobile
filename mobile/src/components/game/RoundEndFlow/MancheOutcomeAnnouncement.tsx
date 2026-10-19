import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
    FadeIn,
    FadeInDown,
    ZoomIn,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { Image as ExpoImage } from 'expo-image';

import { GameState, Player } from '../../../core/types';
import { AvatarId, getAvatarImage } from '../../../core/avatars';
import SoundManager from '../../../core/audio/SoundManager';

interface MancheOutcomeAnnouncementProps {
    gameState: GameState;
    winner: Player | null;
    isTie: boolean;
    visible: boolean;
    localPlayerId: string;
    onContinue: () => void;
    isHost?: boolean;
    autoAdvanceDelay?: number;
    localPlayerIndex?: number;
}

const getCochonCount = (gameState: GameState, recipients: Player[]) => {
    // Les anciennes sauvegardes et certains états intermédiaires de fin de round
    // n'ont pas encore cette propriété : l'annonce doit rester affichable.
    const history = Array.isArray(gameState.mancheHistory) ? gameState.mancheHistory : [];
    return history[history.length - 1]?.cochonCount ?? recipients.length;
};

export const MancheOutcomeAnnouncement: React.FC<MancheOutcomeAnnouncementProps> = ({
    gameState,
    winner,
    isTie,
    visible,
    localPlayerId,
    onContinue,
    isHost = true,
    autoAdvanceDelay = 4000,
    localPlayerIndex = 0,
}) => {
    const reducedMotion = useReducedMotion();
    const pulse = useSharedValue(1);
    const result = gameState.mancheResult;
    const giver = useMemo(
        () => gameState.players.find(player => player.id === gameState.firstPlayerOfRound) ?? null,
        [gameState.firstPlayerOfRound, gameState.players],
    );
    const recipients = useMemo(
        () => gameState.players.filter(player => player.isCochon && player.id !== giver?.id),
        [gameState.players, giver?.id],
    );
    const cochonCount = getCochonCount(gameState, recipients);

    useEffect(() => {
        if (!visible) return;
        if (result === 'CHIRE') SoundManager.playSound('uhoh');
        else if (result === 'COCHON') SoundManager.playSound('applause');
        else if (gameState.phase === 'BOUDE' || isTie) SoundManager.playSound('notify');
        else SoundManager.playSound(gameState.phase === 'MANCHE_END' ? 'mancheEnd' : 'roundEnd');
        if (!reducedMotion) {
            pulse.value = withRepeat(
                withSequence(withTiming(1.12, { duration: 420 }), withTiming(1, { duration: 420 })),
                4,
                true,
            );
        }
        return () => {
            pulse.value = 1;
        };
    }, [gameState.phase, isTie, pulse, reducedMotion, result, visible]);

    useEffect(() => {
        if (!visible || !isHost || autoAdvanceDelay <= 0) return;
        const timer = setTimeout(onContinue, autoAdvanceDelay);
        return () => clearTimeout(timer);
    }, [autoAdvanceDelay, isHost, onContinue, visible]);

    useEffect(() => {
        if (!visible || isHost || autoAdvanceDelay <= 0) return;
        const fallbackDelay = Math.min(autoAdvanceDelay * 2 + localPlayerIndex * 2000, 3000);
        const timer = setTimeout(onContinue, fallbackDelay);
        return () => clearTimeout(timer);
    }, [autoAdvanceDelay, isHost, localPlayerIndex, onContinue, visible]);

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulse.value }],
    }));

    const isRoundEnd = gameState.phase === 'PARTIE_END';
    const isNormalMancheEnd = gameState.phase === 'MANCHE_END' && result !== 'CHIRE' && result !== 'COCHON';
    const isBlockedRound = gameState.phase === 'BOUDE';
    const isMatchEnd = gameState.phase === 'MATCH_END';

    if (!visible || (!isRoundEnd && !isNormalMancheEnd && !isBlockedRound && !isMatchEnd && result !== 'CHIRE' && result !== 'COCHON')) return null;

    if (result === 'CHIRE') {
        return (
            <Animated.View entering={FadeIn.duration(180)} style={styles.container} pointerEvents="none">
                <Animated.View entering={reducedMotion ? undefined : ZoomIn.springify().damping(11)} style={[styles.card, styles.chireCard, pulseStyle]}>
                    <Text style={styles.chireBolt}>⚡</Text>
                    <Text style={styles.chireTitle}>CHIRÉ !</Text>
                    <Text style={styles.subtitle}>Manche annulée</Text>
                    <Text style={styles.detail}>Personne ne remporte cette manche.</Text>
                </Animated.View>
            </Animated.View>
        );
    }

    if (isBlockedRound) {
        const winnerText = winner
            ? (winner.id === localPlayerId ? 'Vous gagnez ce round' : `${winner.name} gagne ce round`)
            : 'Personne ne gagne ce round.';
        return (
            <Animated.View entering={FadeIn.duration(180)} style={styles.container} pointerEvents="none">
                <Animated.View entering={reducedMotion ? undefined : ZoomIn.springify().damping(11)} style={[styles.card, winner ? styles.blockedWinnerCard : styles.tieCard, pulseStyle]}>
                    <Text style={styles.genericIcon}>{winner ? '🚫' : '⚖️'}</Text>
                    <Text style={styles.genericTitle}>{winner ? 'PARTIE BLOQUÉE' : 'ÉGALITÉ !'}</Text>
                    {winner && <PlayerBadge player={winner} label={winner.id === localPlayerId ? 'Vous' : winner.name} />}
                    <Text style={styles.subtitle}>{winnerText}</Text>
                    {winner && <Text style={styles.detail}>Son score est le plus bas.</Text>}
                </Animated.View>
            </Animated.View>
        );
    }

    if (result !== 'COCHON') {
        const isManche = isNormalMancheEnd;
        const label = isMatchEnd ? 'MATCH TERMINÉ !' : isManche ? 'MANCHE GAGNÉE !' : 'FIN DU ROUND';
        const subtitle = winner
            ? (winner.id === localPlayerId
                ? (isMatchEnd ? 'Vous remportez le match' : isManche ? 'Vous remportez la manche' : 'Vous remportez ce round')
                : `${winner.name} ${isMatchEnd ? 'remporte le match' : isManche ? 'remporte la manche' : 'remporte ce round'}`)
            : isMatchEnd ? 'Résultat du match' : 'Résultat du round';
        return (
            <Animated.View entering={FadeIn.duration(180)} style={styles.container} pointerEvents="none">
                <Animated.View entering={reducedMotion ? undefined : ZoomIn.springify().damping(11)} style={[styles.card, isMatchEnd ? styles.matchCard : styles.victoryCard, pulseStyle]}>
                    <Text style={styles.genericIcon}>{isMatchEnd || isManche ? '🏆' : '✨'}</Text>
                    <Text style={styles.genericTitle}>{label}</Text>
                    {winner && <PlayerBadge player={winner} label={winner.id === localPlayerId ? 'Vous' : winner.name} />}
                    <Text style={styles.subtitle}>{subtitle}</Text>
                </Animated.View>
            </Animated.View>
        );
    }

    const label = cochonCount > 1 ? 'DOUBLE COCHON !' : 'COCHON !';
    const recipientNames = recipients.map(player => player.id === localPlayerId ? 'vous' : player.name).join(' et ');

    return (
        <Animated.View entering={FadeIn.duration(180)} style={styles.container} pointerEvents="none">
            <Animated.View entering={reducedMotion ? undefined : ZoomIn.springify().damping(11)} style={[styles.card, styles.cochonCard, pulseStyle]}>
                <Text style={styles.cochonIcon}>🐷</Text>
                <Text style={styles.cochonTitle}>{label}</Text>
                <View style={styles.avatars}>
                    {giver && <PlayerBadge player={giver} label={giver.id === localPlayerId ? 'Vous' : giver.name} />}
                    {giver && recipients.length > 0 && <Text style={styles.arrow}>➜</Text>}
                    {recipients.slice(0, 2).map((player, index) => (
                        <PlayerBadge
                            key={player.id}
                            player={player}
                            label={player.id === localPlayerId ? 'Vous' : player.name}
                            delay={index * 120}
                            isRecipient
                        />
                    ))}
                </View>
                <Text style={styles.subtitle}>
                    {giver ? `${giver.id === localPlayerId ? 'Vous donnez' : `${giver.name} donne`} ${cochonCount > 1 ? 'deux cochons' : 'un cochon'}` : 'Un cochon est donné'}
                </Text>
                {recipientNames.length > 0 && <Text style={styles.detail}>à {recipientNames}.</Text>}
            </Animated.View>
        </Animated.View>
    );
};

const PlayerBadge: React.FC<{ player: Player; label: string; delay?: number; isRecipient?: boolean }> = ({ player, label, delay = 0, isRecipient = false }) => {
    const reducedMotion = useReducedMotion();
    return (
        <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(delay).springify()} style={styles.badge}>
            <ExpoImage source={getAvatarImage((player.avatarId as AvatarId) || 'avatar_default')} style={[styles.avatar, isRecipient && styles.recipientAvatar]} contentFit="cover" />
            <Text numberOfLines={1} style={styles.badgeName}>{label}</Text>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 1600, elevation: 1600 },
    card: { alignItems: 'center', borderRadius: 26, borderWidth: 3, maxWidth: '90%', paddingHorizontal: 28, paddingVertical: 24, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 24, elevation: 28 },
    chireCard: { backgroundColor: 'rgba(27, 15, 53, 0.96)', borderColor: '#B084FF', shadowColor: '#8956E9' },
    cochonCard: { backgroundColor: 'rgba(57, 15, 41, 0.96)', borderColor: '#FF75B5', shadowColor: '#FF4FA2' },
    victoryCard: { backgroundColor: 'rgba(31, 39, 19, 0.96)', borderColor: '#FFD700', shadowColor: '#FFD700' },
    matchCard: { backgroundColor: 'rgba(43, 27, 9, 0.97)', borderColor: '#FFE488', shadowColor: '#FFD700' },
    tieCard: { backgroundColor: 'rgba(14, 37, 62, 0.96)', borderColor: '#69C5FF', shadowColor: '#3E9FE5' },
    blockedWinnerCard: { backgroundColor: 'rgba(60, 37, 8, 0.97)', borderColor: '#FFB74D', shadowColor: '#FF9800' },
    chireBolt: { fontSize: 66, textShadowColor: '#B084FF', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 22 },
    chireTitle: { color: '#FFFFFF', fontSize: 38, fontWeight: '900', letterSpacing: 3, textShadowColor: '#8956E9', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 9 },
    cochonIcon: { fontSize: 57, marginBottom: 2 },
    genericIcon: { fontSize: 54, marginBottom: 2 },
    cochonTitle: { color: '#FFF2F9', fontSize: 31, fontWeight: '900', letterSpacing: 2, textAlign: 'center' },
    genericTitle: { color: '#FFFFFF', fontSize: 29, fontWeight: '900', letterSpacing: 1.5, textAlign: 'center' },
    subtitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginTop: 14, textAlign: 'center' },
    detail: { color: 'rgba(255,255,255,0.77)', fontSize: 14, marginTop: 4, textAlign: 'center' },
    avatars: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginTop: 16, maxWidth: 310 },
    arrow: { color: '#FFD1E6', fontSize: 27, marginHorizontal: 8 },
    badge: { alignItems: 'center', maxWidth: 92 },
    avatar: { borderColor: '#FFD700', borderRadius: 28, borderWidth: 2, height: 56, width: 56 },
    recipientAvatar: { borderColor: '#FF75B5' },
    badgeName: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', marginTop: 4, textAlign: 'center' },
});
