import React, { useEffect, useState, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    useWindowDimensions, ScrollView,
} from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { Image } from 'expo-image';
import Animated, {
    FadeInDown, FadeInUp, BounceIn, ZoomIn,
    useSharedValue, useAnimatedStyle,
    withSpring, withTiming,
    useReducedMotion,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { GameState, Player } from '@/core/types';

import SoundManager from '../core/audio/SoundManager';
import { MatchReward } from '@/core/economy.types';
import { LEAGUE_LABELS, AD_REWARD_COINS } from '@/core/economy.constants';
import { getAvatarImage, AvatarId } from '@/core/avatars';
import { calculateHandPoints } from '@/core/ScoringEngine';
import { GradeBadge } from './GradeBadge';
import { PlayerCard } from './common/PlayerCard';
import { ShareTextButton, buildWinShareText, WinShareCard } from './ShareButton';

interface UnifiedResultOverlayProps {
    gameState: GameState;
    visible: boolean;
    currentUserId: string;
    onContinue: () => void;
    onLeave?: () => void;
    onReplay?: () => void;
    isSoloMode?: boolean;
    allReady?: boolean;
    onAnimationFinished?: () => void;
    isHost?: boolean;
    matchReward?: MatchReward | null;
    /** Appelé quand le joueur clique sur "Voir une pub" en fin de match. Doit créditer +100 coins. */
    onAdRewardClaim?: () => void;
}

export const UnifiedResultOverlay: React.FC<UnifiedResultOverlayProps> = ({
    gameState,
    visible,
    currentUserId,
    onContinue,
    onLeave,
    onReplay,
    isSoloMode,
    isHost = true,
    matchReward,
    onAdRewardClaim,
}) => {
    const { width, height } = useWindowDimensions();
    const isLandscape = width > height;
    const reducedMotion = useReducedMotion();
    const AUTO_ADVANCE_MS = 2800;

    const [showHistory, setShowHistory] = useState(false);
    const [autoAdvanceSeconds, setAutoAdvanceSeconds] = useState<number | null>(null);
    const confettiRef = useRef<ConfettiCannon>(null);
    const lastPlayedPhaseRef = useRef<string | null>(null);
    const applauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isMatchOver = gameState.phase === 'MATCH_END';
    const isBoude = gameState.phase === 'BOUDE';
    const isMancheEnd = gameState.phase === 'MANCHE_END';
    const mancheResult = gameState.mancheResult;

    // Reset history view each time the overlay opens
    useEffect(() => {
        if (visible) setShowHistory(false);
    }, [visible]);

    useEffect(() => {
        if (!visible || !isMatchOver) {
            lastPlayedPhaseRef.current = null;
            if (applauseTimeoutRef.current) {
                clearTimeout(applauseTimeoutRef.current);
                applauseTimeoutRef.current = null;
            }
            return;
        }
        if (lastPlayedPhaseRef.current === gameState.phase) return;

        lastPlayedPhaseRef.current = gameState.phase;
        SoundManager.playSound('matchEnd');
        applauseTimeoutRef.current = setTimeout(() => {
            SoundManager.playSound('applause');
            applauseTimeoutRef.current = null;
        }, 800);

        return () => {
            if (applauseTimeoutRef.current) {
                clearTimeout(applauseTimeoutRef.current);
                applauseTimeoutRef.current = null;
            }
        };
    }, [visible, isMatchOver, gameState.phase]);

    useEffect(() => {
        if (!visible || mancheResult !== 'CHIRE' || isMatchOver || showHistory) {
            setAutoAdvanceSeconds(null);
            return;
        }

        setAutoAdvanceSeconds(Math.ceil(AUTO_ADVANCE_MS / 1000));

        const countdown = setInterval(() => {
            setAutoAdvanceSeconds((prev) => {
                if (prev === null || prev <= 1) return 1;
                return prev - 1;
            });
        }, 1000);

        const autoAdvance = isHost
            ? setTimeout(() => {
                onContinue();
            }, AUTO_ADVANCE_MS)
            : null;

        return () => {
            clearInterval(countdown);
            if (autoAdvance) clearTimeout(autoAdvance);
        };
    }, [visible, mancheResult, isMatchOver, showHistory, isHost, onContinue]);

    // ── Winners ────────────────────────────────────────────────────────────────
    const boudeWinnerId = (() => {
        if (!isBoude) return null;
        const scores = gameState.players.map(p => ({ id: p.id, score: calculateHandPoints(p.hand) }));
        const minScore = Math.min(...scores.map(s => s.score));
        const winners = scores.filter(s => s.score === minScore);
        return winners.length === 1 ? winners[0].id : null;
    })();

    const matchOverallWinner = [...gameState.players].sort((a, b) => {
        if (gameState.gameMode === 'COCHON') {
            if ((b.totalCochonsInfliges || 0) !== (a.totalCochonsInfliges || 0)) {
                return (b.totalCochonsInfliges || 0) - (a.totalCochonsInfliges || 0);
            }
            return b.totalPoints - a.totalPoints;
        }
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        if (b.totalCochons !== a.totalCochons) return b.totalCochons - a.totalCochons;
        return b.mancheWins - a.mancheWins;
    })[0];

    const winnerId = isMatchOver
        ? matchOverallWinner?.id
        : isBoude
            ? boudeWinnerId
            : mancheResult === 'CHIRE'
                ? null
                : (gameState.players.find(p => p.id === gameState.firstPlayerOfRound)?.id
                    || gameState.players.find(p => p.hand.length === 0)?.id);

    const isMeWinner = winnerId === currentUserId;

    // ── Panel animation ────────────────────────────────────────────────────────
    const scaleValue = useSharedValue(reducedMotion ? 1 : 0.5);
    const opacityValue = useSharedValue(reducedMotion ? 1 : 0);

    const animatedPanelStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scaleValue.value }],
        opacity: opacityValue.value,
    }));

    const animatedBackdropStyle = useAnimatedStyle(() => ({
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.87)',
        opacity: opacityValue.value,
    }));

    useEffect(() => {
        if (visible) {
            // Jouer le son approprié selon le résultat
            if (isMatchOver) {
                if (isMeWinner) SoundManager.playSound('win');
                else SoundManager.playSound('lose');
            } else if (isBoude) {
                SoundManager.playSound('notify');
            } else if (mancheResult === 'CHIRE') {
                SoundManager.playSound('uhoh');
            } else if (mancheResult === 'COCHON') {
                SoundManager.playSound('applause');
            } else {
                SoundManager.playSound('mancheEnd');
            }

            if (reducedMotion) {
                scaleValue.value = 1;
                opacityValue.value = 1;
            } else {
                scaleValue.value = withSpring(1, { damping: 14, stiffness: 130 });
                opacityValue.value = withTiming(1, { duration: 320 });
            }
        } else {
            scaleValue.value = 0.5;
            opacityValue.value = 0;
        }
    }, [visible, reducedMotion, isMatchOver, isMeWinner, isBoude, mancheResult]);

    // Confettis en boucle : le premier tir est assuré par autoStart={true}.
    // Ensuite on relance toutes les ~3,5 s tant qu'on est sur la vue principale
    // de fin de match. S'arrête quand l'utilisateur ouvre les détails, quitte,
    // ou si reducedMotion est actif.
    useEffect(() => {
        if (!visible || !isMatchOver || showHistory || reducedMotion) return;

        const CYCLE_MS = 3500;
        // Première relance après un délai suffisant pour que autoStart ait fini
        const loop = setInterval(() => {
            confettiRef.current?.start();
        }, CYCLE_MS);

        return () => {
            clearInterval(loop);
        };
    }, [visible, isMatchOver, showHistory, reducedMotion]);

    if (!visible) return null;

    // ── Podium: winner in center ───────────────────────────────────────────────
    const orderedPlayers = (() => {
        const sorted = [...gameState.players.slice(0, 3)];
        const wIdx = sorted.findIndex(p => p.id === winnerId);
        if (wIdx > -1) {
            const [winner] = sorted.splice(wIdx, 1);
            sorted.splice(1, 0, winner);
        }
        return sorted;
    })();

    // ── Mode + objectif affiché dans le header de fin de match ────────────────
    const getMatchModeLabel = (): string => {
        const { gameMode, winningCondition } = gameState;
        switch (gameMode) {
            case 'VICTOIRE': return `Mode Victoire · ${winningCondition} V`;
            case 'SCORE':    return `Mode Score · ${winningCondition} pts`;
            case 'COCHON':   return `Mode Cochon · ${winningCondition} 🐷`;
            case 'MANCHE':   return `Mode Manche · ${winningCondition} manche${winningCondition > 1 ? 's' : ''}`;
            default:         return '';
        }
    };

    // ── Score label per game mode ──────────────────────────────────────────────
    const getPlayerTotalScore = (p: Player): string => {
        switch (gameState.gameMode) {
            case 'VICTOIRE': return `${p.totalRoundWins} V`;
            case 'SCORE':    return `${p.totalPoints} pts`;
            case 'COCHON':   return `${p.totalCochonsInfliges || 0} 🐷`;
            default:         return `${p.totalPoints} pts`;
        }
    };

    // ── Title ──────────────────────────────────────────────────────────────────
    const getTitle = () => {
        if (isMatchOver) return {
            main: '🏆 VAINQUEUR DU MATCH',
            sub: matchOverallWinner?.name || '',
        };
        if (isBoude) return {
            main: '🚫 PARTIE BLOQUÉE',
            sub: boudeWinnerId
                ? `${gameState.players.find(p => p.id === boudeWinnerId)?.name} gagne !`
                : 'Personne ne gagne.',
        };
        if (mancheResult === 'CHIRE') return { main: '⚡ CHIRÉ !!', sub: 'Manche annulée, passage automatique.' };
        if (mancheResult === 'COCHON') return { main: '🐷 COCHON !', sub: 'Une manche de prestige !' };
        return {
            main: 'A POSÉ TOUS SES DOMINOS',
            sub: winnerId ? `${gameState.players.find(p => p.id === winnerId)?.name ?? 'Un joueur'} remporte la partie` : 'Victoire nette',
        };
    };

    const { main: titleMain, sub: titleSub } = getTitle();

    // ── Shared footer (rounds uniquement) ─────────────────────────────────────
    const renderFooter = () => {
        if (isMatchOver) return null; // Retiré à la demande : "enlenver les boutons en bas : Continuer"
        
        if (mancheResult === 'CHIRE') {
            return (
                <View style={styles.footer}>
                    <View style={[styles.actionBtn, styles.waitingBtn, styles.autoAdvanceBtn]}>
                        <Ionicons name="flash-outline" size={18} color="#FFD700" />
                        <Text style={[styles.actionBtnText, styles.autoAdvanceText]}>
                            {isHost
                                ? `Suite automatique${autoAdvanceSeconds ? ` dans ${autoAdvanceSeconds}s` : '...'}`
                                : "L'hôte lance automatiquement la suite..."}
                        </Text>
                    </View>
                </View>
            );
        }

        // Round / manche intermédiaire : bouton Continuer centré, ou attente
        return (
            <View style={styles.footer}>
                {isHost ? (
                    <TouchableOpacity style={styles.actionBtn} onPress={onContinue} activeOpacity={0.85}>
                        <Ionicons name="arrow-forward" size={18} color="#000" />
                        <Text style={styles.actionBtnText}>CONTINUER</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={[styles.actionBtn, styles.waitingBtn]}>
                        <Text style={[styles.actionBtnText, { color: 'rgba(255,255,255,0.45)' }]}>
                            En attente de l'hôte…
                        </Text>
                    </View>
                )}
            </View>
        );
    };

    // ── History content ────────────────────────────────────────────────────────
    const renderHistoryContent = () => {
        if (gameState.gameMode === 'VICTOIRE') {
            const sorted = [...gameState.players].sort((a, b) =>
                (b.totalRoundWins || 0) - (a.totalRoundWins || 0)
            );
            return (
                <ScrollView style={styles.historyScroll} showsVerticalScrollIndicator={false}>
                    <Text style={styles.historyObjectif}>
                        Objectif : {gameState.winningCondition} victoire{gameState.winningCondition > 1 ? 's' : ''}
                    </Text>
                    {sorted.map((p, idx) => {
                        const isWinnerRow = p.id === winnerId;
                        return (
                            <View key={p.id} style={[styles.historyRow, isWinnerRow && styles.historyRowWinner]}>
                                <Text style={styles.historyRank}>#{idx + 1}</Text>
                                <Text style={[styles.historyName, isWinnerRow && { color: '#FFD700' }]} numberOfLines={1}>
                                    {p.id === currentUserId ? 'Moi' : p.name}{isWinnerRow ? ' 👑' : ''}
                                </Text>
                                <Text style={[styles.historyScore, isWinnerRow && { color: '#FFD700' }]}>
                                    {p.totalRoundWins || 0} V
                                </Text>
                            </View>
                        );
                    })}
                </ScrollView>
            );
        }

        return (
            <ScrollView style={styles.historyScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.historyHeader}>
                    <Text style={[styles.historyCell, { width: 52 }]}>Manche</Text>
                    {gameState.players.map(p => (
                        <Text key={p.id}
                            style={[styles.historyCell, { flex: 1, color: p.id === currentUserId ? '#FFD700' : '#FFF' }]}
                            numberOfLines={1}>
                            {p.id === currentUserId ? 'Moi' : p.name}
                        </Text>
                    ))}
                </View>
                {gameState.mancheHistory?.map((h, idx) => (
                    <View key={idx} style={styles.historyRow}>
                        <Text style={[styles.historyCell, { width: 52 }]}>M{h.mancheNumber}</Text>
                        {gameState.players.map(p => (
                            <Text key={p.id} style={[styles.historyCell, { flex: 1, color: 'rgba(255,255,255,0.8)' }]}>
                                {h.points[p.id] || 0}
                            </Text>
                        ))}
                    </View>
                ))}
                {(!gameState.mancheHistory || gameState.mancheHistory.length === 0) && (
                    // Pas de manches complètes (ex: Mode Score objectif atteint dès le 1er round)
                    // → afficher un résumé basé sur les totaux des joueurs
                    <View style={styles.historyRow}>
                        <Text style={[styles.historyCell, { width: 52, color: 'rgba(255,255,255,0.4)' }]}>R1</Text>
                        {gameState.players.map(p => (
                            <Text key={p.id} style={[styles.historyCell, { flex: 1, color: 'rgba(255,255,255,0.8)' }]}>
                                {p.totalPoints || 0}
                            </Text>
                        ))}
                    </View>
                )}
                <View style={[styles.historyRow, styles.historyTotalRow]}>
                    <Text style={[styles.historyCell, { width: 52, color: '#FFD700', fontWeight: 'bold' }]}>TOTAL</Text>
                    {gameState.players.map(p => (
                        <Text key={p.id} style={[styles.historyCell, {
                            flex: 1, fontWeight: 'bold', fontSize: 16,
                            color: p.id === winnerId ? '#FFD700' : '#FFF',
                        }]}>
                            {p.totalPoints}
                        </Text>
                    ))}
                </View>
            </ScrollView>
        );
    };

    // ── Podium cards (shared between match end and round end) ──────────────────
    const renderPodiumCards = (showTotalScore: boolean) => (
        <View style={[styles.podiumRow, isLandscape && styles.podiumRowLandscape]}>
            {orderedPlayers.map((p, idx) => {
                const isWinner = p.id === winnerId;
                const delay = reducedMotion ? 0 : idx * 110;
                const entering = reducedMotion
                    ? undefined
                    : isWinner
                        ? BounceIn.delay(delay + 80).duration(550)
                        : FadeInDown.delay(delay).springify().damping(16);
                return (
                    <PlayerCard
                        key={p.id}
                        playerId={p.id}
                        playerName={p.name}
                        avatarId={p.avatarId}
                        grade={p.id === currentUserId && matchReward ? matchReward.newGrade : p.leagueGrade}
                        isWinner={isWinner}
                        scoreText={showTotalScore ? getPlayerTotalScore(p) : `${p.currentMancheStars || 0} ⭐`}
                        showCrown={isWinner}
                        showWinBadge={isWinner && showTotalScore}
                        entering={entering}
                        isLocalPlayer={p.id === currentUserId}
                    />
                );
            })}
        </View>
    );

    // ── MATCH END — main view (results + rewards inline) ──────────────────────
    const renderMatchEndMain = () => (
        <ScrollView style={{ width: '100%', flexShrink: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
            {/* ── Navigation haut : Actions (gauche) + Mode/Objectif (centre) + Détails (droite) ── */}
            <View style={styles.matchTopNav}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity 
                        style={{ alignItems: 'center' }}
                        onPress={onContinue}
                        activeOpacity={0.7}
                        accessibilityLabel="Retour à l'accueil"
                    >
                        <View style={styles.quitBtn}>
                            <Ionicons name="home" size={22} color="#FFF" />
                        </View>
                        <Text style={styles.topNavActionText}>Accueil</Text>
                    </TouchableOpacity>

                    {isSoloMode && onReplay && (
                        <TouchableOpacity 
                            style={{ alignItems: 'center' }}
                            onPress={onReplay}
                            activeOpacity={0.7}
                            accessibilityLabel="Rejouer"
                        >
                            <View style={[styles.quitBtn, { backgroundColor: 'rgba(255, 215, 0, 0.15)', borderColor: 'rgba(255, 215, 0, 0.4)', borderWidth: 1 }]}>
                                <Ionicons name="refresh" size={22} color="#FFD700" />
                            </View>
                            <Text style={styles.topNavActionText}>Rejouer</Text>
                        </TouchableOpacity>
                    )}

                    {isMeWinner && isMatchOver && (() => {
                        const me = gameState.players.find(p => p.id === currentUserId);
                        const winParams = {
                            playerName: me?.name ?? 'Mwen',
                            cochons: me?.totalCochonsInfliges ?? 0,
                            gradeLabel: matchReward?.newGrade
                                ? LEAGUE_LABELS[matchReward.newGrade]
                                : 'Sans grade',
                        };
                        return (
                            <View style={{ alignItems: 'center' }}>
                                <ShareTextButton
                                    text={buildWinShareText(winParams)}
                                    cardContent={<WinShareCard {...winParams} />}
                                    iconOnly={true}
                                    iconColor="#4ECDC4"
                                    iconSize={22}
                                    buttonStyle={[styles.quitBtn, { backgroundColor: 'rgba(78, 205, 196, 0.15)', borderColor: 'rgba(78, 205, 196, 0.4)', borderWidth: 1 }]}
                                />
                                <Text style={styles.topNavActionText}>Partager</Text>
                            </View>
                        );
                    })()}
                </View>

                <Text style={styles.matchModeLabel} numberOfLines={1}>
                    {getMatchModeLabel()}
                </Text>

                <TouchableOpacity 
                    style={{ alignItems: 'center' }}
                    onPress={() => setShowHistory(true)}
                    activeOpacity={0.7}
                    accessibilityLabel="Détails"
                >
                    <View style={[styles.quitBtn, { backgroundColor: 'rgba(255, 255, 255, 0.1)', borderColor: 'rgba(255, 255, 255, 0.3)', borderWidth: 1 }]}>
                        <Ionicons name="list" size={22} color="#FFF" />
                    </View>
                    <Text style={styles.topNavActionText}>Détails</Text>
                </TouchableOpacity>
            </View>

            {renderPodiumCards(true)}

            {matchReward && (
                <Animated.View
                    key="rewards-strip"
                    entering={reducedMotion ? undefined : FadeInUp.delay(480).duration(380)}
                    style={styles.rewardsStrip}
                >
                    <Text style={styles.rewardsStripLabel}>MES GAINS</Text>
                    <View style={styles.rewardsStripRow}>
                        <RewardChip icon="🪙" value={matchReward.coinsEarned} color="#FFD700" label="Coins" />
                        <RewardChip icon="🟢" value={matchReward.xpEarned} color="#4CAF50" label="XP" />
                        {matchReward.diamondsEarned > 0 && (
                            <RewardChip icon="💎" value={matchReward.diamondsEarned} color="#60DCFF" label="Diamants" />
                        )}
                        {matchReward.leaguePointsEarned > 0 && (
                            <RewardChip icon="🐷" value={matchReward.leaguePointsEarned} color="#FF9800" label="Ligue" />
                        )}
                    </View>
                </Animated.View>
            )}

            {/* Bouton "Partager ma victoire" supprimé (déplacé dans le header) */}

            {/* Bouton "Voir une pub" supprimé car déplacé dans une popup distincte (MatchRewardModal) */}
        </ScrollView>
    );

    // ── ROUND / MANCHE / BOUDE view ────────────────────────────────────────────
    const renderRoundView = () => (
        <ScrollView
            style={{ width: '100%', flexShrink: 1 }}
            contentContainerStyle={styles.roundScrollContent}
            showsVerticalScrollIndicator={false}
        >
            <Animated.View key="title-pill" entering={reducedMotion ? undefined : ZoomIn.duration(280)} style={styles.titlePill}>
                <Text style={styles.titlePillMain}>{titleMain}</Text>
                <Text style={styles.titlePillSub}>{titleSub}</Text>
            </Animated.View>
            {winnerId && mancheResult !== 'CHIRE' && mancheResult !== 'COCHON' && (
                <Animated.View entering={reducedMotion ? undefined : FadeInUp.delay(120).duration(260)} style={styles.roundHero}>
                    <View style={styles.roundHeroAvatarWrap}>
                        <Image
                            source={getAvatarImage((gameState.players.find(p => p.id === winnerId)?.avatarId as AvatarId) || 'avatar_default')}
                            style={styles.roundHeroAvatar}
                            contentFit="cover"
                        />
                        <Text style={styles.roundHeroCrown}>👑</Text>
                    </View>
                    <Text style={styles.roundHeroName}>
                        {gameState.players.find(p => p.id === winnerId)?.id === currentUserId
                            ? 'Moi'
                            : gameState.players.find(p => p.id === winnerId)?.name}
                    </Text>
                </Animated.View>
            )}
            {renderPodiumCards(false)}
        </ScrollView>
    );

    // ── Main render ────────────────────────────────────────────────────────────
    return (
        <View style={styles.container} pointerEvents="box-none">
            <Animated.View style={animatedBackdropStyle} />

            {/* Confettis — uniquement fin de match, tirés depuis le haut-centre */}
            {isMatchOver && (
                <ConfettiCannon
                    ref={confettiRef}
                    count={160}
                    origin={{ x: width / 2, y: -20 }}
                    autoStart
                    fallSpeed={4000}
                    explosionSpeed={350}
                    colors={['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD']}
                />
            )}
            <Animated.View style={[
                styles.panel,
                animatedPanelStyle,
                isLandscape ? styles.panelLandscape : styles.panelPortrait,
            ]}>

                {/* ── HISTORY VIEW ── */}
                {isMatchOver && showHistory ? (
                    <>
                        <View style={styles.historyViewHeader}>
                            <Text style={styles.historyViewTitle}>Détails des scores</Text>
                            <TouchableOpacity
                                onPress={() => setShowHistory(false)}
                                style={styles.historyCloseBtn}
                                hitSlop={{ top: 20, right: 20, bottom: 20, left: 20 }}
                            >
                                <Ionicons name="close-circle" size={32} color="rgba(255,255,255,0.8)" />
                            </TouchableOpacity>
                        </View>
                        {renderHistoryContent()}
                        {renderFooter()}
                    </>
                ) : (
                    <>
                        {isMatchOver ? renderMatchEndMain() : renderRoundView()}
                        {renderFooter()}
                    </>
                )}

            </Animated.View>
        </View>
    );
};

// ── RewardChip ─────────────────────────────────────────────────────────────────
const RewardChip: React.FC<{ icon: string; value: number; color: string; label: string }> = ({
    icon, value, color, label,
}) => (
    <View style={styles.rewardChip}>
        <Text style={styles.rewardChipIcon}>{icon}</Text>
        <Text style={[styles.rewardChipValue, { color }]}>+{value}</Text>
        <Text style={styles.rewardChipLabel}>{label}</Text>
    </View>
);

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },

    // Panel
    panel: {
        backgroundColor: 'rgba(5, 9, 5, 0.97)',
        borderRadius: 24,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 215, 0, 0.4)',
        elevation: 22,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.85,
        shadowRadius: 16,
        overflow: 'hidden',
    },
    panelPortrait: {
        width: '90%',
        maxHeight: '88%',
        paddingHorizontal: 14,
        paddingTop: 14,
        paddingBottom: 0,
    },
    panelLandscape: {
        width: '82%',
        maxHeight: '92%',
        paddingHorizontal: 18,
        paddingTop: 10,
        paddingBottom: 0,
    },
    roundScrollContent: {
        paddingBottom: 6,
    },

    // ── MATCH END: top nav ──
    matchTopNav: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 3,
        marginBottom: 2,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.07)',
    },
    matchModeLabel: {
        flex: 1,
        textAlign: 'center',
        color: 'rgba(255,255,255,0.6)',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        paddingHorizontal: 6,
    },

    // ── MATCH END: header ──
    matchHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 215, 0, 0.15)',
        marginBottom: 10,
    },
    matchTitleBlock: {
        flex: 1,
        paddingRight: 8,
    },
    matchTitleLabel: {
        fontSize: 11,
        fontWeight: '900',
        color: 'rgba(255,215,0,0.65)',
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    matchWinnerName: {
        fontSize: 20,
        fontWeight: '900',
        color: '#FFD700',
        marginTop: 2,
    },
    historyIconBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // ── PODIUM ──
    podiumRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-end',
        gap: 8,
        paddingVertical: 6,
    },
    podiumRowLandscape: {
        gap: 12,
    },
    podiumCard: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        minHeight: 130,
    },
    podiumCardWinner: {
        backgroundColor: 'rgba(255,215,0,0.11)',
        borderColor: '#FFD700',
        borderWidth: 2,
        minHeight: 155,
        elevation: 6,
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
    },
    podiumAvatarWrap: {
        position: 'relative',
        marginBottom: 8,
    },
    podiumAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.18)',
    },
    podiumAvatarWinner: {
        width: 58,
        height: 58,
        borderRadius: 29,
        borderColor: '#FFD700',
        borderWidth: 2.5,
    },
    crown: {
        position: 'absolute',
        top: -14,
        left: -10,
        fontSize: 22,
        transform: [{ rotate: '-15deg' }],
    },
    podiumName: {
        fontSize: 12,
        fontWeight: 'bold',
        color: 'rgba(255,255,255,0.65)',
        textAlign: 'center',
    },
    podiumNameWinner: {
        color: '#FFD700',
        fontSize: 14,
    },
    podiumScore: {
        fontSize: 15,
        fontWeight: '900',
        color: 'rgba(255,255,255,0.4)',
        marginTop: 5,
    },
    podiumScoreWinner: {
        color: '#FFD700',
        fontSize: 20,
    },
    podiumWinBadge: {
        backgroundColor: '#FFD700',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 2,
        marginTop: 6,
    },
    podiumWinBadgeText: {
        color: '#000',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 1.2,
    },

    // ── REWARDS STRIP ──
    rewardsStrip: {
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,215,0,0.15)',
        paddingTop: 10,
        paddingBottom: 6,
        marginTop: 6,
    },
    rewardsStripLabel: {
        fontSize: 9,
        fontWeight: '900',
        color: 'rgba(255,215,0,0.55)',
        letterSpacing: 2,
        textTransform: 'uppercase',
        textAlign: 'center',
        marginBottom: 8,
    },
    rewardsStripRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    rewardChip: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 7,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.12)',
        minWidth: 64,
    },
    rewardChipIcon: {
        fontSize: 18,
        marginBottom: 3,
    },
    rewardChipValue: {
        fontSize: 15,
        fontWeight: '900',
    },
    rewardChipLabel: {
        fontSize: 9,
        color: 'rgba(255,255,255,0.45)',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginTop: 2,
    },

    // ── TITLE PILL (round / manche) ──
    titlePill: {
        alignSelf: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,215,0,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.3)',
        borderRadius: 20,
        paddingHorizontal: 22,
        paddingVertical: 9,
        marginVertical: 10,
    },
    titlePillMain: {
        fontSize: 17,
        fontWeight: '900',
        color: '#FFD700',
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    titlePillSub: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginTop: 3,
    },
    roundHero: {
        alignItems: 'center',
        marginBottom: 10,
    },
    roundHeroAvatarWrap: {
        position: 'relative',
        marginBottom: 6,
    },
    roundHeroAvatar: {
        width: 76,
        height: 76,
        borderRadius: 38,
        borderWidth: 3,
        borderColor: '#FFD700',
    },
    roundHeroCrown: {
        position: 'absolute',
        top: -18,
        right: -10,
        fontSize: 28,
        textShadowColor: 'rgba(255,215,0,0.45)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
    roundHeroName: {
        color: '#FFD700',
        fontSize: 17,
        fontWeight: '900',
        textAlign: 'center',
    },

    // ── FOOTER ──
    footer: {
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.07)',
        marginTop: 6,
        alignItems: 'center',
    },
    footerSplit: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFD700',
        paddingVertical: 12,
        paddingHorizontal: 28,
        borderRadius: 30,
        gap: 8,
        minWidth: 200,
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.38,
        shadowRadius: 10,
        elevation: 7,
    },
    waitingBtn: {
        backgroundColor: '#2a2a2a',
        shadowOpacity: 0,
        elevation: 0,
    },
    autoAdvanceBtn: {
        minWidth: 260,
        backgroundColor: 'rgba(255,215,0,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.3)',
    },
    actionBtnText: {
        color: '#000',
        fontWeight: '900',
        fontSize: 13,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    autoAdvanceText: {
        color: '#FFD700',
        letterSpacing: 0.3,
    },
    quitBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
    },
    topNavActionText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 10,
        marginTop: 4,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    historyLinkBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    historyLinkText: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 13,
        fontWeight: '600',
        textDecorationLine: 'underline',
        textDecorationColor: 'rgba(255,255,255,0.35)',
    },

    // ── HISTORY VIEW ──
    historyViewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        marginBottom: 8,
    },
    historyCloseBtn: {
        padding: 4,
    },
    historyViewTitle: {
        flex: 1,
        textAlign: 'center',
        color: '#FFD700',
        fontWeight: '900',
        fontSize: 12,
        letterSpacing: 2.5,
        textTransform: 'uppercase',
    },
    historyObjectif: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 11,
        letterSpacing: 1,
        textTransform: 'uppercase',
        textAlign: 'center',
        marginBottom: 10,
    },
    historyScroll: {
        flexShrink: 1,
        width: '100%',
    },
    historyHeader: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.07)',
        padding: 8,
        borderRadius: 8,
        marginBottom: 4,
    },
    historyRow: {
        flexDirection: 'row',
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
    },
    historyRowWinner: {
        backgroundColor: 'rgba(255,215,0,0.07)',
    },
    historyTotalRow: {
        borderTopWidth: 2,
        borderColor: '#FFD700',
        marginTop: 6,
        paddingTop: 10,
    },
    historyCell: {
        textAlign: 'center',
        color: '#FFF',
        fontSize: 13,
    },
    historyRank: {
        width: 28,
        color: 'rgba(255,255,255,0.35)',
        fontSize: 12,
    },
    historyName: {
        flex: 1,
        color: '#FFF',
        fontSize: 13,
        fontWeight: 'bold',
    },
    historyScore: {
        width: 62,
        textAlign: 'right',
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    emptyHistory: {
        color: 'rgba(255,255,255,0.35)',
        fontStyle: 'italic',
        textAlign: 'center',
        padding: 30,
    },
});
