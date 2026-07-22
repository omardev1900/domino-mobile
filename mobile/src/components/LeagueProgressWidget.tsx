import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
    LEAGUE_LABELS,
    LEAGUE_ICONS,
    LEAGUE_GRADE_COLORS,
} from '../core/economy.constants';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { getLeagueProgress } from '../core/leagueProgress';

interface LeagueProgressWidgetProps {
    points: number;
    onInfoPress?: () => void;
    style?: any;
}

export const LeagueProgressWidget: React.FC<LeagueProgressWidgetProps> = ({ points, onInfoPress, style }) => {
    const progress = useMemo(() => getLeagueProgress(points), [points]);
    const currentGrade = progress.grade;
    const nextGrade = progress.nextGrade;

    const gradeColor = currentGrade && typeof LEAGUE_GRADE_COLORS !== 'undefined' ? LEAGUE_GRADE_COLORS[currentGrade] : '#888';
    const gradeIcon = currentGrade ? LEAGUE_ICONS[currentGrade] : '🔰';
    const gradeLabel = currentGrade ? LEAGUE_LABELS[currentGrade] : 'Sans grade';

    return (
        <Animated.View entering={FadeInUp.delay(100).duration(500)} style={[styles.container, style]}>
            <LinearGradient colors={['#0A1938', '#010619']} style={[styles.card, { borderColor: `${gradeColor}55` }]}>

                {/* Ligne 1 : icône + nom du grade (à gauche) + bouton (i) (à droite) */}
                <View style={styles.headerRow}>
                    <View style={styles.gradeIdentity}>
                        <Text style={styles.gradeIcon}>{gradeIcon}</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.gradeLabelLine}>Mon grade</Text>
                            <Text style={[styles.gradeName, { color: gradeColor }]} numberOfLines={1}>
                                {gradeLabel}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={styles.infoButton}
                        onPress={onInfoPress}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Ionicons name="information-circle-outline" size={22} color="#FFD700" />
                    </TouchableOpacity>
                </View>

                {/* Ligne 2 : compteur cochons */}
                <Text style={styles.cochonsLine}>
                    🐷 <Text style={styles.cochonsNumber}>{points.toLocaleString()}</Text> cochons du mois
                </Text>

                {/* Ligne 3 : barre de progression */}
                <View style={styles.progressTrack}>
                    <LinearGradient
                        colors={[gradeColor, '#FFA500']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.progressFill, { width: `${Math.round(progress.progressPercent * 100)}%` }]}
                    />
                </View>

                {/* Ligne 4 : prochain grade */}
                {nextGrade && progress.nextThreshold !== null ? (
                    <View style={styles.nextRow}>
                        <Text style={styles.nextLabel}>Prochain</Text>
                        <View style={styles.nextRight}>
                            <Text style={styles.nextIcon}>{LEAGUE_ICONS[nextGrade]}</Text>
                            <Text style={[styles.nextName, { color: typeof LEAGUE_GRADE_COLORS !== 'undefined' ? LEAGUE_GRADE_COLORS[nextGrade] : '#888' }]} numberOfLines={1}>
                                {LEAGUE_LABELS[nextGrade]}
                            </Text>
                            <Text style={styles.nextRemaining}>{progress.remainingToNext} 🐷</Text>
                        </View>
                    </View>
                ) : (
                    <Text style={styles.maxRow}>🔥 Grade maximum atteint</Text>
                )}

            </LinearGradient>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        maxWidth: 360,
        alignSelf: 'center',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
    },
    card: {
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderWidth: 1,
        gap: 10,
    },

    // Header : identité grade + (i)
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    gradeIdentity: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    gradeIcon: {
        fontSize: 38,
    },
    gradeLabelLine: {
        color: 'rgba(255,255,255,0.45)',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    },
    gradeName: {
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 0.3,
        marginTop: 1,
    },
    infoButton: {
        padding: 4,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 215, 0, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255, 215, 0, 0.3)',
    },

    // Compteur cochons
    cochonsLine: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: 13,
        textAlign: 'center',
    },
    cochonsNumber: {
        color: '#FFD700',
        fontWeight: '900',
        fontSize: 14,
    },

    // Barre de progression
    progressTrack: {
        height: 10,
        backgroundColor: 'rgba(0,0,0,0.45)',
        borderRadius: 6,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    progressFill: {
        height: '100%',
        borderRadius: 6,
    },

    // Prochain grade
    nextRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 2,
    },
    nextLabel: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    nextRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexShrink: 1,
    },
    nextIcon: {
        fontSize: 16,
    },
    nextName: {
        fontSize: 12,
        fontWeight: '800',
        flexShrink: 1,
    },
    nextRemaining: {
        color: 'rgba(255,255,255,0.55)',
        fontSize: 11,
        fontWeight: '700',
        marginLeft: 4,
    },
    maxRow: {
        textAlign: 'center',
        color: '#FFD700',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
});
