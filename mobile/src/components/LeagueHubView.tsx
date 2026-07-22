import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeInUp } from 'react-native-reanimated';

import {
    LEAGUE_THRESHOLDS,
    LEAGUE_ICONS,
    LEAGUE_LABELS,
    LEAGUE_FRAME_REWARDS,
    LEAGUE_GRADE_ORDER,
} from '../core/economy.constants';
import { getLeagueGrade } from '../core/RewardEngine';
import { LeagueGrade } from '../core/economy.types';
import { statsService } from '../core/services/stats.service';
import { leaderboardService, LeaderboardEntry } from '../core/services/leaderboard.service';
import { authService } from '../core/services/auth.service';
import { getAvatarImage } from '../core/avatars';
import { getLeagueProgress, getMonthlyCochonsFromHistory } from '../core/leagueProgress';
import { ShareTextButton, buildGradeShareText } from './ShareButton';

type TabType = 'MA_LIGUE' | 'CLASSEMENT_MOIS' | 'CLASSEMENT_GLOBAL';
export type LeagueHubTabType = TabType;
type ClassementCategory = 'PLUS_COCHONS' | 'MOINS_COCHONS' | 'PLUS_POINTS';
type ClassementMode = 'TOTAL' | 'PERF';

const CATEGORY_CONFIG: Record<ClassementCategory, { label: string; icon: string; color: string; sublabel: string }> = {
    PLUS_COCHONS: { label: '+ Cochons', icon: '🐷', color: '#FF8C00', sublabel: 'cochons infligés' },
    MOINS_COCHONS: { label: '- Cochons', icon: '🛡️', color: '#4FC3F7', sublabel: 'cochons subis' },
    PLUS_POINTS: { label: '+ Points', icon: '⭐', color: '#FFD700', sublabel: 'points cumulés' },
};

const tierTheme = (grade: LeagueGrade) => {
    if (grade.startsWith('APPRENTI')) {
        return { tint: '#9E9E9E', bg: 'rgba(158,158,158,0.05)', border: 'rgba(158,158,158,0.22)' };
    }
    if (grade.startsWith('MAITRE')) {
        return { tint: '#FFD700', bg: 'rgba(255,215,0,0.05)', border: 'rgba(255,215,0,0.22)' };
    }
    if (grade === 'ROI') {
        return { tint: '#4FC3F7', bg: 'rgba(79,195,247,0.05)', border: 'rgba(79,195,247,0.28)' };
    }
    return { tint: '#FF5252', bg: 'rgba(255,82,82,0.05)', border: 'rgba(255,82,82,0.28)' };
};

interface LeagueHubViewProps {
    activeTab?: TabType;
    onActiveTabChange?: (tab: TabType) => void;
    hidePrimaryTabs?: boolean;
}

export const LeagueHubView: React.FC<LeagueHubViewProps> = ({
    activeTab: controlledActiveTab,
    onActiveTabChange,
    hidePrimaryTabs = false,
}) => {
    const [internalActiveTab, setInternalActiveTab] = useState<TabType>('MA_LIGUE');
    const [leaguePoints, setLeaguePoints] = useState(0);
    const [classementCategory, setClassementCategory] = useState<ClassementCategory>('PLUS_COCHONS');
    const [classementMode, setClassementMode] = useState<ClassementMode>('TOTAL');
    const [showAllPlayers, setShowAllPlayers] = useState(false);
    const [allEntries, setAllEntries] = useState<LeaderboardEntry[]>([]);
    const [classementLoading, setClassementLoading] = useState(false);
    const [currentUid, setCurrentUid] = useState<string | null>(null);
    const classementUnsubRef = useRef<(() => void) | null>(null);
    const activeTab = controlledActiveTab ?? internalActiveTab;

    const handleTabChange = (tab: TabType) => {
        if (onActiveTabChange) {
            onActiveTabChange(tab);
            return;
        }
        setInternalActiveTab(tab);
    };

    useEffect(() => {
        statsService.getStats().then((stats) => {
            setLeaguePoints(getMonthlyCochonsFromHistory(stats.matchHistory));
        });
        authService.getCurrentUser().then((user) => setCurrentUid(user?.uid ?? null));
    }, []);

    useEffect(() => {
        const isClassementTab = activeTab === 'CLASSEMENT_MOIS' || activeTab === 'CLASSEMENT_GLOBAL';
        
        // Unsubscribe the previous listener if any
        classementUnsubRef.current?.();
        classementUnsubRef.current = null;

        if (!isClassementTab) {
            return;
        }

        setClassementLoading(true);

        const callback = (entries: LeaderboardEntry[]) => {
            setAllEntries(entries);
            setClassementLoading(false);
        };

        if (activeTab === 'CLASSEMENT_MOIS') {
            classementUnsubRef.current = leaderboardService.subscribeLeagueClassementMonthly(
                classementCategory,
                callback
            );
        } else {
            classementUnsubRef.current = leaderboardService.subscribeLeagueClassementGlobal(
                classementCategory,
                callback
            );
        }

        return () => {
            classementUnsubRef.current?.();
            classementUnsubRef.current = null;
        };
    }, [activeTab, classementCategory]);

    const progress = useMemo(() => getLeagueProgress(leaguePoints), [leaguePoints]);

    const renderMaLigue = () => {
        const currentIndex = progress.grade ? LEAGUE_GRADE_ORDER.indexOf(progress.grade) : -1;
        const tierCardWidth = '31%';

        return (
            <ScrollView style={styles.maLigueScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.maLigueContent}>
                <Animated.View entering={FadeInUp.duration(420)} style={styles.leagueIntroCard}>
                    <Text style={styles.leagueIntroEmoji}>🏆</Text>
                    <Text style={styles.leagueIntroTitle}>
                        {leaguePoints === 0
                            ? 'Donnez votre premier cochon !'
                            : `${leaguePoints.toLocaleString()} cochon${leaguePoints > 1 ? 's' : ''} du mois`}
                    </Text>
                    <Text style={styles.leagueIntroSubtitle}>
                        {progress.nextThreshold != null
                            ? `Plus que ${progress.remainingToNext} cochon${progress.remainingToNext > 1 ? 's' : ''} pour le prochain palier`
                            : 'Vous avez atteint le grade maximum du mois'}
                    </Text>
                    <View style={styles.leagueProgressPill}>
                        <Text style={styles.leagueProgressPillText}>
                            {progress.nextThreshold != null
                                ? `${leaguePoints} / ${progress.nextThreshold} 🐷 vers le prochain palier`
                                : `${leaguePoints} 🐷 • grade maximum`}
                        </Text>
                    </View>
                    {progress.grade && (
                        <View style={{ marginTop: 12, width: '100%', alignItems: 'center' }}>
                            <ShareTextButton 
                                text={buildGradeShareText({ gradeLabel: LEAGUE_LABELS[progress.grade], totalCochons: leaguePoints })}
                                label="Inviter au défi"
                                buttonStyle={styles.shareBtnCompact}
                                iconSize={14}
                            />
                        </View>
                    )}
                </Animated.View>

                <View style={styles.monthlyGradeCard}>
                    <View style={styles.monthlyGradeHeader}>
                        <Text style={styles.monthlyGradeHeaderValue}>
                            {progress.grade ? LEAGUE_ICONS[progress.grade] : '🥉'} {progress.grade ? LEAGUE_LABELS[progress.grade] : 'Sans grade'}
                        </Text>
                    </View>
                    <View style={styles.progressLabels}>
                        <Text style={styles.progressBound}>{progress.previousThreshold}</Text>
                        {progress.nextThreshold != null && progress.nextGrade ? (
                            <Text style={styles.progressCenter}>→ {LEAGUE_LABELS[progress.nextGrade]} ({progress.nextThreshold} 🐷)</Text>
                        ) : (
                            <Text style={styles.progressCenter}>Grade maximum 🔥</Text>
                        )}
                        <Text style={styles.progressBound}>{progress.nextThreshold ?? '∞'}</Text>
                    </View>
                    <View style={styles.monthlyProgressTrack}>
                        <View style={[styles.monthlyProgressFill, { width: `${Math.max(2, Math.round(progress.progressPercent * 100))}%` }]} />
                    </View>
                </View>

                <Text style={styles.paliersTitle}>PALIERS DU MOIS</Text>
                <View style={styles.tiersGrid}>
                    {LEAGUE_GRADE_ORDER.map((grade, index) => {
                        const isUnlocked = index <= currentIndex;
                        const isCurrent = grade === progress.grade;
                        const theme = tierTheme(grade);
                        const threshold = LEAGUE_THRESHOLDS[grade];
                        const rewardLabel = grade === 'DEBUTANT'
                            ? 'Grade seul'
                            : `+${LEAGUE_FRAME_REWARDS[grade].coinsBonus.toLocaleString()} coins`;

                        return (
                            <Animated.View
                                key={grade}
                                entering={FadeInUp.delay(index * 50).duration(280)}
                                style={[
                                    styles.tierCard,
                                    { width: tierCardWidth },
                                    isUnlocked && {
                                        backgroundColor: theme.bg,
                                        borderColor: theme.border,
                                        shadowColor: theme.tint,
                                    },
                                    isUnlocked ? styles.tierCardUnlocked : styles.tierCardLocked,
                                    isCurrent && styles.tierCardActive,
                                ]}
                            >
                                {isCurrent ? (
                                    <View style={styles.activeBadge}>
                                        <Text style={styles.activeBadgeText}>ACTUEL</Text>
                                    </View>
                                ) : null}
                                <Text style={[styles.tierGradeIcon, !isUnlocked && styles.tierGradeIconLocked]}>
                                    {isUnlocked ? LEAGUE_ICONS[grade] : '🔒'}
                                </Text>
                                <Text style={[styles.tierThreshold, { color: isUnlocked ? theme.tint : 'rgba(255,255,255,0.4)' }]}>
                                    {threshold} 🐷
                                </Text>
                                <Text style={[styles.tierLabel, { color: isUnlocked ? '#FFFFFF' : 'rgba(255,255,255,0.5)' }]}>
                                    {LEAGUE_LABELS[grade]}
                                </Text>
                                <View style={[styles.rewardBadge, { borderColor: isUnlocked ? theme.border : 'rgba(255,255,255,0.12)' }]}>
                                    <Text
                                        style={[styles.rewardBadgeText, { color: isUnlocked ? theme.tint : 'rgba(255,255,255,0.4)' }]}
                                        numberOfLines={1}
                                        adjustsFontSizeToFit
                                        minimumFontScale={0.75}
                                    >
                                        {rewardLabel}
                                    </Text>
                                </View>
                            </Animated.View>
                        );
                    })}
                </View>

            </ScrollView>
        );
    };

    const renderClassement = (scope: 'MONTHLY' | 'GLOBAL') => {
        const cfg = CATEGORY_CONFIG[classementCategory];
        const isPerfMode = classementMode === 'PERF';
        const isMonthlyScope = scope === 'MONTHLY';

        const getGamesPlayed = (entry: LeaderboardEntry) => isMonthlyScope ? entry.gamesPlayedThisMonth : entry.gamesPlayed;
        const getCochonsGiven = (entry: LeaderboardEntry) => isMonthlyScope ? entry.cochonsGivenThisMonth : entry.cochonsGiven;
        const getCochonsSubis = (entry: LeaderboardEntry) => isMonthlyScope ? entry.totalCochonsSubisThisMonth : entry.totalCochonsSubis;
        const getPointsAccumulated = (entry: LeaderboardEntry) => isMonthlyScope ? entry.totalPointsAccumulatedThisMonth : entry.totalPointsAccumulated;

        const qualifiesForPerf = (entry: LeaderboardEntry) => getGamesPlayed(entry) >= 10;

        const getPerformanceValue = (entry: LeaderboardEntry): number => {
            const gamesPlayed = getGamesPlayed(entry);
            if (gamesPlayed <= 0) {
                return classementCategory === 'MOINS_COCHONS' ? Number.POSITIVE_INFINITY : 0;
            }
            if (classementCategory === 'PLUS_COCHONS') return getCochonsGiven(entry) / gamesPlayed;
            if (classementCategory === 'MOINS_COCHONS') return getCochonsSubis(entry) / gamesPlayed;
            return getPointsAccumulated(entry) / gamesPlayed;
        };

        const sourceEntries = isPerfMode
            ? (showAllPlayers ? allEntries : allEntries.filter(qualifiesForPerf))
            : allEntries;

        const fullSorted = [...sourceEntries].sort((a, b) => {
            const aGames = getGamesPlayed(a);
            const bGames = getGamesPlayed(b);
            const aCochons = getCochonsGiven(a);
            const bCochons = getCochonsGiven(b);
            const aSubis = getCochonsSubis(a);
            const bSubis = getCochonsSubis(b);
            const aPoints = getPointsAccumulated(a);
            const bPoints = getPointsAccumulated(b);

            if (isPerfMode) {
                const aQualified = qualifiesForPerf(a);
                const bQualified = qualifiesForPerf(b);
                if (showAllPlayers && aQualified !== bQualified) return aQualified ? -1 : 1;

                if (classementCategory === 'MOINS_COCHONS') {
                    const diff = getPerformanceValue(a) - getPerformanceValue(b);
                    if (diff !== 0) return diff;
                    const tieByCochons = aSubis - bSubis;
                    if (tieByCochons !== 0) return tieByCochons;
                    return bGames - aGames;
                }

                const diff = getPerformanceValue(b) - getPerformanceValue(a);
                if (diff !== 0) return diff;

                if (classementCategory === 'PLUS_COCHONS') {
                    const tieByCochons = bCochons - aCochons;
                    if (tieByCochons !== 0) return tieByCochons;
                } else {
                    const tieByPoints = bPoints - aPoints;
                    if (tieByPoints !== 0) return tieByPoints;
                }
                return bGames - aGames;
            }

            if (classementCategory === 'PLUS_COCHONS') {
                const diff = bCochons - aCochons;
                return diff !== 0 ? diff : bGames - aGames;
            }
            if (classementCategory === 'MOINS_COCHONS') {
                const aHasMatches = aGames > 0;
                const bHasMatches = bGames > 0;
                if (aHasMatches !== bHasMatches) return aHasMatches ? -1 : 1;
                const diff = aSubis - bSubis;
                return diff !== 0 ? diff : bGames - aGames;
            }
            const diff = bPoints - aPoints;
            return diff !== 0 ? diff : bGames - aGames;
        });

        const sorted = fullSorted.slice(0, 30);
        const myIndex = fullSorted.findIndex(e => e.uid === currentUid);
        const myRank = myIndex !== -1 ? myIndex + 1 : null;
        const myEntry = myIndex !== -1 ? fullSorted[myIndex] : null;

        const rankColor = (rank: number) => {
            if (rank === 1) return '#FFD700';
            if (rank === 2) return '#C0C0C0';
            if (rank === 3) return '#CD7F32';
            return 'rgba(255,255,255,0.25)';
        };

        const getEntryScore = (entry: LeaderboardEntry): string => {
            if (isPerfMode) {
                const perf = getPerformanceValue(entry);
                return Number.isFinite(perf) ? perf.toFixed(2) : '—';
            }
            if (classementCategory === 'PLUS_COCHONS') return `${getCochonsGiven(entry).toLocaleString()}`;
            if (classementCategory === 'MOINS_COCHONS') return `${getCochonsSubis(entry).toLocaleString()}`;
            return `${getPointsAccumulated(entry).toLocaleString()}`;
        };

        const getEntryMeta = (entry: LeaderboardEntry): string => {
            const gamesPlayed = getGamesPlayed(entry);
            const matchesLabel = `${gamesPlayed} match${gamesPlayed > 1 ? 's' : ''}`;
            if (!isPerfMode) return matchesLabel;
            if (classementCategory === 'PLUS_COCHONS') return `${getCochonsGiven(entry).toLocaleString()} cochons en ${matchesLabel}`;
            if (classementCategory === 'MOINS_COCHONS') return `${getCochonsSubis(entry).toLocaleString()} cochons subis en ${matchesLabel}`;
            return `${getPointsAccumulated(entry).toLocaleString()} points en ${matchesLabel}`;
        };

        return (
            <View style={{ flex: 1 }}>
                {classementLoading ? (
                    <View style={styles.clsCenter}>
                        <ActivityIndicator color="#FFD700" size="large" />
                        <Text style={styles.clsLoadText}>Chargement...</Text>
                    </View>
                ) : sorted.length === 0 ? (
                    <View style={styles.clsCenter}>
                        <Text style={styles.clsEmpty}>
                            {isPerfMode ? 'Aucun joueur qualifié pour ce classement.' : "Aucun joueur pour l'instant."}
                        </Text>
                    </View>
                ) : (
                    <View style={styles.classementLayout}>
                        <View style={styles.classementSidebar}>
                            {(Object.keys(CATEGORY_CONFIG) as ClassementCategory[]).map((cat) => {
                                const catCfg = CATEGORY_CONFIG[cat];
                                const active = cat === classementCategory;
                                return (
                                    <View key={cat} style={styles.sidebarBlock}>
                                        <TouchableOpacity
                                            style={[styles.sidebarCategoryBtn, active && { borderColor: catCfg.color, backgroundColor: `${catCfg.color}18` }]}
                                            onPress={() => setClassementCategory(cat)}
                                        >
                                            <Text style={styles.sidebarCategoryIcon}>{catCfg.icon}</Text>
                                            <Text style={[styles.sidebarCategoryText, { color: active ? catCfg.color : 'rgba(255,255,255,0.52)' }]}>
                                                {catCfg.label}
                                            </Text>
                                        </TouchableOpacity>

                                        {active ? (
                                            <>
                                                <View style={styles.sidebarModeSwitch}>
                                                    {(['TOTAL', 'PERF'] as ClassementMode[]).map((mode) => {
                                                        const modeActive = mode === classementMode;
                                                        return (
                                                            <TouchableOpacity
                                                                key={mode}
                                                                style={[styles.sidebarModeBtn, modeActive && styles.sidebarModeBtnActive]}
                                                                onPress={() => {
                                                                    setClassementMode(mode);
                                                                    if (mode === 'TOTAL') setShowAllPlayers(false);
                                                                }}
                                                            >
                                                                <Text style={[styles.sidebarModeBtnText, modeActive && styles.sidebarModeBtnTextActive]}>
                                                                    {mode === 'TOTAL' ? 'Total' : 'Perf'}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        );
                                                    })}
                                                </View>

                                                {isPerfMode ? (
                                                    <>
                                                        <TouchableOpacity
                                                            style={[styles.sidebarShowAllBtn, showAllPlayers && styles.sidebarShowAllBtnActive]}
                                                            onPress={() => setShowAllPlayers((prev) => !prev)}
                                                        >
                                                            <Text style={[styles.sidebarShowAllText, showAllPlayers && styles.sidebarShowAllTextActive]}>
                                                                Tous
                                                            </Text>
                                                        </TouchableOpacity>
                                                        <Text style={styles.sidebarPerfHint}>10+ matchs</Text>
                                                    </>
                                                ) : null}
                                            </>
                                        ) : null}
                                    </View>
                                );
                            })}
                        </View>

                        <View style={{ flex: 1 }}>
                            {myEntry ? (() => {
                                const rc = rankColor(myRank!);
                                const grade = isMonthlyScope ? (getLeagueGrade(myEntry.cochonsGivenThisMonth) ?? null) : null;
                                return (
                                    <View style={[styles.clsRow, { borderColor: cfg.color, backgroundColor: `${cfg.color}18`, marginBottom: 12, marginTop: 0 }]}>
                                        <View style={[styles.clsRankCircle, { borderColor: rc }]}>
                                            <Text style={[styles.clsRankText, { color: rc }]}>{myRank}</Text>
                                        </View>
                                        <View style={styles.clsAvatarWrap}>
                                            <Image source={getAvatarImage(myEntry.avatarId || 'avatar_default')} style={styles.clsAvatar} contentFit="cover" cachePolicy="memory-disk" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.clsName, { color: cfg.color }]} numberOfLines={1}>Vous</Text>
                                            {grade ? (
                                                <Text style={styles.clsGrade}>
                                                    {LEAGUE_ICONS[grade]} {LEAGUE_LABELS[grade]}
                                                </Text>
                                            ) : null}
                                            {isPerfMode && !qualifiesForPerf(myEntry) ? (
                                                <View style={styles.unqualifiedBadge}>
                                                    <Text style={styles.unqualifiedBadgeText}>-10 matchs</Text>
                                                </View>
                                            ) : null}
                                        </View>
                                        <View style={styles.clsScore}>
                                            <Text style={[styles.clsScoreNum, { color: cfg.color }]}>{getEntryScore(myEntry)}</Text>
                                            <Text style={styles.clsScoreLabel}>{isPerfMode ? '/ match' : cfg.sublabel}</Text>
                                            <Text style={styles.clsMeta}>{getEntryMeta(myEntry)}</Text>
                                        </View>
                                    </View>
                                );
                            })() : null}

                            <ScrollView style={styles.classementList} showsVerticalScrollIndicator={false} contentContainerStyle={styles.classementListContent}>
                                {sorted.map((entry, index) => {
                                    const isMe = entry.uid === currentUid;
                                const localRank = index + 1;
                                const rc = rankColor(localRank);
                                const avatarSrc = getAvatarImage(entry.avatarId || 'avatar_default');
                                const isQualified = qualifiesForPerf(entry);
                                const grade = isMonthlyScope ? (getLeagueGrade(entry.cochonsGivenThisMonth) ?? null) : null;

                                return (
                                    <Animated.View
                                        key={entry.uid}
                                        entering={FadeInUp.delay(index * 35).duration(300)}
                                        style={[styles.clsRow, isMe && { borderColor: cfg.color, backgroundColor: `${cfg.color}10` }]}
                                    >
                                        <View style={[styles.clsRankCircle, { borderColor: rc }]}>
                                            <Text style={[styles.clsRankText, { color: rc }]}>{localRank}</Text>
                                        </View>
                                        <View style={styles.clsAvatarWrap}>
                                            <Image source={avatarSrc} style={styles.clsAvatar} contentFit="cover" cachePolicy="memory-disk" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.clsName, isMe && { color: cfg.color }]} numberOfLines={1}>
                                                {isMe ? `${entry.displayName} (Vous)` : entry.displayName}
                                            </Text>
                                            {grade ? (
                                                <Text style={styles.clsGrade}>
                                                    {LEAGUE_ICONS[grade]} {LEAGUE_LABELS[grade]}
                                                </Text>
                                            ) : null}
                                            {isPerfMode && !isQualified ? (
                                                <View style={styles.unqualifiedBadge}>
                                                    <Text style={styles.unqualifiedBadgeText}>-10 matchs</Text>
                                                </View>
                                            ) : null}
                                        </View>
                                        <View style={styles.clsScore}>
                                            <Text style={[styles.clsScoreNum, { color: cfg.color }]}>{getEntryScore(entry)}</Text>
                                            <Text style={styles.clsScoreLabel}>{isPerfMode ? '/ match' : cfg.sublabel}</Text>
                                            <Text style={styles.clsMeta}>{getEntryMeta(entry)}</Text>
                                        </View>
                                    </Animated.View>
                                );
                            })}
                            </ScrollView>
                        </View>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {!hidePrimaryTabs ? (
                <View style={styles.tabs}>
                {([
                    { id: 'MA_LIGUE', label: '🐷 Ma Ligue' },
                    { id: 'CLASSEMENT_MOIS', label: '🏅 Classement du mois' },
                    { id: 'CLASSEMENT_GLOBAL', label: '🌍 Classement global' },
                ] as { id: TabType; label: string }[]).map((tab) => (
                    <TouchableOpacity
                        key={tab.id}
                        style={[styles.tabBtn, activeTab === tab.id && styles.tabBtnActive]}
                        onPress={() => handleTabChange(tab.id)}
                    >
                        <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
                </View>
            ) : null}
            <View style={styles.body}>
                {activeTab === 'MA_LIGUE' ? renderMaLigue() : null}
                {activeTab === 'CLASSEMENT_MOIS' ? renderClassement('MONTHLY') : null}
                {activeTab === 'CLASSEMENT_GLOBAL' ? renderClassement('GLOBAL') : null}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    tabs: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 10,
        marginTop: 0,
    },
    tabBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    tabBtnActive: {
        backgroundColor: 'rgba(255,215,0,0.14)',
        borderColor: '#FFD700',
    },
    tabText: {
        color: 'rgba(255,255,255,0.55)',
        fontWeight: 'bold',
        fontSize: 12,
        textAlign: 'center',
    },
    tabTextActive: { color: '#FFD700' },
    body: { flex: 1 },
    maLigueScroll: { flex: 1 },
    maLigueContent: {
        paddingBottom: 24,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'space-between',
    },
    leagueIntroCard: {
        width: '48.5%',
        backgroundColor: 'rgba(255,215,0,0.08)',
        borderRadius: 12,
        padding: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.2)',
    },
    leagueIntroEmoji: { fontSize: 24, marginBottom: 4 },
    leagueIntroTitle: {
        color: '#FFD700',
        fontSize: 15,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 3,
    },
    leagueIntroSubtitle: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 11,
        textAlign: 'center',
        lineHeight: 14,
    },
    leagueProgressPill: {
        marginTop: 7,
        paddingHorizontal: 7,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.18)',
    },
    leagueProgressPillText: {
        color: '#FFD700',
        fontSize: 10,
        fontWeight: '700',
        textAlign: 'center',
    },
    shareBtnCompact: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFD700',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6,
    },
    monthlyGradeCard: {
        width: '48.5%',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
    },
    monthlyGradeHeader: { alignItems: 'center', marginBottom: 6 },
    monthlyGradeHeaderValue: {
        color: '#FFD700',
        fontSize: 14,
        fontWeight: '900',
        textAlign: 'center',
    },
    progressLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    progressBound: { fontSize: 10, color: 'rgba(255,255,255,0.3)', width: 24 },
    progressCenter: {
        flex: 1,
        textAlign: 'center',
        fontSize: 10,
        color: 'rgba(255,255,255,0.55)',
        fontWeight: 'bold',
    },
    monthlyProgressTrack: {
        height: 14,
        borderRadius: 7,
        backgroundColor: 'rgba(255,255,255,0.07)',
        overflow: 'hidden',
    },
    monthlyProgressFill: {
        height: '100%',
        borderRadius: 7,
        backgroundColor: '#FFD700',
    },
    paliersTitle: {
        width: '100%',
        fontSize: 11,
        fontWeight: '900',
        color: 'rgba(255,215,0,0.5)',
        letterSpacing: 2,
        textTransform: 'uppercase',
        marginTop: 6,
        marginBottom: 4,
        textAlign: 'center',
    },
    tiersGrid: {
        width: '100%',
        flexDirection: 'row',
        flexWrap: 'wrap',
        columnGap: 8,
        rowGap: 8,
        justifyContent: 'space-between',
    },
    tierCard: {
        minWidth: 0,
        borderRadius: 12,
        padding: 8,
        alignItems: 'center',
        gap: 4,
        position: 'relative',
    },
    tierCardUnlocked: {
        borderWidth: 1.5,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
        elevation: 3,
    },
    tierCardLocked: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    tierCardActive: {
        borderColor: '#FFD700',
        borderWidth: 2,
        backgroundColor: 'rgba(255,215,0,0.12)',
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 6,
    },
    activeBadge: {
        position: 'absolute',
        top: -8,
        backgroundColor: '#FFD700',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 12,
    },
    activeBadgeText: {
        color: '#1A0535',
        fontSize: 8,
        fontWeight: '900',
        letterSpacing: 1,
    },
    tierGradeIcon: { fontSize: 20 },
    tierGradeIconLocked: { opacity: 0.5 },
    tierThreshold: { fontSize: 12, fontWeight: '900' },
    tierLabel: {
        fontSize: 9,
        fontWeight: '700',
        textAlign: 'center',
    },
    rewardBadge: {
        backgroundColor: 'rgba(0,0,0,0.2)',
        paddingHorizontal: 5,
        paddingVertical: 3,
        borderRadius: 20,
        borderWidth: 1,
    },
    rewardBadgeText: { fontWeight: '900', fontSize: 9 },
    classementLayout: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: 10,
    },
    classementSidebar: {
        width: 96,
        gap: 8,
    },
    sidebarBlock: {
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(255,255,255,0.03)',
        padding: 6,
    },
    sidebarCategoryBtn: {
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(255,255,255,0.04)',
        paddingHorizontal: 8,
        paddingVertical: 8,
        alignItems: 'flex-start',
        gap: 3,
    },
    sidebarCategoryIcon: {
        fontSize: 14,
    },
    sidebarCategoryText: {
        fontSize: 11,
        fontWeight: '800',
        lineHeight: 13,
    },
    sidebarModeSwitch: {
        marginTop: 6,
        flexDirection: 'row',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    sidebarModeBtn: {
        flex: 1,
        paddingVertical: 6,
        alignItems: 'center',
    },
    sidebarModeBtnActive: {
        backgroundColor: 'rgba(255,215,0,0.18)',
    },
    sidebarModeBtnText: {
        color: 'rgba(255,255,255,0.45)',
        fontSize: 10,
        fontWeight: '800',
    },
    sidebarModeBtnTextActive: {
        color: '#FFD700',
    },
    sidebarShowAllBtn: {
        marginTop: 6,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(255,255,255,0.04)',
        paddingVertical: 5,
        alignItems: 'center',
    },
    sidebarShowAllBtnActive: {
        borderColor: '#FFD700',
        backgroundColor: 'rgba(255,215,0,0.14)',
    },
    sidebarShowAllText: {
        color: 'rgba(255,255,255,0.45)',
        fontSize: 10,
        fontWeight: '800',
    },
    sidebarShowAllTextActive: {
        color: '#FFD700',
    },
    sidebarPerfHint: {
        marginTop: 4,
        color: 'rgba(255,255,255,0.34)',
        fontSize: 9,
        textAlign: 'center',
    },
    classementList: {
        flex: 1,
        minHeight: 0,
    },
    classementListContent: {
        paddingBottom: 20,
    },
    clsCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
    clsLoadText: { color: 'rgba(255,255,255,0.4)', marginTop: 12, fontSize: 13 },
    clsEmpty: { color: 'rgba(255,255,255,0.35)', fontSize: 14, textAlign: 'center', paddingHorizontal: 20 },
    clsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        backgroundColor: 'rgba(255,255,255,0.03)',
        marginBottom: 6,
    },
    clsRankCircle: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 1.4,
        justifyContent: 'center',
        alignItems: 'center',
    },
    clsRankText: { fontSize: 12, fontWeight: '900' },
    clsAvatarWrap: {
        width: 38,
        height: 38,
        borderRadius: 19,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    clsAvatar: { width: '100%', height: '100%' },
    clsName: { color: '#FFF', fontSize: 12, fontWeight: '800' },
    clsGrade: { color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 1 },
    clsScore: { alignItems: 'flex-end', marginLeft: 6, minWidth: 74 },
    clsScoreNum: { fontSize: 16, fontWeight: '900' },
    clsScoreLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 10, marginTop: -1 },
    clsMeta: { color: 'rgba(255,255,255,0.28)', fontSize: 9, marginTop: 2, textAlign: 'right' },
    unqualifiedBadge: {
        alignSelf: 'flex-start',
        marginTop: 4,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 7,
        paddingVertical: 2,
    },
    unqualifiedBadgeText: { color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '800' },
});
