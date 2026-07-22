/**
 * debug-ligue.tsx
 *
 * 🛠 Écran de DEBUG — Ligue des Cochons
 * Permet de simuler visuellement tous les états de progression
 * sans jouer de vraies parties.
 *
 * ⚠️ ACCÈS : Uniquement visible en développement (__DEV__ === true)
 * Ne jamais dépendre de cet écran en production.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Switch,
    useWindowDimensions,
 Modal } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


import { AvatarFrame } from '../src/components/AvatarFrame';
import { RewardOverlay } from '../src/components/RewardOverlay';
import { leagueService } from '../src/core/services/league.service';
import {
    LEAGUE_LABELS,
    LEAGUE_ICONS,
    LEAGUE_FRAME_THRESHOLDS,
    LEAGUE_FRAME_REWARDS,
    LEAGUE_GRADE_ORDER,
} from '../src/core/economy.constants';
import { LeagueFrameId } from '../src/core/economy.types';

// ─── États de démo prédéfinis ─────────────────────────────────────────────────

const DEMO_STATES = [
    { label: 'Départ',         cochons: 0,   icon: '🐷' },
    { label: 'Avant Argent',   cochons: 25,  icon: '🥈' },
    { label: 'Argent (30)',    cochons: 30,  icon: '🥈' },
    { label: 'Mi-chemin Or',   cochons: 90,  icon: '🥇' },
    { label: 'Or (150)',       cochons: 150, icon: '🥇' },
    { label: 'Avant Diamant',  cochons: 240, icon: '💎' },
    { label: 'Diamant (250)',  cochons: 250, icon: '💎' },
    { label: 'En route Feu',   cochons: 420, icon: '🔥' },
    { label: 'Feu (500)',      cochons: 500, icon: '🔥' },
    { label: 'Légende max',    cochons: 999, icon: '🐖' },
];

// ─── Composant : Aperçu d'un cadre ───────────────────────────────────────────

const FramePreview: React.FC<{ frameId: LeagueFrameId | null; size: number; label: string }> = ({
    frameId,
    size,
    label,
}) => (
    <View style={previewStyles.wrapper}>
        <Text style={previewStyles.label}>{label}</Text>
        <View style={[previewStyles.avatarBg, { width: size + 20, height: size + 20 }]}>
            <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' }} />
            {frameId && <AvatarFrame frameId={frameId} size={size} />}
        </View>
    </View>
);

const previewStyles = StyleSheet.create({
    wrapper: { alignItems: 'center', gap: 6 },
    label: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '600', textAlign: 'center' },
    avatarBg: { justifyContent: 'center', alignItems: 'center' },
});

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function DebugLigueScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();

    // — État simulé —
    const [cochons, setCochons] = useState(0);
    const [autoPlay, setAutoPlay] = useState(false);
    const [autoPlayIndex, setAutoPlayIndex] = useState(0);
    const [showUnlockModal, setShowUnlockModal] = useState(false);
    const [lastUnlockedGrade, setLastUnlockedGrade] = useState<string | null>(null);

    // Calculs dérivés
    const grade = leagueService.getGradeFromCochons(cochons);
    const nextThreshold = leagueService.getNextFrameThreshold(cochons);
    const unlockedFrames = LEAGUE_GRADE_ORDER
        .filter(g => cochons >= LEAGUE_FRAME_THRESHOLDS[g])
        .map(g => LEAGUE_FRAME_REWARDS[g].frameId as LeagueFrameId);
    const activeFrameId = unlockedFrames.length > 0 ? unlockedFrames[unlockedFrames.length - 1] : null;

    // — Auto-play : cycle automatique entre les états démo —
    const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (autoPlay) {
            autoPlayRef.current = setInterval(() => {
                setAutoPlayIndex(prev => {
                    const next = (prev + 1) % DEMO_STATES.length;
                    const nextState = DEMO_STATES[next];

                    // Détecter franchissement de palier
                    const prevCochons = DEMO_STATES[prev].cochons;
                    const nextCochons = nextState.cochons;
                    const delta = nextCochons - prevCochons;
                    if (delta > 0) {
                        const newUnlocks = leagueService.computeNewUnlocks(prevCochons, delta);
                        if (newUnlocks.length > 0) {
                            triggerDebugRewardOverlay(newUnlocks[newUnlocks.length - 1].grade);
                        }
                    }

                    setCochons(nextState.cochons);
                    return next;
                });
            }, 2000);
        } else {
            if (autoPlayRef.current) clearInterval(autoPlayRef.current);
        }
        return () => {
            if (autoPlayRef.current) clearInterval(autoPlayRef.current);
        };
    }, [autoPlay]);

    const triggerDebugRewardOverlay = (gradeToShow: string) => {
        setShowUnlockModal(false);
        setLastUnlockedGrade(gradeToShow);
        setTimeout(() => setShowUnlockModal(true), 60);
    };

    const handleDemoState = (index: number) => {
        const prev = cochons;
        const next = DEMO_STATES[index].cochons;
        setAutoPlayIndex(index);
        setCochons(next);

        // Simuler le déblocage si franchissement
        const newUnlocks = leagueService.computeNewUnlocks(
            prev,
            Math.max(0, next - prev),
            unlockedFrames,
        );
        if (newUnlocks.length > 0) {
            triggerDebugRewardOverlay(newUnlocks[newUnlocks.length - 1].grade);
        }
    };

    const handleAddCochon = (n: number) => {
        const prev = cochons;
        const next = Math.min(999, Math.max(0, cochons + n));
        const newUnlocks = leagueService.computeNewUnlocks(prev, Math.abs(n > 0 ? n : 0), unlockedFrames);
        setCochons(next);
        if (newUnlocks.length > 0 && n > 0) {
            triggerDebugRewardOverlay(newUnlocks[newUnlocks.length - 1].grade);
        }
    };

    const pct = nextThreshold
        ? Math.min((cochons - (nextThreshold <= 30 ? 0 : nextThreshold <= 150 ? 30 : nextThreshold <= 250 ? 150 : 250)) / (nextThreshold - (nextThreshold <= 30 ? 0 : nextThreshold <= 150 ? 30 : nextThreshold <= 250 ? 150 : 250)), 1)
        : 1;

    return (
        <LinearGradient colors={['#0D0520', '#1A0535', '#0A0210']} style={styles.container}>

            {/* ─── Header ─── */}
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color="#FFD700" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>🛠 Debug — Ligue des Cochons</Text>
                    <Text style={styles.headerSub}>Mode développeur</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ color: autoPlay ? '#4CAF50' : 'rgba(255,255,255,0.4)', fontSize: 11 }}>
                        {autoPlay ? 'AUTO' : 'Manuel'}
                    </Text>
                    <Switch
                        value={autoPlay}
                        onValueChange={setAutoPlay}
                        trackColor={{ false: 'rgba(255,255,255,0.15)', true: '#4CAF50' }}
                        thumbColor="#FFFFFF"
                    />
                </View>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 30 }]}
                showsVerticalScrollIndicator={false}
            >

                {/* ─── Compteur central ─── */}
                <Animated.View key={cochons} entering={ZoomIn.duration(300)} style={styles.counterCard}>
                    <Text style={styles.counterValue}>{cochons}</Text>
                    <Text style={styles.counterLabel}>🐷 cochons donnés</Text>
                    <Text style={styles.gradeText}>
                        {LEAGUE_ICONS[grade]} {LEAGUE_LABELS[grade]}
                    </Text>
                </Animated.View>

                {/* ─── Avatar avec cadre actif ─── */}
                <View style={styles.avatarSection}>
                    <FramePreview frameId={activeFrameId} size={90} label="Cadre actif" />
                    {/* Tous les cadres côte à côte */}
                    <View style={styles.allFramesRow}>
                        {(['frame_argent', 'frame_or', 'frame_diamant', 'frame_feu'] as LeagueFrameId[]).map((fId) => {
                            const isUnlocked = unlockedFrames.includes(fId);
                            return (
                                <View key={fId} style={{ opacity: isUnlocked ? 1 : 0.25 }}>
                                    <FramePreview frameId={fId} size={48} label={fId.replace('frame_', '')} />
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* ─── Barre de progression ─── */}
                <View style={styles.progressSection}>
                    <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${pct * 100}%` as any }]}>
                            <LinearGradient colors={['#FF4500', '#FFD700']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFillObject} />
                        </View>
                    </View>
                    <View style={styles.milestonesRow}>
                        {[30, 150, 250, 500].map(t => (
                            <Text key={t} style={[styles.milestoneLabel, cochons >= t && { color: '#FFD700' }]}>{t}</Text>
                        ))}
                    </View>
                    <Text style={styles.progressText}>
                        {nextThreshold ? `→ ${nextThreshold - cochons} cochons avant ${nextThreshold}` : '🔥 Grade MAX atteint !'}
                    </Text>
                </View>

                {/* ─── Contrôles manuels ─── */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Contrôles</Text>
                    <View style={styles.controlsRow}>
                        {[-10, -1, +1, +5, +10, +50].map(n => (
                            <TouchableOpacity
                                key={n}
                                style={[styles.controlBtn, n > 0 ? styles.controlBtnPos : styles.controlBtnNeg]}
                                onPress={() => handleAddCochon(n)}
                            >
                                <Text style={styles.controlBtnText}>{n > 0 ? `+${n}` : n}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* ─── États prédéfinis ─── */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>États prédéfinis {autoPlay ? '(auto)' : ''}</Text>
                    <View style={styles.demoGrid}>
                        {DEMO_STATES.map((state, idx) => (
                            <TouchableOpacity
                                key={idx}
                                style={[
                                    styles.demoBtn,
                                    autoPlayIndex === idx && cochons === state.cochons && styles.demoBtnActive,
                                ]}
                                onPress={() => handleDemoState(idx)}
                            >
                                <Text style={styles.demoBtnIcon}>{state.icon}</Text>
                                <Text style={styles.demoBtnLabel}>{state.label}</Text>
                                <Text style={styles.demoBtnCochons}>{state.cochons} 🐷</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* ─── Test du modal de palier ─── */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Test modaux</Text>
                    <View style={styles.modalTestRow}>
                        {LEAGUE_GRADE_ORDER.map((grade) => (
                            <TouchableOpacity
                                key={grade}
                                style={styles.modalTestBtn}
                                onPress={() => triggerDebugRewardOverlay(grade)}
                            >
                                <Text style={styles.modalTestEmoji}>{LEAGUE_ICONS[grade]}</Text>
                                <Text style={styles.modalTestLabel}>{LEAGUE_LABELS[grade]}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* ─── Info technique ─── */}
                <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>État calculé</Text>
                    <Text style={styles.infoRow}>grade: <Text style={styles.infoVal}>{LEAGUE_LABELS[grade]}</Text></Text>
                    <Text style={styles.infoRow}>nextThreshold: <Text style={styles.infoVal}>{nextThreshold ?? 'null (max)'}</Text></Text>
                    <Text style={styles.infoRow}>unlockedFrames: <Text style={styles.infoVal}>[{unlockedFrames.join(', ') || 'aucun'}]</Text></Text>
                    <Text style={styles.infoRow}>activeFrame: <Text style={styles.infoVal}>{activeFrameId ?? 'null'}</Text></Text>
                </View>

            </ScrollView>
            {/* ─── VRAI Modal de récompense de fin de partie ─── */}
            <RewardOverlay
                key={`debug-reward-${lastUnlockedGrade ?? 'none'}-${showUnlockModal ? 'open' : 'closed'}`}
                visible={showUnlockModal}
                isWinner={true}
                onContinue={() => setShowUnlockModal(false)}
                reward={{
                    coinsEarned: 0,
                    xpEarned: 0,
                    diamondsEarned: 0,
                    leaguePointsEarned: 0,
                    isWinner: true,
                    previousLevel: 1,
                    newLevel: 1,
                    leveledUp: false,
                    previousXP: 0,
                    newXP: 0,
                    xpToNextLevel: 100,
                    previousGrade: lastUnlockedGrade
                        ? (LEAGUE_GRADE_ORDER[Math.max(0, LEAGUE_GRADE_ORDER.indexOf(lastUnlockedGrade as any) - 1)] as any)
                        : null,
                    newGrade: (lastUnlockedGrade as any) || null,
                    gradeUp: !!lastUnlockedGrade,
                    previousLeaguePoints: lastUnlockedGrade
                        ? (LEAGUE_GRADE_ORDER.indexOf(lastUnlockedGrade as any) > 0
                            ? LEAGUE_FRAME_THRESHOLDS[LEAGUE_GRADE_ORDER[LEAGUE_GRADE_ORDER.indexOf(lastUnlockedGrade as any) - 1]]
                            : 0)
                        : 0,
                    newLeaguePoints: lastUnlockedGrade
                        ? LEAGUE_FRAME_THRESHOLDS[lastUnlockedGrade as keyof typeof LEAGUE_FRAME_THRESHOLDS]
                        : cochons,
                    nextGradeThreshold: lastUnlockedGrade
                        ? (() => {
                            const nextGrade = LEAGUE_GRADE_ORDER[LEAGUE_GRADE_ORDER.indexOf(lastUnlockedGrade as any) + 1];
                            return nextGrade ? LEAGUE_FRAME_THRESHOLDS[nextGrade] : null;
                        })()
                        : nextThreshold,
                    newCochonsGiven: lastUnlockedGrade
                        ? LEAGUE_FRAME_THRESHOLDS[lastUnlockedGrade as keyof typeof LEAGUE_FRAME_THRESHOLDS]
                        : cochons,
                    breakdown: [],
                    frameCoinsBonus: lastUnlockedGrade
                        ? (LEAGUE_FRAME_REWARDS[lastUnlockedGrade as keyof typeof LEAGUE_FRAME_REWARDS]?.coinsBonus ?? 0)
                        : 0,
                    newlyUnlockedFrames: [],
                }}
            />
        </LinearGradient>
    );
}

// ─── Styles principaux ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,215,0,0.1)',
        gap: 10,
    },
    backBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: 'rgba(255,255,255,0.08)',
        justifyContent: 'center', alignItems: 'center',
    },
    headerTitle: { color: '#FFD700', fontSize: 15, fontWeight: '900' },
    headerSub: { color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 1 },
    scroll: { padding: 14, gap: 18 },

    // Compteur
    counterCard: {
        backgroundColor: 'rgba(255,215,0,0.08)',
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: 'rgba(255,215,0,0.25)',
        padding: 20,
        alignItems: 'center',
        gap: 4,
    },
    counterValue: { color: '#FFD700', fontSize: 56, fontWeight: '900', lineHeight: 64 },
    counterLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
    gradeText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginTop: 4 },

    // Avatar
    avatarSection: { alignItems: 'center', gap: 16 },
    allFramesRow: { flexDirection: 'row', gap: 14 },

    // Barre
    progressSection: { gap: 8 },
    progressTrack: {
        height: 14, backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 7, overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: 7, overflow: 'hidden', minWidth: 4 },
    milestonesRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
    milestoneLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 'bold' },
    progressText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, textAlign: 'center', fontStyle: 'italic' },

    // Contrôles
    section: { gap: 10 },
    sectionTitle: {
        color: '#FFD700', fontSize: 12, fontWeight: '900',
        textTransform: 'uppercase', letterSpacing: 1.5,
    },
    controlsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    controlBtn: {
        paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
        minWidth: 50, alignItems: 'center',
    },
    controlBtnPos: { backgroundColor: 'rgba(76,175,80,0.25)', borderWidth: 1, borderColor: '#4CAF50' },
    controlBtnNeg: { backgroundColor: 'rgba(244,67,54,0.2)', borderWidth: 1, borderColor: '#F44336' },
    controlBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },

    // États prédéfinis
    demoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    demoBtn: {
        paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center', minWidth: 100,
    },
    demoBtnActive: {
        borderColor: '#FFD700', backgroundColor: 'rgba(255,215,0,0.12)',
    },
    demoBtnIcon: { fontSize: 18 },
    demoBtnLabel: { color: '#FFF', fontSize: 10, fontWeight: '700', marginTop: 2 },
    demoBtnCochons: { color: 'rgba(255,255,255,0.5)', fontSize: 9, marginTop: 1 },

    // Test modaux
    modalTestRow: { flexDirection: 'row', gap: 10 },
    modalTestBtn: {
        flex: 1, paddingVertical: 12, borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center', gap: 4,
    },
    modalTestEmoji: { fontSize: 22 },
    modalTestLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '700' },

    // Info card
    infoCard: {
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 12, padding: 14, gap: 4,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    infoTitle: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
    infoRow: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
    infoVal: { color: '#A5D6A7', fontWeight: 'bold' },
});

// ─── Styles modal ─────────────────────────────────────────────────────────────

const modalStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    card: {
        width: '85%',
        maxWidth: 400,
        backgroundColor: 'rgba(20, 8, 40, 0.98)',
        borderRadius: 22,
        padding: 24,
        alignItems: 'center',
        gap: 16,
        borderWidth: 2,
        borderColor: '#FFD700',
    },
    cardLandscape: {
        maxWidth: 600,
        width: '90%',
    },
    title: { 
        color: '#FFD700', 
        fontSize: 26, 
        fontWeight: '900', 
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    contentWrapper: {
        width: '100%',
        alignItems: 'center',
        gap: 20,
    },
    contentWrapperLandscape: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 10,
    },
    frameShowcase: { 
        alignItems: 'center', 
        justifyContent: 'center' 
    },
    frameDisplay: {
        width: 140, height: 140,
        justifyContent: 'center', alignItems: 'center',
    },
    fakeAvatar: {
        width: 110, height: 110, borderRadius: 55,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)',
    },
    infoSection: {
        alignItems: 'center',
        gap: 16,
        width: '100%',
    },
    infoSectionLandscape: {
        flex: 1,
        justifyContent: 'center',
    },
    coinsBadge: {
        backgroundColor: 'rgba(255,215,0,0.15)',
        paddingHorizontal: 20, paddingVertical: 10,
        borderRadius: 20, borderWidth: 1, borderColor: '#FFD700',
    },
    coinsText: { color: '#FFD700', fontWeight: '900', fontSize: 18 },
    closeBtn: { width: '100%' },
    closeBtnGrad: { paddingVertical: 14, borderRadius: 26, alignItems: 'center' },
    closeBtnText: { color: '#FFF', fontWeight: '900', fontSize: 16, letterSpacing: 2 },
});
