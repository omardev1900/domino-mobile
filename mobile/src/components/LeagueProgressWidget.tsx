import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
    LEAGUE_LABELS,
    LEAGUE_ICONS,
    LEAGUE_GRADE_COLORS,
} from '../core/economy.constants';
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

    const gradeColor = currentGrade && typeof LEAGUE_GRADE_COLORS !== 'undefined' ? LEAGUE_GRADE_COLORS[currentGrade] : '#888';
    const gradeIcon = currentGrade ? LEAGUE_ICONS[currentGrade] : '🔰';
    const gradeLabel = currentGrade ? LEAGUE_LABELS[currentGrade] : 'Sans grade';

    return (
        <Animated.View entering={FadeInUp.delay(100).duration(500)} style={[styles.container, style]}>
            <TouchableOpacity
                style={styles.pressable}
                onPress={onInfoPress}
                disabled={!onInfoPress}
                activeOpacity={0.78}
                accessibilityRole="button"
                accessibilityLabel="Voir la ligue et mon grade"
            >
                <LinearGradient colors={['#0A1938', '#010619']} style={[styles.card, { borderColor: `${gradeColor}55` }]}>

                    {/* Ligne 1 : icône et nom du grade */}
                    <View style={styles.gradeIdentity}>
                        <Text style={styles.gradeIcon}>{gradeIcon}</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.gradeLabelLine}>Mon grade</Text>
                            <Text style={[styles.gradeName, { color: gradeColor }]} numberOfLines={1}>
                                {gradeLabel}
                            </Text>
                        </View>
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
                </LinearGradient>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: '100%',
        maxWidth: 360,
        alignSelf: 'center',
    },
    pressable: {
        flex: 1,
    },
    card: {
        flex: 1,
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderWidth: 1,
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
});
