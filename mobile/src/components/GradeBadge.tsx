import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LeagueGrade } from '../core/economy.types';
import { LEAGUE_ICONS, LEAGUE_LABELS, LEAGUE_GRADE_COLORS } from '../core/economy.constants';

interface GradeBadgeProps {
    grade: string | null | undefined;
    size?: 'xs' | 'sm' | 'md';
}

/**
 * GradeBadge — Badge compact de grade Ligue des Cochons.
 * Utilisé dans le plateau de jeu, le lobby et la modal de résultat.
 */
export const GradeBadge: React.FC<GradeBadgeProps> = ({ grade, size = 'sm' }) => {
    // Grade null = joueur sans cochons encore (0 cochon donné)
    // → afficher un badge "Sans grade" cohérent avec getLeagueGradeLabel()
    const isDefault = !grade;
    const icon  = isDefault ? '🌱' : (LEAGUE_ICONS?.[grade as LeagueGrade]  || '🔰');
    const label = isDefault ? 'Sans grade' : (LEAGUE_LABELS?.[grade as LeagueGrade]  || grade);
    const color = isDefault ? '#78909C'   : (typeof LEAGUE_GRADE_COLORS !== 'undefined' && LEAGUE_GRADE_COLORS[grade as LeagueGrade] ? LEAGUE_GRADE_COLORS[grade as LeagueGrade] : 'rgba(255,255,255,0.4)');

    const fontSize   = size === 'xs' ? 7  : size === 'sm' ? 8  : 10;
    const iconSize   = size === 'xs' ? 9  : size === 'sm' ? 10 : 13;
    const paddingV   = size === 'xs' ? 1  : size === 'sm' ? 2  : 3;
    const paddingH   = size === 'xs' ? 4  : size === 'sm' ? 5  : 7;
    const radius     = size === 'xs' ? 4  : size === 'sm' ? 5  : 7;

    return (
        <View style={[
            styles.badge,
            {
                backgroundColor: `${color}18`,
                borderColor: `${color}60`,
                paddingVertical: paddingV,
                paddingHorizontal: paddingH,
                borderRadius: radius,
            }
        ]}>
            <Text style={{ fontSize: iconSize, lineHeight: iconSize + 2 }}>{icon}</Text>
            <Text style={[styles.label, { fontSize, color }]} numberOfLines={1}>
                {label}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        gap: 3,
        alignSelf: 'center',
        marginTop: 3,
    },
    label: {
        fontWeight: '800',
        letterSpacing: 0.3,
    },
});
