import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DominoTile } from '../src/components/DominoTile';
import { TrainingBoardScenario, TrainingExerciseBoard, TrainingExerciseResult } from '../src/features/training/TrainingExerciseBoard';
import { TrainingExerciseOnboarding } from '../src/features/training/TrainingExerciseOnboarding';
import { TrainingHub } from '../src/features/training/TrainingHub';
import { isPremiumActive, premiumService } from '../src/core/services/premium.service';

type TrainingTab = 'HOME' | 'BASICS' | 'PRACTICE' | 'EXPERT';
type CourseTab = Exclude<TrainingTab, 'HOME'>;

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
    board: TrainingBoardScenario;
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
            prompt: 'La table est ouverte sur 3 et 6. Pose le domino qui garde le plus de solutions pour la suite.',
            board: { table: [[3, 6]], hand: [[3, 1], [6, 5], [1, 4], [1, 6]], targetIndex: 0, targetSide: 'left' },
            explanation: 'Après 3|1, tu ouvres sur 1 et tu conserves deux réponses : 1|4 et 1|6. Mapipi favorise ce type de continuité.',
        },
        {
            title: 'Se délester',
            bot: 'Méthode Mapipi',
            strategy: 'Sortir les points lourds quand le coup reste sûr.',
            prompt: 'Tes autres dominos couvrent encore le 6. Pose le coup qui allège le mieux ta main.',
            board: { table: [[6, 4]], hand: [[6, 1], [6, 6], [4, 2]], targetIndex: 1, targetSide: 'left' },
            explanation: 'Le double 6 retire 12 points. Lorsque la suite est assurée, réduire ce risque est le réflexe de Mapipi.',
        },
        {
            title: 'Ne pas ouvrir seul',
            bot: 'Méthode Mapipi',
            strategy: 'Éviter une extrémité sans relais dans sa main.',
            prompt: 'Évite d’ouvrir sur une valeur sans relais : choisis le domino qui laisse des réponses en main.',
            board: { table: [[4, 3]], hand: [[4, 2], [4, 5], [5, 1], [5, 6]], targetIndex: 1, targetSide: 'left' },
            explanation: 'Ouvrir sur 5 te laisse des réponses. Le moteur Mapipi pénalise les valeurs qui ne disposent d’aucun relais.',
        },
        {
            title: 'Utiliser un double',
            bot: 'Méthode Mapipi',
            strategy: 'Poser un double lourd quand il garde une continuité.',
            prompt: 'Le 2 reste bien couvert dans ta main. Pose le domino qui réduit ton risque de points.',
            board: { table: [[2, 5]], hand: [[2, 2], [5, 1], [2, 6], [6, 3]], targetIndex: 0, targetSide: 'left' },
            explanation: 'Le double 2 enlève 4 points tout en laissant le 2 ouvert, valeur que tu peux encore rejouer avec 2|6.',
        },
        {
            title: 'Deux portes ouvertes',
            bot: 'Méthode Mapipi',
            strategy: 'Ouvrir sur une valeur avec plusieurs relais.',
            prompt: 'Choisis le coup qui te laisse plusieurs réponses pour le prochain tour.',
            board: { table: [[4, 1]], hand: [[4, 5], [1, 3], [5, 2], [5, 6]], targetIndex: 0, targetSide: 'left' },
            explanation: 'Après 4|5, tu ouvres sur 5 et conserves deux relais : 5|2 et 5|6.',
        },
        {
            title: 'Le lourd assuré',
            bot: 'Méthode Mapipi',
            strategy: 'Écarter un gros domino seulement si la suite est couverte.',
            prompt: 'Le 6 est encore présent dans ta main. Quel coup réduit le plus tes points sans te bloquer ?',
            board: { table: [[6, 2]], hand: [[6, 6], [6, 3], [2, 1], [3, 5]], targetIndex: 0, targetSide: 'left' },
            explanation: 'Le double 6 retire 12 points et tu gardes 6|3 pour répondre si le 6 revient sur la table.',
        },
        {
            title: 'Éviter le bout mort',
            bot: 'Méthode Mapipi',
            strategy: 'Ne pas ouvrir une valeur qui n’a aucun relais.',
            prompt: 'Pose le domino qui ne crée pas une extrémité isolée dans ta main.',
            board: { table: [[1, 4]], hand: [[1, 5], [4, 0], [5, 2], [5, 6]], targetIndex: 0, targetSide: 'left' },
            explanation: 'Ouvrir sur 5 est préférable : tu as ensuite 5|2 et 5|6. Ouvrir sur 0 ne te laisserait aucune réponse.',
        },
        {
            title: 'Préserver le relais',
            bot: 'Méthode Mapipi',
            strategy: 'Choisir la sortie qui prolonge naturellement la main.',
            prompt: 'Repère la valeur que tu peux immédiatement rejouer après ta pose.',
            board: { table: [[5, 2]], hand: [[5, 3], [2, 6], [3, 1], [3, 4]], targetIndex: 0, targetSide: 'left' },
            explanation: 'Avec 5|3, tu gardes deux réponses sur 3 : 3|1 et 3|4. C’est une sortie solide.',
        },
        {
            title: 'Alléger sans fermer',
            bot: 'Méthode Mapipi',
            strategy: 'Retirer des points tout en gardant une porte de sortie.',
            prompt: 'Le 4 reste disponible dans ta main. Pose le domino le plus lourd qui garde cette continuité.',
            board: { table: [[0, 4]], hand: [[4, 4], [0, 1], [4, 6], [6, 2]], targetIndex: 0, targetSide: 'right' },
            explanation: 'Le double 4 enlève 8 points et tu gardes 4|6 pour continuer sur 4 si nécessaire.',
        },
        {
            title: 'Préparer la fin',
            bot: 'Méthode Mapipi',
            strategy: 'Jouer vers une valeur que ta main peut encore soutenir.',
            prompt: 'La manche avance : choisis le coup qui te laisse une réponse directe.',
            board: { table: [[1, 6]], hand: [[1, 3], [6, 0], [3, 5], [5, 2]], targetIndex: 0, targetSide: 'left' },
            explanation: 'Après 1|3, tu peux immédiatement répondre avec 3|5. Cette continuité évite de subir la table.',
        },
    ],
    EXPERT: [
        {
            title: 'Jouer sa clé',
            bot: 'Méthode Gran-Moun',
            strategy: 'Ouvrir sur une valeur que tu domines.',
            prompt: 'Tu domines la valeur 5. Pose le domino qui t’aide à conserver le contrôle de la table.',
            board: { table: [[6, 1]], hand: [[6, 2], [6, 5], [5, 3], [5, 4]], targetIndex: 1, targetSide: 'left' },
            explanation: 'Gran-Moun privilégie sa valeur dominante : ouvrir sur 5 augmente la probabilité que tu contrôles les prochains coups.',
        },
        {
            title: 'Lire un passage',
            bot: 'Méthode Gran-Moun',
            strategy: 'Exposer une valeur qui a déjà bloqué un adversaire.',
            prompt: 'Un adversaire a passé avec le 1 ouvert. Pose le domino qui exploite cette information.',
            board: { table: [[4, 2]], hand: [[1, 4], [6, 4], [2, 5]], targetIndex: 0, targetSide: 'left' },
            explanation: 'Le passage indique que l’adversaire ne pouvait répondre ni au 1 ni au 4. Gran-Moun réutilise cette information pour le bloquer.',
        },
        {
            title: 'Fin de manche',
            bot: 'Méthode Mèt Kayali',
            strategy: 'Limiter le risque de boudé quand les mains sont courtes.',
            prompt: 'Les mains sont courtes : privilégie une sortie encore présente dans ta main pour éviter le boudé.',
            board: { table: [[6, 2]], hand: [[6, 0], [6, 3], [3, 1], [3, 5]], targetIndex: 1, targetSide: 'left' },
            explanation: 'Mèt Kayali évite les bouts morts et simule le risque de boudé. Ouvrir sur 3 conserve une issue et réduit le blocage subi.',
        },
    ],
};

export default function TrainingScreen() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TrainingTab>('HOME');
    const [lessonIndex, setLessonIndex] = useState(0);
    const [exerciseIndex, setExerciseIndex] = useState(0);
    const [exerciseResult, setExerciseResult] = useState<TrainingExerciseResult | null>(null);
    const [exerciseAttempt, setExerciseAttempt] = useState(0);
    const [showExerciseInfo, setShowExerciseInfo] = useState(false);
    const [showExerciseResult, setShowExerciseResult] = useState(false);
    const [showPracticeOnboarding, setShowPracticeOnboarding] = useState(false);
    const [transitionExerciseNumber, setTransitionExerciseNumber] = useState<number | null>(null);
    const resultPopupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const exerciseTransition = useRef(new Animated.Value(0)).current;
    const [hasPremium, setHasPremium] = useState(false);
    const { height } = useWindowDimensions();
    const compactLayout = height < 700;
    const exampleDominoSize = compactLayout ? 48 : 76;
    const lesson = lessons[lessonIndex];
    const isLastLesson = lessonIndex === lessons.length - 1;

    useEffect(() => () => {
        if (resultPopupTimer.current) clearTimeout(resultPopupTimer.current);
        if (transitionTimer.current) clearTimeout(transitionTimer.current);
        exerciseTransition.stopAnimation();
    }, [exerciseTransition]);

    const clearResultPopupTimer = () => {
        if (resultPopupTimer.current) {
            clearTimeout(resultPopupTimer.current);
            resultPopupTimer.current = null;
        }
    };

    useFocusEffect(useCallback(() => {
        let active = true;
        void premiumService.getEntitlement().then(entitlement => {
            if (active) setHasPremium(isPremiumActive(entitlement));
        });
        return () => { active = false; };
    }, []));

    const selectTab = (tab: CourseTab) => {
        if ((tab === 'PRACTICE' || tab === 'EXPERT') && !hasPremium) {
            router.push('/premium' as never);
            return;
        }
        setActiveTab(tab);
        clearResultPopupTimer();
        setExerciseIndex(0);
        setExerciseResult(null);
        setShowExerciseInfo(false);
        setShowExerciseResult(false);
        setShowPracticeOnboarding(tab === 'PRACTICE');
    };

    const exercise = activeTab === 'PRACTICE' || activeTab === 'EXPERT' ? premiumExercises[activeTab][exerciseIndex] : null;

    const moveToNextExercise = () => {
        clearResultPopupTimer();
        const exercises = premiumExercises[activeTab as 'PRACTICE' | 'EXPERT'];
        const isLastExercise = exerciseIndex === exercises.length - 1;
        if (activeTab === 'EXPERT' && isLastExercise) {
            setShowExerciseResult(false);
            return;
        }

        const nextIndex = isLastExercise ? 0 : exerciseIndex + 1;
        if (activeTab === 'PRACTICE' && isLastExercise) setActiveTab('EXPERT');
        setExerciseIndex(nextIndex);
        setExerciseResult(null);
        setShowExerciseResult(false);
        setShowExerciseInfo(false);
        if (transitionTimer.current) clearTimeout(transitionTimer.current);
        exerciseTransition.stopAnimation();
        transitionTimer.current = setTimeout(() => {
            setTransitionExerciseNumber(nextIndex + 1);
            exerciseTransition.setValue(0);
            Animated.sequence([
                Animated.timing(exerciseTransition, { toValue: 1, duration: 180, useNativeDriver: true }),
                Animated.delay(520),
                Animated.timing(exerciseTransition, { toValue: 0, duration: 260, useNativeDriver: true }),
            ]).start(({ finished }) => {
                if (finished) setTransitionExerciseNumber(null);
            });
        }, 140);
    };

    const handleExerciseResult = (result: TrainingExerciseResult) => {
        setExerciseResult(result);
        clearResultPopupTimer();
        resultPopupTimer.current = setTimeout(() => {
            setShowExerciseResult(true);
            resultPopupTimer.current = null;
        }, 1000);
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

    const startTableTour = () => {
        router.push({
            pathname: '/game/[id]',
            params: {
                id: `training-table-${Date.now()}`,
                mode: 'solo',
                difficulty: 'TI_MANMAY',
                gameMode: 'MANCHE',
                winningCondition: '1',
                turnDuration: '30',
                startingHandSize: '7',
                tableTier: 'DEBUTANT',
                training: 'table',
            },
        });
    };

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient colors={['#102A43', '#1A0E2E']} style={StyleSheet.absoluteFillObject} />
            {activeTab === 'HOME' ? <TrainingHub
                onLearnBasics={() => selectTab('BASICS')}
                onUnderstandTable={startTableTour}
                onFreeGame={startGuidedGame}
                onPractice={() => selectTab('PRACTICE')}
                onExpert={() => selectTab('EXPERT')}
            /> : <>
            <View style={styles.courseBar}>
                <TouchableOpacity style={styles.courseHomeButton} onPress={() => setActiveTab('HOME')} accessibilityLabel="Retour à l'accueil entraînement">
                    <Ionicons name="arrow-back" size={17} color="#FFF" /><Text style={styles.courseHomeText}>ENTRAÎNEMENT</Text>
                </TouchableOpacity>
            </View>
            <ScrollView
                style={styles.contentScroll}
                contentContainerStyle={[styles.content, compactLayout && styles.contentCompact]}
                showsVerticalScrollIndicator={compactLayout}
            >
                {activeTab === 'BASICS' ? (
                    <>
                        <View style={[styles.progressRow, compactLayout && styles.progressRowCompact]}>
                            <Text style={styles.progressText}>Étape {lessonIndex + 1} sur {lessons.length}</Text>
                            <View style={styles.navigationButtons}>
                                {lessonIndex > 0 && (
                                    <TouchableOpacity style={styles.secondaryButton} onPress={() => setLessonIndex(index => index - 1)}>
                                        <Text style={styles.secondaryButtonText}>PRÉCÉDENT</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    style={[styles.primaryButton, !isLastLesson && styles.iconPrimaryButton]}
                                    onPress={() => isLastLesson ? startGuidedGame() : setLessonIndex(index => index + 1)}
                                    accessibilityLabel={isLastLesson ? 'Lancer la partie pratique' : 'Étape suivante'}
                                >
                                    {isLastLesson && <Text style={styles.primaryButtonText}>PARTIE PRATIQUE</Text>}
                                    <Ionicons name={isLastLesson ? 'play' : 'arrow-forward'} size={18} color="#1A0E2E" />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, { width: `${((lessonIndex + 1) / lessons.length) * 100}%` }]} />
                        </View>

                        <View style={[styles.lessonLayout, compactLayout && styles.lessonLayoutCompact]}>
                            <View style={[styles.lessonCard, compactLayout && styles.lessonCardCompact]}>
                                <Text style={styles.lessonTitle}>{lesson.title}</Text>
                                <Text style={styles.lessonText}>{lesson.text}</Text>
                            </View>
                            <View style={[styles.illustrationCard, compactLayout && styles.illustrationCardCompact]}>
                                <View style={[styles.lessonIcon, compactLayout && styles.lessonIconCompact]}>
                                    <Ionicons name={lesson.icon} size={compactLayout ? 26 : 38} color="#FFD700" />
                                </View>
                                <View style={[styles.dominoExample, compactLayout && styles.dominoExampleCompact]}>
                                    <DominoTile left={lesson.example[0]} right={lesson.example[1]} size={exampleDominoSize} orientation="horizontal" animateOnMount={false} disablePressScale pipScale={0.58} />
                                </View>
                            </View>
                        </View>
                    </>
                ) : exercise && (
                    <View style={styles.exerciseCard}>
                        <View style={styles.exerciseHeader}>
                            <View style={styles.exerciseTitleGroup}>
                                <View>
                                <Text style={styles.exerciseBadge}>{exercise.bot.toUpperCase()}</Text>
                                <Text style={styles.exerciseTitle}>{exercise.title}</Text>
                                </View>
                            </View>
                            <TouchableOpacity style={styles.exerciseInfoButton} onPress={() => setShowExerciseInfo(true)} accessibilityLabel="Voir l'explication de l'exercice">
                                <Ionicons name="information-circle-outline" size={16} color="#FFD700" />
                                <Text style={styles.exerciseInfoText}>INFO</Text>
                            </TouchableOpacity>
                            <View style={styles.exerciseHeaderActions}>
                                <Text style={styles.exerciseProgress}>{exerciseIndex + 1}/{premiumExercises[activeTab as 'PRACTICE' | 'EXPERT'].length}</Text>
                                <TouchableOpacity style={styles.exerciseNextButton} onPress={moveToNextExercise} accessibilityLabel="Exercice suivant">
                                    <Text style={styles.exerciseNextText}>SUIVANT</Text>
                                    <Ionicons name="arrow-forward" size={15} color="#1A0E2E" />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <TrainingExerciseBoard scenario={exercise.board} result={exerciseResult} resetToken={exerciseAttempt} onResult={handleExerciseResult} />
                    </View>
                )}
            </ScrollView>
            </>}
            {exercise && (
                <>
                    <Modal visible={showExerciseInfo} transparent animationType="fade" onRequestClose={() => setShowExerciseInfo(false)}>
                        <View style={styles.infoModalOverlay}>
                            <View style={styles.infoModalCard}>
                                <View style={styles.trainingModalHeader}><Text style={styles.trainingModalTitle}>{exercise.title}</Text><TouchableOpacity onPress={() => setShowExerciseInfo(false)}><Ionicons name="close" size={23} color="#FFF" /></TouchableOpacity></View>
                                <Text style={styles.exerciseStrategy}>{exercise.strategy}</Text>
                                <Text style={styles.trainingModalText}>{exercise.prompt}</Text>
                            </View>
                        </View>
                    </Modal>
                    <Modal visible={showExerciseResult} transparent animationType="fade" onRequestClose={() => setShowExerciseResult(false)}>
                        <View style={styles.resultModalOverlay}>
                            <View style={styles.resultModalCard}>
                                <Ionicons name={exerciseResult === 'correct' ? 'checkmark-circle' : 'refresh-circle'} size={38} color={exerciseResult === 'correct' ? '#7EE081' : '#FFD700'} />
                                <Text style={[styles.trainingModalTitle, styles.resultModalTitle]}>{exerciseResult === 'correct' ? 'Bien joué !' : exerciseResult === 'suboptimal' ? 'Jouable, mais…' : 'Coup impossible'}</Text>
                                <Text style={[styles.trainingModalText, styles.resultModalText]}>{exerciseResult === 'correct' ? exercise.explanation : exerciseResult === 'suboptimal' ? 'Ce domino peut être posé, mais ce n’est pas le meilleur jeu dans cette situation.' : 'Ce domino ne correspond pas à la valeur ouverte de cette extrémité.'}</Text>
                                <TouchableOpacity style={[styles.trainingModalButton, styles.resultModalButton]} onPress={() => exerciseResult === 'correct' ? moveToNextExercise() : (() => { setExerciseAttempt(attempt => attempt + 1); setExerciseResult(null); setShowExerciseResult(false); })()}>
                                    <Text style={styles.trainingModalButtonText}>{exerciseResult === 'correct' ? 'CONTINUER' : 'RÉESSAYER'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>
                </>
            )}
            {transitionExerciseNumber !== null && (
                <Animated.View pointerEvents="none" style={[styles.exerciseTransitionOverlay, { opacity: exerciseTransition }]}>
                    <Animated.View style={[styles.exerciseTransitionCard, { transform: [{ scale: exerciseTransition.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) }] }]}>
                        <Ionicons name="sparkles" size={28} color="#FFD700" />
                        <Text style={styles.exerciseTransitionEyebrow}>NOUVEAU DÉFI</Text>
                        <Text style={styles.exerciseTransitionTitle}>Exercice {transitionExerciseNumber}</Text>
                    </Animated.View>
                </Animated.View>
            )}
            {showPracticeOnboarding && <TrainingExerciseOnboarding onComplete={() => setShowPracticeOnboarding(false)} />}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1A0E2E' },
    courseBar: { minHeight: 38, paddingHorizontal: 15, justifyContent: 'center' },
    courseHomeButton: { alignSelf: 'flex-start', minHeight: 30, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)' },
    courseHomeText: { color: '#FFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
    contentScroll: { flex: 1 },
    content: { flexGrow: 1, padding: 20, paddingTop: 4, gap: 12 },
    contentCompact: { paddingHorizontal: 14, paddingBottom: 18, gap: 9 },
    progressRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    progressRowCompact: { minHeight: 38 },
    progressText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '700' },
    navigationButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    progressTrack: { height: 7, borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.14)' },
    progressFill: { height: '100%', borderRadius: 4, backgroundColor: '#FFD700' },
    lessonLayout: { flex: 1, flexDirection: 'row', gap: 14, minHeight: 0 },
    lessonLayoutCompact: { flex: 0, minHeight: 184, gap: 9 },
    lessonCard: { flex: 1.25, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.32)', borderRadius: 22, padding: 22, gap: 16 },
    lessonCardCompact: { borderRadius: 16, padding: 14, gap: 8 },
    illustrationCard: { flex: 0.75, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(27,67,50,0.76)', borderWidth: 1, borderColor: 'rgba(112,214,255,0.3)', borderRadius: 22, padding: 18, gap: 18 },
    illustrationCardCompact: { borderRadius: 16, padding: 8, gap: 7, overflow: 'hidden' },
    lessonIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,215,0,0.14)' },
    lessonIconCompact: { width: 40, height: 40, borderRadius: 20 },
    lessonTitle: { color: '#FFF', fontSize: 23, fontWeight: '900' },
    lessonText: { color: 'rgba(255,255,255,0.84)', fontSize: 16, lineHeight: 23 },
    dominoExample: { marginTop: 8, padding: 12, borderRadius: 14, backgroundColor: '#1B4332' },
    dominoExampleCompact: { marginTop: 0, padding: 5, borderRadius: 9 },
    secondaryButton: { minHeight: 42, paddingHorizontal: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
    secondaryButtonText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
    primaryButton: { minHeight: 42, paddingHorizontal: 16, borderRadius: 14, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFD700' },
    iconPrimaryButton: { minWidth: 42, paddingHorizontal: 0 },
    primaryButtonText: { color: '#1A0E2E', fontSize: 13, fontWeight: '900' },
    exerciseCard: { flex: 1, minHeight: 0, padding: 14, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.30)' },
    exerciseHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    exerciseTitleGroup: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
    exerciseInfoButton: { position: 'absolute', top: 7, left: '50%', minWidth: 64, minHeight: 30, marginLeft: -32, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 15, backgroundColor: 'rgba(255,215,0,0.12)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.45)' },
    exerciseInfoText: { color: '#FFD700', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
    exerciseHeaderActions: { alignItems: 'flex-end', gap: 5 },
    exerciseBadge: { color: '#FFD700', fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
    exerciseTitle: { marginTop: 2, color: '#FFF', fontSize: 20, fontWeight: '900' },
    exerciseProgress: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '800' },
    exerciseNextButton: { minHeight: 31, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 10, backgroundColor: '#FFD700' },
    exerciseNextText: { color: '#1A0E2E', fontSize: 10, fontWeight: '900' },
    exerciseStrategy: { marginTop: 10, color: '#83D9FF', fontSize: 14, fontWeight: '800' },
    exercisePrompt: { color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 18, textAlign: 'center' },
    answerList: { marginTop: 18, gap: 9 },
    answer: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 14, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(0,0,0,0.16)' },
    answerCorrect: { borderColor: '#7EE081', backgroundColor: 'rgba(126,224,129,0.15)' },
    answerWrong: { borderColor: '#FF8A80', backgroundColor: 'rgba(255,138,128,0.12)' },
    answerText: { flex: 1, color: '#FFF', fontSize: 14, fontWeight: '700' },
    trainingModalOverlay: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: 'rgba(0,0,0,0.7)' },
    trainingModalCard: { padding: 20, borderRadius: 21, backgroundColor: '#2D1B4E', borderWidth: 1, borderColor: 'rgba(255,215,0,0.48)' },
    resultModalOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.58)' },
    resultModalCard: { width: '33%', alignItems: 'center', padding: 14, borderRadius: 19, backgroundColor: '#2D1B4E', borderWidth: 1, borderColor: 'rgba(255,215,0,0.55)' },
    resultModalTitle: { textAlign: 'center' },
    resultModalText: { textAlign: 'center' },
    resultModalButton: { marginTop: 20, paddingHorizontal: 12, paddingVertical: 13 },
    infoModalOverlay: { flex: 1, alignItems: 'flex-start', justifyContent: 'flex-start', paddingTop: 78, paddingLeft: 12 },
    infoModalCard: { width: '46%', padding: 14, borderRadius: 19, backgroundColor: 'rgba(45,27,78,0.97)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.58)' },
    trainingModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    trainingModalTitle: { flex: 1, color: '#FFF', fontSize: 20, fontWeight: '900' },
    trainingModalText: { marginTop: 12, color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 20 },
    trainingModalButton: { minHeight: 45, marginTop: 19, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#FFD700' },
    trainingModalButtonText: { color: '#1A0E2E', fontSize: 12, fontWeight: '900' },
    exerciseTransitionOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(16,42,67,0.42)' },
    exerciseTransitionCard: { minWidth: 176, alignItems: 'center', paddingHorizontal: 24, paddingVertical: 19, borderRadius: 22, backgroundColor: '#2D1B4E', borderWidth: 1, borderColor: '#FFD700' },
    exerciseTransitionEyebrow: { marginTop: 7, color: '#FFD700', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    exerciseTransitionTitle: { marginTop: 3, color: '#FFF', fontSize: 22, fontWeight: '900' },
});
