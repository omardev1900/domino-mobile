import React, { useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, useWindowDimensions, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, withTiming, useSharedValue, useAnimatedProps, Easing } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

import { statsService, MatchRecord, PlayerStats } from '../src/core/services/stats.service';
import { MatchHistory } from '../src/components/MatchHistory';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type StatsMode = 'MONTHLY' | 'TOTAL';

function WinRateCircle({ rate }: { rate: number }) {
    const size = 65;
    const strokeWidth = 6;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;

    const progress = useSharedValue(0);
    React.useEffect(() => {
        progress.value = withTiming(rate / 100, { duration: 1500, easing: Easing.out(Easing.cubic) });
    }, [rate, progress]);

    const animatedProps = useAnimatedProps(() => ({
        strokeDashoffset: circumference * (1 - progress.value),
    }));

    return (
        <View style={styles.winRateCircleWrap}>
            <Svg width={size} height={size}>
                <Defs>
                    <SvgGradient id="grad" x1="0" y1="0" x2="1" y2="1">
                        <Stop offset="0" stopColor="#FFD700" stopOpacity="1" />
                        <Stop offset="1" stopColor="#FF3366" stopOpacity="1" />
                    </SvgGradient>
                </Defs>
                <Circle stroke="rgba(255,255,255,0.1)" fill="none" cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} />
                <AnimatedCircle
                    stroke="url(#grad)"
                    fill="none"
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${circumference} ${circumference}`}
                    animatedProps={animatedProps}
                    strokeLinecap="round"
                    rotation="-90"
                    origin={`${size / 2}, ${size / 2}`}
                />
            </Svg>
            <View style={styles.winRateCircleValue}>
                <Text style={styles.winRateCircleText}>{rate}%</Text>
            </View>
        </View>
    );
}

type ScoreBreakdown = {
    p5: number;
    p4: number;
    p2: number;
    p1: number;
    m1: number;
};

type StatsSnapshot = {
    gamesPlayed: number;
    gamesWon: number;
    roundsWon: number;
    cochons: number;
    points: number;
    winRate: number;
    maxScore: number;
    maxCochons: number;
    breakdown: ScoreBreakdown;
    history: MatchRecord[];
};

const EMPTY_BREAKDOWN: ScoreBreakdown = { p5: 0, p4: 0, p2: 0, p1: 0, m1: 0 };

function getBreakdownFromHistory(history: MatchRecord[]): ScoreBreakdown {
    return history.reduce<ScoreBreakdown>((acc, match) => {
        const mancheResults = match.mancheLeaguePointsEarned && match.mancheLeaguePointsEarned.length > 0
            ? match.mancheLeaguePointsEarned
            : (typeof match.leaguePointsEarned === 'number' ? [match.leaguePointsEarned] : []);

        for (const pts of mancheResults) {
            if (pts === 5) acc.p5 += 1;
            else if (pts === 4) acc.p4 += 1;
            else if (pts === 2) acc.p2 += 1;
            else if (pts === 1) acc.p1 += 1;
            else if (pts === -1) acc.m1 += 1;
        }
        return acc;
    }, { ...EMPTY_BREAKDOWN });
}

function getStatsSnapshot(history: MatchRecord[], playerStats: PlayerStats, mode: StatsMode): StatsSnapshot {
    if (mode === 'MONTHLY') {
        const gamesPlayed = history.length;
        const gamesWon = history.filter((match) => match.result === 'WIN').length;
        const roundsWon = history.reduce((sum, match) => sum + (match.roundsWon ?? 0), 0);
        const cochons = history.reduce((sum, match) => sum + (match.cochons ?? 0), 0);
        const points = history.reduce((sum, match) => sum + (match.score ?? 0), 0);
        const maxScore = history.reduce((max, match) => Math.max(max, match.score || 0), 0);
        const maxCochons = history.reduce((max, match) => Math.max(max, match.cochons || 0), 0);

        return {
            gamesPlayed,
            gamesWon,
            roundsWon,
            cochons,
            points,
            winRate: gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0,
            maxScore,
            maxCochons,
            breakdown: getBreakdownFromHistory(history),
            history,
        };
    }

    return {
        gamesPlayed: playerStats.gamesPlayed,
        gamesWon: playerStats.gamesWon,
        roundsWon: playerStats.totalRoundsWon,
        cochons: playerStats.totalCochonsInflicted || 0,
        points: playerStats.totalPointsAccumulated,
        winRate: playerStats.gamesPlayed > 0 ? Math.round((playerStats.gamesWon / playerStats.gamesPlayed) * 100) : 0,
        maxScore: history.reduce((max, match) => Math.max(max, match.score || 0), 0),
        maxCochons: history.reduce((max, match) => Math.max(max, match.cochons || 0), 0),
        breakdown: {
            p5: playerStats.totalLeague5Pts ?? 0,
            p4: playerStats.totalLeague4Pts ?? 0,
            p2: playerStats.totalLeague2Pts ?? 0,
            p1: playerStats.totalLeague1Pt ?? 0,
            m1: playerStats.totalLeagueMinus1Pt ?? 0,
        },
        history,
    };
}

export default function StatsScreen() {
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();
    const isLandscape = width > height;

    const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [historyModalVisible, setHistoryModalVisible] = useState(false);
    const [activeMode, setActiveMode] = useState<StatsMode>('MONTHLY');

    useFocusEffect(
        useCallback(() => {
            loadPlayerStats();

        }, [])
    );

    const monthlyHistory = useMemo(() => {
        if (!playerStats?.matchHistory) return [];
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        return playerStats.matchHistory.filter((match) => match.timestamp >= startOfMonth);
    }, [playerStats?.matchHistory]);

    const activeSnapshot = useMemo(() => {
        if (!playerStats) return null;
        return getStatsSnapshot(
            activeMode === 'MONTHLY' ? monthlyHistory : playerStats.matchHistory || [],
            playerStats,
            activeMode
        );
    }, [activeMode, monthlyHistory, playerStats]);

    const loadPlayerStats = async () => {
        setIsLoading(true);
        try {
            const stats = await statsService.getStats();
            setPlayerStats(stats);
        } catch (error) {
            console.error('Failed to load stats', error);
        } finally {
            setIsLoading(false);
        }
    };

    const periodLabel = useMemo(() => {
        if (activeMode === 'MONTHLY') {
            return new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        }
        return 'Depuis le début';
    }, [activeMode]);

    const renderHeader = () => (
        <View style={[styles.header, { paddingTop: insets.top || 10 }]}>
            <Text style={styles.headerTitle}>MES STATS</Text>
            
            <View style={styles.headerCenter}>
                {renderModeSwitch()}
            </View>

            <TouchableOpacity
                style={styles.historyButton}
                onPress={() => setHistoryModalVisible(true)}
                activeOpacity={0.7}
            >
                <Text style={styles.historyIcon}>🕒</Text>
                {playerStats?.matchHistory && playerStats.matchHistory.length > 0 && (
                    <View style={styles.historyBadge}>
                        <Text style={styles.historyBadgeText}>{playerStats.matchHistory.length}</Text>
                    </View>
                )}
            </TouchableOpacity>
        </View>
    );

    const renderModeSwitch = () => (
        <View style={styles.modeSwitchWrap}>
            {([
                { key: 'MONTHLY', label: 'Ce mois-ci' },
                { key: 'TOTAL', label: 'Cumulé' },
            ] as { key: StatsMode; label: string }[]).map((mode) => {
                const active = mode.key === activeMode;
                return (
                    <TouchableOpacity
                        key={mode.key}
                        style={[styles.modeButton, active && styles.modeButtonActive]}
                        onPress={() => setActiveMode(mode.key)}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.modeButtonText, active && styles.modeButtonTextActive]}>
                            {mode.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );

    const renderSummaryBlock = () => {
        if (!activeSnapshot) return null;

        const isMonthly = activeMode === 'MONTHLY';
        const rows = [
            { pts: '5 PTS', label: 'DOUBLE COCHON', color: '#FFD700', icon: '⭐', count: activeSnapshot.breakdown.p5 },
            { pts: '4 PTS', label: 'SIMPLE COCHON', color: '#FF8C00', icon: '🟠', count: activeSnapshot.breakdown.p4 },
            { pts: '2 PTS', label: 'DOMINO', color: '#4FC3F7', icon: '🔵', count: activeSnapshot.breakdown.p2 },
            { pts: '1 PT', label: 'VICTOIRE SIMPLE', color: '#9E9E9E', icon: '⚪', count: activeSnapshot.breakdown.p1 },
            { pts: '-1 PT', label: 'COCHON PRIS', color: '#FF3366', icon: '🔴', count: activeSnapshot.breakdown.m1 },
        ];

        return (
            <Animated.View entering={FadeInUp.delay(100).duration(500)} style={[styles.bloc, styles.blocA]}>
                <View style={styles.monthHeader}>
                    <Text style={styles.monthTitle}>
                        {isMonthly ? 'STATISTIQUES DU MOIS' : 'APERÇU CUMULÉ'}
                    </Text>
                    <Text style={styles.monthSub}>
                        {periodLabel} · {activeSnapshot.gamesPlayed} match{activeSnapshot.gamesPlayed !== 1 ? 's' : ''}
                    </Text>
                </View>

                <View style={styles.statsRows}>
                    {rows.map((row) => (
                        <View key={`${activeMode}-${row.label}`} style={[styles.statRow, { borderColor: `${row.color}30` }]}>
                            <Text style={styles.statRowIcon}>{row.icon}</Text>
                            <View style={styles.statRowTexts}>
                                <Text style={[styles.statRowPts, { color: row.color }]}>{row.pts}</Text>
                                <Text style={styles.statRowLabel}>{row.label}</Text>
                            </View>
                            <Text style={[styles.statRowCount, { color: row.color }]}>{row.count}</Text>
                        </View>
                    ))}
                </View>

                {activeSnapshot.gamesPlayed === 0 && (
                    <Text style={styles.monthEmpty}>
                        {isMonthly ? 'Jouez une partie ce mois-ci pour voir vos stats ici 🎮' : 'Aucune statistique disponible pour le moment'}
                    </Text>
                )}
            </Animated.View>
        );
    };

    const renderPerformanceBlock = () => {
        if (!activeSnapshot) return null;

        return (
            <Animated.View entering={FadeInUp.delay(200).duration(500)} style={[styles.bloc, styles.blocB]}>
                <View style={styles.winRateRow}>
                    <WinRateCircle rate={activeSnapshot.winRate} />
                    <View style={styles.winRateInfos}>
                        <Text style={styles.winRateTitle}>
                            {activeMode === 'MONTHLY' ? 'TAUX DE VICTOIRE DU MOIS' : 'TAUX DE VICTOIRE GLOBAL'}
                        </Text>
                        <Text style={styles.winRateSub}>
                            {activeSnapshot.gamesWon} / {activeSnapshot.gamesPlayed} matchs gagnés
                        </Text>
                    </View>
                </View>

                <View style={styles.separator} />

                <View style={styles.statLine}>
                    <Text style={styles.statLineIcon}>🐷</Text>
                    <Text style={styles.statLineLabel}>
                        {activeMode === 'MONTHLY' ? 'COCHONS DU MOIS' : 'COCHONS (LIGUE)'}
                    </Text>
                    <View style={styles.statLineDotted} />
                    <Text style={[styles.statLineValue, { color: '#FF3366' }]}>{activeSnapshot.cochons.toLocaleString()}</Text>
                </View>

                <View style={styles.statLine}>
                    <Text style={styles.statLineIcon}>✨</Text>
                    <Text style={styles.statLineLabel}>
                        {activeMode === 'MONTHLY' ? 'POINTS DU MOIS' : 'TOTAL POINTS'}
                    </Text>
                    <View style={styles.statLineDotted} />
                    <Text style={[styles.statLineValue, { color: '#FFD700' }]}>{activeSnapshot.points.toLocaleString()}</Text>
                </View>

                <View style={styles.recordsSection}>
                    <Text style={styles.recordsTitle}>
                        {activeMode === 'MONTHLY' ? 'RECORDS DU MOIS' : 'RECORDS (SUR LES 100 DERNIERS MATCHS)'}
                    </Text>
                    <View style={styles.recordsCards}>
                        <View style={styles.recordCard}>
                            <Text style={styles.recordCardValue}>{activeSnapshot.maxScore}</Text>
                            <Text style={styles.recordCardLabel}>Max Pts</Text>
                        </View>
                        <View style={styles.recordCard}>
                            <Text style={[styles.recordCardValue, { color: '#FF3366' }]}>{activeSnapshot.maxCochons}</Text>
                            <Text style={styles.recordCardLabel}>Max Cochons</Text>
                        </View>
                    </View>
                </View>
            </Animated.View>
        );
    };

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#1a0505', '#2a0a0a']} style={StyleSheet.absoluteFillObject} />

            {renderHeader()}

            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Chargement...</Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <View style={[styles.contentLayout, !isLandscape && { flexDirection: 'column' }]}>
                        {renderSummaryBlock()}
                        {renderPerformanceBlock()}
                    </View>
                </ScrollView>
            )}

            <Modal
                visible={historyModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setHistoryModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, isLandscape && styles.modalContentLandscape]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Historique des Matchs</Text>
                            <TouchableOpacity onPress={() => setHistoryModalVisible(false)} style={styles.modalCloseButton}>
                                <Ionicons name="close-circle" size={30} color="#FFD700" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.modalInfoBanner}>
                            <Ionicons name="information-circle" size={16} color="#60DCFF" style={{ marginRight: 6 }} />
                            <Text style={styles.modalInfoText}>
                                Sur la base des 100 derniers matchs.
                            </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <MatchHistory history={playerStats?.matchHistory || []} />
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a0505',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 10,
        backgroundColor: 'rgba(26,5,5,0.9)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,215,0,0.1)',
        zIndex: 10,
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 10,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 2,
        textTransform: 'uppercase',
    },
    historyButton: {
        width: 30,
        alignItems: 'flex-end',
        justifyContent: 'center',
        position: 'relative',
    },
    historyIcon: {
        fontSize: 24,
    },
    historyBadge: {
        position: 'absolute',
        top: -5,
        right: -2,
        backgroundColor: '#FF3366',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    historyBadgeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    modeSwitchWrap: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.14)',
        overflow: 'hidden',
    },
    modeButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    modeButtonActive: {
        backgroundColor: 'rgba(255,215,0,0.16)',
    },
    modeButtonText: {
        color: 'rgba(255,255,255,0.45)',
        fontSize: 12,
        fontWeight: '800',
    },
    modeButtonTextActive: {
        color: '#FFD700',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#FFD700',
        fontSize: 16,
    },
    contentLayout: {
        flex: 1,
        flexDirection: 'row',
        padding: 8,
        gap: 8,
    },
    scrollContent: {
        flexGrow: 1,
    },
    bloc: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.15)',
        padding: 10,
        justifyContent: 'space-between',
    },
    blocA: {},
    blocB: {
        justifyContent: 'space-evenly',
    },
    monthHeader: {
        marginBottom: 10,
        alignItems: 'center',
    },
    monthTitle: {
        color: '#FFD700',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        textAlign: 'center',
    },
    monthSub: {
        color: 'rgba(255,255,255,0.35)',
        fontSize: 10,
        marginTop: 2,
        textAlign: 'center',
    },
    statsRows: {
        flex: 1,
        gap: 4,
        justifyContent: 'center',
    },
    statRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 10,
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 5,
        gap: 10,
    },
    statRowIcon: {
        fontSize: 16,
        width: 22,
        textAlign: 'center',
    },
    statRowTexts: {
        flex: 1,
        gap: 1,
    },
    statRowPts: {
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    statRowLabel: {
        fontSize: 9,
        color: 'rgba(255,255,255,0.45)',
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    statRowCount: {
        fontSize: 22,
        fontWeight: '900',
        minWidth: 32,
        textAlign: 'right',
    },
    monthEmpty: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 11,
        textAlign: 'center',
        fontStyle: 'italic',
        marginTop: 8,
    },
    winRateCircleWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        width: 65,
        height: 65,
    },
    winRateCircleValue: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    winRateCircleText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '900',
    },
    statLine: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 10,
        marginBottom: 6,
    },
    statLineIcon: {
        fontSize: 20,
        marginRight: 8,
        width: 25,
        textAlign: 'center',
    },
    statLineLabel: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.7)',
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    statLineDotted: {
        flex: 1,
        borderBottomWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderStyle: 'dashed',
        marginHorizontal: 8,
        position: 'relative',
        top: 6,
    },
    statLineValue: {
        fontSize: 18,
        fontWeight: '900',
        color: '#FFF',
    },
    separator: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginVertical: 10,
    },
    winRateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 5,
    },
    winRateInfos: {
        marginLeft: 15,
        flex: 1,
    },
    winRateTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: '#FFF',
        letterSpacing: 1,
        marginBottom: 4,
    },
    winRateSub: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
        marginBottom: 2,
    },
    recordsSection: {
        marginTop: 10,
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 12,
        padding: 10,
    },
    recordsTitle: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.5)',
        fontWeight: 'bold',
        letterSpacing: 1,
        marginBottom: 8,
        textAlign: 'center',
    },
    recordsCards: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 15,
    },
    recordCard: {
        alignItems: 'center',
        backgroundColor: 'rgba(255,215,0,0.05)',
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 8,
        minWidth: 80,
    },
    recordCardValue: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFF',
        paddingBottom: 2,
    },
    recordCardLabel: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.7)',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#1a0505',
        width: '90%',
        height: '80%',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#FFD700',
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#FFD700',
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    modalContentLandscape: {
        width: '80%',
        height: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,215,0,0.2)',
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    modalInfoBanner: {
        flexDirection: 'row',
        backgroundColor: 'rgba(96,220,255,0.1)',
        padding: 10,
        margin: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    modalInfoText: {
        flex: 1,
        color: 'rgba(255,255,255,0.8)',
        fontSize: 11,
        fontStyle: 'italic',
        lineHeight: 16,
    },
    modalTitle: {
        color: '#FFD700',
        fontSize: 18,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    modalCloseButton: {
        padding: 5,
    },
});
