import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInLeft, FadeInRight } from 'react-native-reanimated';

import {
    LEAGUE_THRESHOLDS,
    LEAGUE_FRAME_THRESHOLDS,
    LEAGUE_FRAME_REWARDS,
} from '../core/economy.constants';

const APPRENTI_SUBS = [
    { grade: 'APPRENTI_1', num: 1, color: '#BDBDBD', seuil: LEAGUE_FRAME_THRESHOLDS.APPRENTI_1 },
    { grade: 'APPRENTI_2', num: 2, color: '#8A8A8A', seuil: LEAGUE_FRAME_THRESHOLDS.APPRENTI_2 },
    { grade: 'APPRENTI_3', num: 3, color: '#616161', seuil: LEAGUE_FRAME_THRESHOLDS.APPRENTI_3 },
];

const MAITRE_SUBS = [
    { grade: 'MAITRE_1', num: 1, color: '#FFE57A', seuil: LEAGUE_FRAME_THRESHOLDS.MAITRE_1 },
    { grade: 'MAITRE_2', num: 2, color: '#FFD700', seuil: LEAGUE_FRAME_THRESHOLDS.MAITRE_2 },
    { grade: 'MAITRE_3', num: 3, color: '#FFA000', seuil: LEAGUE_FRAME_THRESHOLDS.MAITRE_3 },
];

export const LeagueInfoContent: React.FC = () => (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
            <Ionicons name="trophy" size={18} color="#FFD700" />
            <Text style={styles.title}>LIGUE DES COCHONS</Text>
            <Text style={styles.sub}>Infligez des cochons pour grimper les rangs</Text>
        </View>

        <View style={styles.main}>
            <View style={styles.left}>
                <Animated.View entering={FadeInLeft.duration(350)} style={[styles.groupCard, styles.groupCardDebutant]}>
                    <View style={styles.groupHeader}>
                        <Text style={styles.groupIcon}>🌱</Text>
                        <Text style={[styles.groupTitle, { color: '#9CCC65' }]}>DEBUTANT</Text>
                    </View>
                    <View style={styles.debutantBody}>
                        <Text style={styles.debutantThreshold}>{LEAGUE_THRESHOLDS.DEBUTANT} 🐷</Text>
                        <Text style={styles.debutantText}>Premier cochon inflige, premier grade obtenu.</Text>
                    </View>
                    <View style={styles.groupRewardRow}>
                        <Ionicons name="ribbon-outline" size={11} color="#9CCC65" />
                        <Text style={[styles.groupRewardText, { color: '#9CCC65' }]}>
                            Grade seul, aucun cadre debloque
                        </Text>
                    </View>
                </Animated.View>

                <Animated.View entering={FadeInLeft.duration(450)} style={[styles.groupCard, styles.groupCardApprenti]}>
                    <View style={styles.groupHeader}>
                        <Text style={styles.groupIcon}>🥉</Text>
                        <Text style={[styles.groupTitle, { color: '#9E9E9E' }]}>APPRENTI</Text>
                    </View>
                    <View style={styles.subgradesRow}>
                        {APPRENTI_SUBS.map((sub) => (
                            <View key={sub.grade} style={[styles.subBadge, { borderColor: sub.color }]}>
                                <Text style={[styles.subNum, { color: sub.color }]}>{sub.num}</Text>
                                <Text style={styles.subSeuil}>{sub.seuil} 🐷</Text>
                            </View>
                        ))}
                    </View>
                    <View style={styles.groupRewardRow}>
                        <Ionicons name="cash-outline" size={11} color="#9E9E9E" />
                        <Text style={[styles.groupRewardText, { color: '#9E9E9E' }]}>
                            {LEAGUE_FRAME_REWARDS.APPRENTI_1.coinsBonus}-{LEAGUE_FRAME_REWARDS.APPRENTI_3.coinsBonus} coins
                        </Text>
                    </View>
                </Animated.View>

                <Animated.View entering={FadeInLeft.duration(450).delay(120)} style={[styles.groupCard, styles.groupCardMaitre]}>
                    <View style={styles.groupHeader}>
                        <Text style={styles.groupIcon}>🥇</Text>
                        <Text style={[styles.groupTitle, { color: '#FFD700' }]}>MAITRE SAUCISSIER</Text>
                    </View>
                    <View style={styles.subgradesRow}>
                        {MAITRE_SUBS.map((sub) => (
                            <View key={sub.grade} style={[styles.subBadge, { borderColor: sub.color }]}>
                                <Text style={[styles.subNum, { color: sub.color }]}>{sub.num}</Text>
                                <Text style={styles.subSeuil}>{sub.seuil} 🐷</Text>
                            </View>
                        ))}
                    </View>
                    <View style={styles.groupRewardRow}>
                        <Ionicons name="cash-outline" size={11} color="#FFD700" />
                        <Text style={[styles.groupRewardText, { color: '#FFD700' }]}>
                            {LEAGUE_FRAME_REWARDS.MAITRE_1.coinsBonus}-{LEAGUE_FRAME_REWARDS.MAITRE_3.coinsBonus} coins
                        </Text>
                    </View>
                </Animated.View>
            </View>

            <View style={styles.right}>
                <Animated.View entering={FadeInRight.duration(450).delay(60)} style={[styles.eliteCard, styles.eliteCardRoi]}>
                    <Text style={styles.eliteIcon}>👑</Text>
                    <Text style={[styles.eliteName, { color: '#4FC3F7' }]}>ROI DU BOUDIN</Text>
                    <Text style={[styles.eliteSeuil, { color: '#4FC3F7' }]}>250 🐷</Text>
                    <View style={[styles.eliteRewardRow, { borderColor: 'rgba(79,195,247,0.2)' }]}>
                        <Ionicons name="cash-outline" size={11} color="#4FC3F7" />
                        <Text style={[styles.eliteRewardText, { color: '#4FC3F7' }]}>
                            {LEAGUE_FRAME_REWARDS.ROI.coinsBonus} coins
                        </Text>
                    </View>
                </Animated.View>

                <Animated.View entering={FadeInRight.duration(450).delay(180)} style={[styles.eliteCard, styles.eliteCardLegende]}>
                    <Text style={styles.eliteIcon}>🔥</Text>
                    <Text style={[styles.eliteName, { color: '#FF5252' }]}>LEGENDE DU GROUIN</Text>
                    <Text style={[styles.eliteSeuil, { color: '#FF5252' }]}>500 🐷</Text>
                    <View style={[styles.eliteRewardRow, { borderColor: 'rgba(255,82,82,0.2)' }]}>
                        <Ionicons name="cash-outline" size={11} color="#FF5252" />
                        <Text style={[styles.eliteRewardText, { color: '#FF5252' }]}>
                            {LEAGUE_FRAME_REWARDS.LEGENDE.coinsBonus} coins
                        </Text>
                    </View>
                </Animated.View>
            </View>
        </View>

        <View style={styles.rulesCard}>
            <Text style={styles.rulesTitle}>Comment gagner des cochons ?</Text>
            <Text style={styles.rulesText}>
                🐷 Gagnez une manche alors qu&apos;un adversaire a <Text style={styles.rulesHighlight}>0 victoire</Text> : vous lui infligez un cochon.{'\n\n'}
                🐷🐷 Si <Text style={styles.rulesHighlight}>2 adversaires</Text> ont 0 victoire en même temps, vous gagnez un <Text style={styles.rulesDouble}>double cochon</Text>.{'\n\n'}
                La ligue repart de <Text style={styles.rulesHighlight}>zéro au début de chaque mois</Text>. Les <Text style={styles.rulesHighlight}>coins gagnés</Text> sur les paliers restent acquis.
            </Text>
        </View>
    </ScrollView>
);

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { paddingBottom: 20 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,215,0,0.15)',
    },
    title: { color: '#FFD700', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
    sub: { flex: 1, textAlign: 'right', color: 'rgba(255,255,255,0.3)', fontSize: 10 },
    main: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
    left: { flex: 3, flexDirection: 'column', gap: 10 },
    right: { flex: 2, flexDirection: 'column', gap: 10 },
    groupCard: { minHeight: 140, borderRadius: 16, padding: 12, borderWidth: 1.5, justifyContent: 'space-between' },
    groupCardDebutant: {
        minHeight: 110,
        backgroundColor: 'rgba(156,204,101,0.06)',
        borderColor: 'rgba(156,204,101,0.24)',
        shadowColor: '#9CCC65',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
        elevation: 3,
    },
    groupCardApprenti: {
        backgroundColor: 'rgba(158,158,158,0.05)',
        borderColor: 'rgba(158,158,158,0.22)',
        shadowColor: '#9E9E9E',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
        elevation: 3,
    },
    groupCardMaitre: {
        backgroundColor: 'rgba(255,215,0,0.05)',
        borderColor: 'rgba(255,215,0,0.22)',
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
        elevation: 3,
    },
    groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    groupIcon: { fontSize: 22 },
    groupTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
    debutantBody: { gap: 6, alignItems: 'flex-start' },
    debutantThreshold: { fontSize: 22, fontWeight: '900', color: '#9CCC65' },
    debutantText: { fontSize: 11, color: 'rgba(255,255,255,0.72)', lineHeight: 16 },
    subgradesRow: { flexDirection: 'row', gap: 6, alignItems: 'stretch' },
    subBadge: {
        flex: 1,
        minHeight: 52,
        borderWidth: 1,
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 4,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    subNum: { fontSize: 18, fontWeight: '900' },
    subSeuil: { fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 3 },
    groupRewardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.07)',
    },
    groupRewardText: { fontSize: 11, fontWeight: 'bold' },
    eliteCard: {
        minHeight: 140,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    eliteCardRoi: {
        backgroundColor: 'rgba(79,195,247,0.05)',
        borderColor: 'rgba(79,195,247,0.28)',
        shadowColor: '#4FC3F7',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.22,
        shadowRadius: 10,
        elevation: 4,
    },
    eliteCardLegende: {
        backgroundColor: 'rgba(255,82,82,0.05)',
        borderColor: 'rgba(255,82,82,0.28)',
        shadowColor: '#FF5252',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.22,
        shadowRadius: 10,
        elevation: 4,
    },
    eliteIcon: { fontSize: 38 },
    eliteName: { fontSize: 12, fontWeight: '900', letterSpacing: 0.5, textAlign: 'center' },
    eliteSeuil: { fontSize: 20, fontWeight: '900' },
    eliteRewardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 20,
        borderWidth: 1,
        backgroundColor: 'rgba(0,0,0,0.2)',
        marginTop: 2,
    },
    eliteRewardText: { fontSize: 12, fontWeight: '900' },
    rulesCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginTop: 18,
    },
    rulesTitle: {
        color: '#FFD700',
        fontSize: 14,
        fontWeight: '900',
        marginBottom: 10,
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    rulesText: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: 13,
        lineHeight: 20,
    },
    rulesHighlight: { fontWeight: 'bold', color: '#FFD700' },
    rulesDouble: { fontWeight: 'bold', color: '#FF4500' },
});
