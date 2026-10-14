import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DominoTile } from '../src/components/DominoTile';
import { isPremiumActive, premiumService } from '../src/core/services/premium.service';

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

type PremiumExercise = {
    title: string;
    bot: string;
    strategy: string;
    prompt: string;
    options: readonly string[];
    answer: number;
    explanation: string;
};

// Ces exercices reprennent les principes réellement appliqués par les IA :
// MAPIPI conserve une sortie, GRAN-MOUN exploite sa valeur dominante et
// Mèt Kayali tient compte des valeurs sur lesquelles un adversaire a passé.
const premiumExercises: Record<'PRACTICE' | 'EXPERT', PremiumExercise[]> = {
    PRACTICE: [
        {
            title: 'Garder une sortie',
            bot: 'Méthode Mapipi',
            strategy: 'Conserver une valeur que tu peux rejouer.',
            prompt: 'La table est ouverte sur 3 et 6. Tu peux jouer 3|1 ou 6|5. Il te reste 1|4 et 1|6. Quel choix garde le plus de solutions ? ',
            options: ['Jouer 3|1', 'Jouer 6|5', 'Passer'],
            answer: 0,
            explanation: 'Après 3|1, tu ouvres sur 1 et tu conserves deux réponses : 1|4 et 1|6. Mapipi favorise ce type de continuité.',
        },
        {
            title: 'Se délester',
            bot: 'Méthode Mapipi',
            strategy: 'Sortir les points lourds quand le coup reste sûr.',
            prompt: 'Tu peux jouer 6|6 ou 6|1. Tes autres dominos couvrent encore le 6. Quel coup allège le mieux ta main ?',
            options: ['Jouer 6|1', 'Jouer 6|6', 'Attendre un autre tour'],
            answer: 1,
            explanation: 'Le double 6 retire 12 points. Lorsque la suite est assurée, réduire ce risque est le réflexe de Mapipi.',
        },
        {
            title: 'Ne pas ouvrir seul',
            bot: 'Méthode Mapipi',
            strategy: 'Éviter une extrémité sans relais dans sa main.',
            prompt: 'En jouant 4|2 tu ouvrirais sur 2, mais tu n’as aucun autre 2. En jouant 4|5 tu ouvrirais sur 5, avec deux autres 5 en main. Que joues-tu ?',
            options: ['4|2', '4|5', 'Passer'],
            answer: 1,
            explanation: 'Ouvrir sur 5 te laisse des réponses. Le moteur Mapipi pénalise les valeurs qui ne disposent d’aucun relais.',
        },
    ],
    EXPERT: [
        {
            title: 'Jouer sa clé',
            bot: 'Méthode Gran-Moun',
            strategy: 'Ouvrir sur une valeur que tu domines.',
            prompt: 'Tu détiens quatre dominos contenant le 5, contre un seul contenant le 2. Tu peux poser 6|5 ou 6|2. Quelle extrémité choisis-tu ?',
            options: ['Ouvrir sur 2 avec 6|2', 'Ouvrir sur 5 avec 6|5', 'Choisir au hasard'],
            answer: 1,
            explanation: 'Gran-Moun privilégie sa valeur dominante : ouvrir sur 5 augmente la probabilité que tu contrôles les prochains coups.',
        },
        {
            title: 'Lire un passage',
            bot: 'Méthode Gran-Moun',
            strategy: 'Exposer une valeur qui a déjà bloqué un adversaire.',
            prompt: 'Un adversaire a passé alors que les extrémités étaient 1 et 4. Tu peux maintenant ouvrir sur 1 ou sur 6. Quel choix met le plus de pression ?',
            options: ['Ouvrir sur 1', 'Ouvrir sur 6', 'Le passage ne donne aucune information'],
            answer: 0,
            explanation: 'Le passage indique que l’adversaire ne pouvait répondre ni au 1 ni au 4. Gran-Moun réutilise cette information pour le bloquer.',
        },
        {
            title: 'Fin de manche',
            bot: 'Méthode Mèt Kayali',
            strategy: 'Limiter le risque de boudé quand les mains sont courtes.',
            prompt: 'Il reste peu de dominos. Un coup ouvre sur 0, valeur déjà presque épuisée ; un autre ouvre sur 3, encore bien présente dans ta main. Que privilégier ?',
            options: ['Ouvrir sur 0', 'Ouvrir sur 3', 'Jouer le domino le plus lourd sans regarder'],
            answer: 1,
            explanation: 'Mèt Kayali évite les bouts morts et simule le risque de boudé. Ouvrir sur 3 conserve une issue et réduit le blocage subi.',
        },
    ],
};

export default function TrainingScreen() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TrainingTab>('BASICS');
    const [lessonIndex, setLessonIndex] = useState(0);
    const [exerciseIndex, setExerciseIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [hasPremium, setHasPremium] = useState(false);
    const lesson = lessons[lessonIndex];
    const isLastLesson = lessonIndex === lessons.length - 1;

    const tabs = useMemo(() => [
        { id: 'BASICS' as const, label: 'Apprendre les bases', icon: 'school-outline' as const, premium: false },
        { id: 'PRACTICE' as const, label: "S'entraîner", icon: 'fitness-outline' as const, premium: true },
        { id: 'EXPERT' as const, label: 'Devenir expert', icon: 'trophy-outline' as const, premium: true },
    ], []);

    useFocusEffect(useCallback(() => {
        let active = true;
        void premiumService.getEntitlement().then(entitlement => {
            if (active) setHasPremium(isPremiumActive(entitlement));
        });
        return () => { active = false; };
    }, []));

    const selectTab = (tab: TrainingTab) => {
        if (tab !== 'BASICS' && !hasPremium) {
            router.push('/premium' as never);
            return;
        }
        setActiveTab(tab);
        setExerciseIndex(0);
        setSelectedAnswer(null);
    };

    const exercise = activeTab === 'BASICS' ? null : premiumExercises[activeTab][exerciseIndex];

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
                            onPress={() => selectTab(tab.id)}
                            activeOpacity={0.8}
                        >
                            <Ionicons name={tab.premium && !hasPremium ? 'lock-closed' : tab.icon} size={15} color={isActive ? '#1A0E2E' : '#FFF'} />
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
                ) : exercise && (
                    <View style={styles.exerciseCard}>
                        <View style={styles.exerciseHeader}>
                            <View>
                                <Text style={styles.exerciseBadge}>{exercise.bot.toUpperCase()}</Text>
                                <Text style={styles.exerciseTitle}>{exercise.title}</Text>
                            </View>
                            <Text style={styles.exerciseProgress}>{exerciseIndex + 1}/{premiumExercises[activeTab].length}</Text>
                        </View>
                        <Text style={styles.exerciseStrategy}>{exercise.strategy}</Text>
                        <Text style={styles.exercisePrompt}>{exercise.prompt}</Text>
                        <View style={styles.answerList}>
                            {exercise.options.map((option, index) => {
                                const isSelected = selectedAnswer === index;
                                const isCorrect = index === exercise.answer;
                                return (
                                    <TouchableOpacity
                                        key={option}
                                        disabled={selectedAnswer !== null}
                                        onPress={() => setSelectedAnswer(index)}
                                        style={[
                                            styles.answer,
                                            isSelected && (isCorrect ? styles.answerCorrect : styles.answerWrong),
                                            selectedAnswer !== null && isCorrect && styles.answerCorrect,
                                        ]}
                                    >
                                        <Text style={styles.answerText}>{option}</Text>
                                        {selectedAnswer !== null && isCorrect && <Ionicons name="checkmark" size={19} color="#7EE081" />}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        {selectedAnswer !== null && (
                            <View style={styles.explanation}>
                                <Text style={styles.explanationTitle}>{selectedAnswer === exercise.answer ? 'Bien joué !' : 'À retenir'}</Text>
                                <Text style={styles.explanationText}>{exercise.explanation}</Text>
                            </View>
                        )}
                        <View style={styles.exerciseNavigation}>
                            <TouchableOpacity
                                disabled={exerciseIndex === 0}
                                style={[styles.secondaryButton, exerciseIndex === 0 && styles.invisibleButton]}
                                onPress={() => { setExerciseIndex(index => index - 1); setSelectedAnswer(null); }}
                            >
                                <Text style={styles.secondaryButtonText}>PRÉCÉDENT</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.primaryButton}
                                onPress={() => { setExerciseIndex(index => (index + 1) % premiumExercises[activeTab].length); setSelectedAnswer(null); }}
                            >
                                <Text style={styles.primaryButtonText}>SUIVANT</Text>
                                <Ionicons name="arrow-forward" size={18} color="#1A0E2E" />
                            </TouchableOpacity>
                        </View>
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
    exerciseCard: { flex: 1, padding: 20, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.30)' },
    exerciseHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    exerciseBadge: { color: '#FFD700', fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
    exerciseTitle: { marginTop: 4, color: '#FFF', fontSize: 23, fontWeight: '900' },
    exerciseProgress: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '800' },
    exerciseStrategy: { marginTop: 15, color: '#83D9FF', fontSize: 14, fontWeight: '800' },
    exercisePrompt: { marginTop: 14, color: 'rgba(255,255,255,0.86)', fontSize: 16, lineHeight: 23 },
    answerList: { marginTop: 18, gap: 9 },
    answer: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 14, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(0,0,0,0.16)' },
    answerCorrect: { borderColor: '#7EE081', backgroundColor: 'rgba(126,224,129,0.15)' },
    answerWrong: { borderColor: '#FF8A80', backgroundColor: 'rgba(255,138,128,0.12)' },
    answerText: { flex: 1, color: '#FFF', fontSize: 14, fontWeight: '700' },
    explanation: { marginTop: 15, padding: 14, borderRadius: 13, backgroundColor: 'rgba(112,214,255,0.12)' },
    explanationTitle: { color: '#83D9FF', fontSize: 14, fontWeight: '900' },
    explanationText: { marginTop: 4, color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 19 },
    exerciseNavigation: { marginTop: 'auto', paddingTop: 18, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    invisibleButton: { opacity: 0 },
});
