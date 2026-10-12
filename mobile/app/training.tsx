import React, { useMemo, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DominoTile } from '../src/components/DominoTile';

type TrainingTab = 'BASICS' | 'PRACTICE' | 'EXPERT';

const lessons = [
    {
        title: '1. Lire un domino',
        icon: 'apps-outline' as const,
        text: 'Chaque tuile possède deux valeurs, de 0 à 6. Les points indiquent la valeur de chaque moitié.',
        example: [2, 5] as const,
    },
    {
        title: '2. Respecter les extrémités',
        icon: 'git-branch-outline' as const,
        text: 'Pour poser un domino, l’une de ses valeurs doit correspondre à une extrémité ouverte sur la table.',
        example: [5, 1] as const,
    },
    {
        title: '3. Choisir son coup',
        icon: 'bulb-outline' as const,
        text: 'Plusieurs coups peuvent être légaux. Commence par repérer les valeurs présentes aux deux extrémités.',
        example: [1, 6] as const,
    },
    {
        title: '4. Passer et le boudé',
        icon: 'hand-left-outline' as const,
        text: 'Si aucun domino ne convient, tu passes. Le boudé et le comptage seront expliqués au fil de ta première partie.',
        example: [0, 0] as const,
    },
    {
        title: '5. Gagner une manche',
        icon: 'trophy-outline' as const,
        text: 'Pose tous tes dominos ou termine avec le moins de points. Une courte partie pratique te permettra de mettre ces bases en action.',
        example: [6, 6] as const,
    },
];

export default function TrainingScreen() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TrainingTab>('BASICS');
    const [lessonIndex, setLessonIndex] = useState(0);
    const lesson = lessons[lessonIndex];
    const isLastLesson = lessonIndex === lessons.length - 1;

    const tabs = useMemo(() => [
        { id: 'BASICS' as const, label: 'Apprendre les bases', icon: 'school-outline' as const, premium: false },
        { id: 'PRACTICE' as const, label: "S'entraîner", icon: 'fitness-outline' as const, premium: true },
        { id: 'EXPERT' as const, label: 'Devenir expert', icon: 'trophy-outline' as const, premium: true },
    ], []);

    const notifyComingSoon = (title: string) => {
        const message = 'Cette section Premium arrive bientôt. Le parcours débutant est disponible dès maintenant.';
        if (Platform.OS === 'web') {
            window.alert(`${title}\n\n${message}`);
            return;
        }
        Alert.alert(title, message);
    };

    const startGuidedGame = () => {
        router.push({
            pathname: '/game/[id]',
            params: {
                id: `training-basics-${Date.now()}`,
                mode: 'solo',
                difficulty: 'TI_MANMAY',
                gameMode: 'MANCHE',
                winningCondition: '1',
                turnDuration: '30',
                startingHandSize: '7',
                tableTier: 'DEBUTANT',
                training: 'basics',
            },
        });
    };

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient colors={['#102A43', '#1A0E2E']} style={StyleSheet.absoluteFillObject} />
            <View style={styles.tabs}>
                {tabs.map(tab => {
                    const isActive = activeTab === tab.id;
                    return (
                        <TouchableOpacity
                            key={tab.id}
                            style={[styles.tab, isActive && styles.tabActive]}
                            onPress={() => {
                                setActiveTab(tab.id);
                                if (tab.premium) notifyComingSoon(tab.label);
                            }}
                            activeOpacity={0.8}
                        >
                            <Ionicons name={tab.premium ? 'lock-closed' : tab.icon} size={15} color={isActive ? '#1A0E2E' : '#FFF'} />
                            <Text style={[styles.tabText, isActive && styles.tabTextActive]} numberOfLines={1}>{tab.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <View style={styles.content}>
                {activeTab === 'BASICS' ? (
                    <>
                        <View style={styles.progressRow}>
                            <Text style={styles.progressText}>Étape {lessonIndex + 1} sur {lessons.length}</Text>
                            <View style={styles.navigationButtons}>
                                {lessonIndex > 0 && (
                                    <TouchableOpacity style={styles.secondaryButton} onPress={() => setLessonIndex(index => index - 1)}>
                                        <Text style={styles.secondaryButtonText}>PRÉCÉDENT</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    style={styles.primaryButton}
                                    onPress={() => isLastLesson ? startGuidedGame() : setLessonIndex(index => index + 1)}
                                >
                                    <Text style={styles.primaryButtonText}>{isLastLesson ? 'PARTIE PRATIQUE' : 'SUIVANT'}</Text>
                                    <Ionicons name={isLastLesson ? 'play' : 'arrow-forward'} size={18} color="#1A0E2E" />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, { width: `${((lessonIndex + 1) / lessons.length) * 100}%` }]} />
                        </View>

                        <View style={styles.lessonLayout}>
                            <View style={styles.lessonCard}>
                                <Text style={styles.lessonTitle}>{lesson.title}</Text>
                                <Text style={styles.lessonText}>{lesson.text}</Text>
                            </View>
                            <View style={styles.illustrationCard}>
                                <View style={styles.lessonIcon}>
                                    <Ionicons name={lesson.icon} size={38} color="#FFD700" />
                                </View>
                                <View style={styles.dominoExample}>
                                    <DominoTile left={lesson.example[0]} right={lesson.example[1]} size={76} orientation="horizontal" animateOnMount={false} disablePressScale pipScale={0.58} />
                                </View>
                            </View>
                        </View>
                    </>
                ) : (
                    <View style={styles.lockedCard}>
                        <View style={styles.lockIcon}><Ionicons name="lock-closed" size={36} color="#FFD700" /></View>
                        <Text style={styles.lockedTitle}>{activeTab === 'PRACTICE' ? "S'entraîner" : 'Devenir expert'}</Text>
                        <Text style={styles.lockedText}>Contenu Premium — bientôt disponible.</Text>
                        <Text style={styles.lockedDetail}>
                            {activeTab === 'PRACTICE'
                                ? 'Niveaux de difficulté, aides activables et défis pratiques.'
                                : 'Stratégies avancées, lecture du jeu et mises en situation.'}
                        </Text>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1A0E2E' },
    tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
    tab: { flex: 1, minHeight: 46, borderRadius: 12, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
    tabActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
    tabText: { color: '#FFF', fontSize: 11, fontWeight: '800', textAlign: 'center' },
    tabTextActive: { color: '#1A0E2E' },
    content: { flex: 1, padding: 20, paddingTop: 4, gap: 12 },
    progressRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    progressText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '700' },
    navigationButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    progressTrack: { height: 7, borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.14)' },
    progressFill: { height: '100%', borderRadius: 4, backgroundColor: '#FFD700' },
    lessonLayout: { flex: 1, flexDirection: 'row', gap: 14, minHeight: 0 },
    lessonCard: { flex: 1.25, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.32)', borderRadius: 22, padding: 22, gap: 16 },
    illustrationCard: { flex: 0.75, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(27,67,50,0.76)', borderWidth: 1, borderColor: 'rgba(112,214,255,0.3)', borderRadius: 22, padding: 18, gap: 18 },
    lessonIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,215,0,0.14)' },
    lessonTitle: { color: '#FFF', fontSize: 23, fontWeight: '900' },
    lessonText: { color: 'rgba(255,255,255,0.84)', fontSize: 16, lineHeight: 23 },
    dominoExample: { marginTop: 8, padding: 12, borderRadius: 14, backgroundColor: '#1B4332' },
    secondaryButton: { minHeight: 42, paddingHorizontal: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
    secondaryButtonText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
    primaryButton: { minHeight: 42, paddingHorizontal: 16, borderRadius: 14, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFD700' },
    primaryButtonText: { color: '#1A0E2E', fontSize: 13, fontWeight: '900' },
    lockedCard: { alignItems: 'center', padding: 30, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.30)', gap: 12 },
    lockIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,215,0,0.13)' },
    lockedTitle: { color: '#FFF', fontSize: 23, fontWeight: '900' },
    lockedText: { color: '#FFD700', fontSize: 15, fontWeight: '800' },
    lockedDetail: { color: 'rgba(255,255,255,0.72)', fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
