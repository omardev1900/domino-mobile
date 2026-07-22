/**
 * Sidebar.tsx
 *
 * Menu latéral gauche permanent — style "Dashboard jeu vidéo".
 * Contrôlé par le feature flag USE_NEW_SIDEBAR dans navigation.config.ts.
 *
 * Zones :
 *   Top    (fixe)       — Bouton Cochon 🐷 → ouvre MdcFeedbackModal
 *   Middle (scrollable) — Avatar grade · CTA Jouer · items de nav
 *   Bottom (fixe)       — Paramètres
 */

import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LEAGUE_GRADE_COLORS } from '../core/economy.constants';
import { LeagueGrade } from '../core/economy.types';
import { authService } from '../core/services/auth.service';
import { getAvatarImage } from '../core/avatars';
import { MdcFeedbackModal } from './MdcFeedbackModal';
import { HelpOverlay } from './HelpOverlay';
import { SIDEBAR_WIDTH } from '../core/config/navigation.config';
import { statsService } from '../core/services/stats.service';
import { getLeagueProgress, getMonthlyCochonsFromHistory } from '../core/leagueProgress';

interface NavItem {
    route: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    /** Si true, ouvre un modal local au lieu de naviguer */
    isAction?: boolean;
    actionKey?: 'HELP';
}

const NAV_ITEMS: NavItem[] = [
    { route: '/home', icon: 'home-outline', label: 'Accueil' },
    { route: '/ligue-cochons', icon: 'trophy-outline', label: 'Ligue' },
    { route: '/leaderboard', icon: 'podium-outline', label: 'Rank' },
    { route: '/stats', icon: 'bar-chart-outline', label: 'Mes Stats' },
    { route: '/store', icon: 'storefront-outline', label: 'Boutique' },
    { route: '/collection', icon: 'shirt-outline', label: 'Vestiaire' },
    { route: '', icon: 'help-circle-outline', label: 'Aide', isAction: true, actionKey: 'HELP' },
];

export const Sidebar: React.FC = () => {
    const router = useRouter();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();

    const [avatarId, setAvatarId] = useState<string>('avatar_default');
    const [leagueGrade, setLeagueGrade] = useState<LeagueGrade | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    // Charger profil + grade au montage
    useEffect(() => {
        authService.getCurrentUser().then(u => {
            if (!u) return;
            setAvatarId(u.avatarId || u.avatarUrl || 'avatar_default');
        });
        statsService.getStats().then((stats) => {
            const monthlyCochons = getMonthlyCochonsFromHistory(stats.matchHistory);
            setLeagueGrade(getLeagueProgress(monthlyCochons).grade);
        });
    }, []);

    const gradeColor = leagueGrade
        ? (typeof LEAGUE_GRADE_COLORS !== 'undefined' ? LEAGUE_GRADE_COLORS[leagueGrade] : '#888888')
        : 'rgba(255,255,255,0.3)';

    const isActive = (route: string) => {
        if (route === '/home') return pathname === '/home' || pathname === '/';
        return pathname.startsWith(route);
    };

    const handleNavPress = (item: NavItem) => {
        if (item.isAction && item.actionKey === 'HELP') {
            setShowHelp(true);
            return;
        }
        if (!isActive(item.route)) {
            router.push(item.route as any);
        }
    };

    return (
        <>
            <View style={[styles.sidebar, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

                {/* ── TOP : Logo MDC officiel ── */}
                <View style={styles.topZone}>
                    <TouchableOpacity style={styles.mdcBtn} onPress={() => setShowFeedback(true)} activeOpacity={0.8}>
                        <Image
                            source={require('../assets/images/logo_mdc.png')}
                            style={styles.mdcLogo}
                            contentFit="contain"
                        />
                    </TouchableOpacity>
                </View>

                {/* ── MIDDLE : Scrollable ── */}
                <ScrollView
                    style={styles.middle}
                    contentContainerStyle={styles.middleContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Avatar avec couleur de grade — cliquable → Profil */}
                    <TouchableOpacity
                        style={[styles.avatarRing, { borderColor: gradeColor }]}
                        onPress={() => router.push('/profile' as any)}
                        activeOpacity={0.8}
                    >
                        <Image
                            source={getAvatarImage(avatarId as any)}
                            style={styles.avatarImg}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                        />
                    </TouchableOpacity>

                    {/* CTA Jouer */}
                    <TouchableOpacity
                        style={styles.jouerBtn}
                        onPress={() => router.push('/game-modes' as any)}
                        activeOpacity={0.85}
                    >
                        <LinearGradient
                            colors={['#FFD700', '#FFA000']}
                            style={styles.jouerGradient}
                        >
                            <Ionicons name="game-controller" size={24} color="#1A0E2E" />
                            <Text style={styles.jouerLabel}>JOUER</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Séparateur */}
                    <View style={styles.separator} />

                    {/* Items de navigation */}
                    {NAV_ITEMS.map((item) => {
                        const active = !item.isAction && isActive(item.route);
                        return (
                            <TouchableOpacity
                                key={item.label}
                                style={[styles.navItem, active && styles.navItemActive]}
                                onPress={() => handleNavPress(item)}
                                activeOpacity={0.75}
                            >
                                {active && <View style={styles.activeBar} />}
                                <Ionicons
                                    name={active
                                        ? (item.icon.replace('-outline', '') as keyof typeof Ionicons.glyphMap)
                                        : item.icon}
                                    size={22}
                                    color={active ? '#FFD700' : 'rgba(255,255,255,0.55)'}
                                />
                                <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                                    {item.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {/* ── BOTTOM : Paramètres ── */}
                <View style={styles.bottomZone}>
                    <TouchableOpacity
                        style={styles.navItem}
                        onPress={() => router.push('/modal' as any)}
                        activeOpacity={0.75}
                    >
                        <Ionicons name="settings-outline" size={22} color="rgba(255,255,255,0.55)" />
                        <Text style={styles.navLabel}>Réglages</Text>
                    </TouchableOpacity>
                </View>

            </View>

            {/* Modales */}
            <MdcFeedbackModal visible={showFeedback} onClose={() => setShowFeedback(false)} />
            <HelpOverlay visible={showHelp} onClose={() => setShowHelp(false)} />
        </>
    );
};

const styles = StyleSheet.create({
    sidebar: {
        width: SIDEBAR_WIDTH,
        backgroundColor: '#080F20',
        borderRightWidth: 1,
        borderRightColor: 'rgba(255,215,0,0.1)',
        flexDirection: 'column',
    },

    // ── Top ──
    topZone: {
        alignItems: 'center',
        paddingVertical: 12,
        gap: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    mdcBtn: {
        width: 50,
        height: 50,
        borderRadius: 12,
        backgroundColor: '#1A0E2E',   // Fond gris clair pour logo transparent
        borderWidth: 1.5,
        borderColor: 'rgba(255,215,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        // Ombre subtile pour le relief
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 4,
    },
    mdcLogo: {
        width: 44,
        height: 44,
    },
    // ── Middle ──
    middle: {
        flex: 1,
    },
    middleContent: {
        alignItems: 'center',
        paddingTop: 14,
        paddingBottom: 10,
        gap: 4,
    },

    // Avatar
    avatarRing: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2.5,
        overflow: 'hidden',
        marginBottom: 10,
        backgroundColor: 'rgba(255,215,0,0.1)',
    },
    avatarImg: {
        width: '100%',
        height: '100%',
    },

    // CTA Jouer
    jouerBtn: {
        width: 52,
        height: 52,
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 6,
        elevation: 4,
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
    },
    jouerGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
    },
    jouerLabel: {
        color: '#1A0E2E',
        fontSize: 8,
        fontWeight: '900',
        letterSpacing: 0.5,
    },

    // Séparateur
    separator: {
        width: 36,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.08)',
        marginVertical: 8,
    },

    // Nav items
    navItem: {
        width: SIDEBAR_WIDTH,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        position: 'relative',
    },
    navItemActive: {
        backgroundColor: 'rgba(255,215,0,0.06)',
    },
    activeBar: {
        position: 'absolute',
        left: 0,
        top: 8,
        bottom: 8,
        width: 3,
        backgroundColor: '#E53935',
        borderRadius: 2,
    },
    navLabel: {
        fontSize: 9,
        color: 'rgba(255,255,255,0.45)',
        fontWeight: '600',
        letterSpacing: 0.3,
        textAlign: 'center',
    },
    navLabelActive: {
        color: '#FFD700',
    },

    // ── Bottom ──
    bottomZone: {
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
        paddingVertical: 4,
        alignItems: 'center',
    },
});
