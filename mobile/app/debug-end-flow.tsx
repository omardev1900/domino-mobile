/**
 * Prévisualisation locale des fins de jeu.
 * Cet écran ne modifie ni Firebase, ni l'économie : il injecte des états de jeu
 * représentatifs dans les vrais composants d'animation.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { RoundEndFlow } from '../src/components/game/RoundEndFlow';
import { GamePhase, GameState, MancheResult, Player } from '../src/core/types';

type PreviewScenario = 'ROUND' | 'ROUND_TIE' | 'ROUND_BLOCKED_WINNER' | 'MANCHE_NORMAL' | 'CHIRE' | 'COCHON' | 'DOUBLE_COCHON' | 'MATCH';

interface ScenarioDefinition {
    id: PreviewScenario;
    label: string;
    description: string;
    phase: GamePhase;
    mancheResult?: MancheResult;
}

const SCENARIOS: ScenarioDefinition[] = [
    { id: 'ROUND', label: 'Fin de round', description: 'Le bot pose son dernier domino.', phase: 'PARTIE_END' },
    { id: 'ROUND_TIE', label: 'Round à égalité', description: 'La partie est bloquée, sans vainqueur.', phase: 'BOUDE' },
    { id: 'ROUND_BLOCKED_WINNER', label: 'Round bloqué', description: 'Mickaël gagne avec le score le plus bas.', phase: 'BOUDE' },
    { id: 'MANCHE_NORMAL', label: 'Manche gagnée', description: 'Animation classique de fin de manche.', phase: 'MANCHE_END', mancheResult: 'NORMAL' },
    { id: 'CHIRE', label: 'Chiré', description: 'Manche annulée : aucun gagnant.', phase: 'MANCHE_END', mancheResult: 'CHIRE' },
    { id: 'COCHON', label: 'Cochon simple', description: 'Un joueur reçoit un cochon.', phase: 'MANCHE_END', mancheResult: 'COCHON' },
    { id: 'DOUBLE_COCHON', label: 'Double cochon', description: 'Deux joueurs reçoivent un cochon.', phase: 'MANCHE_END', mancheResult: 'COCHON' },
    { id: 'MATCH', label: 'Fin de match', description: 'Le bot clôture le match.', phase: 'MATCH_END' },
];

const domino = (id: string, left: 0 | 1 | 2 | 3 | 4 | 5 | 6, right: 0 | 1 | 2 | 3 | 4 | 5 | 6) => ({ id, left, right, isDouble: left === right });

const createPlayer = (id: string, name: string, status: Player['status'], handSize: number): Player => ({
    id,
    name,
    avatarId: id === 'bot-1' ? 'avatar_2' : id === 'bot-2' ? 'avatar_3' : 'avatar_default',
    hand: handSize > 0 ? [domino(`${id}-last`, 1, 4)] : [],
    handSize,
    currentMancheStars: 1,
    wins: 0,
    mancheWins: 0,
    totalRoundWins: 1,
    totalPoints: 1,
    isCochon: false,
    totalCochons: 0,
    totalCochonsInfliges: 0,
    totalCochonsSubis: 0,
    status,
});

const createState = (scenario: ScenarioDefinition): GameState => {
    const players = [
        createPlayer('local-preview', 'Vous', 'HUMAN', 1),
        createPlayer('bot-1', 'Mickaël', 'BOT', 0),
        createPlayer('bot-2', 'Lina', 'BOT', 1),
    ];
    const giver = players[1];
    giver.totalCochonsInfliges = scenario.id === 'DOUBLE_COCHON' ? 2 : scenario.id === 'COCHON' ? 1 : 0;
    if (scenario.id === 'COCHON' || scenario.id === 'DOUBLE_COCHON') {
        players[0].isCochon = true;
        players[0].totalCochonsSubis = 1;
        if (scenario.id === 'DOUBLE_COCHON') {
            players[2].isCochon = true;
            players[2].totalCochonsSubis = 1;
        }
    }
    if (scenario.id === 'MATCH') giver.mancheWins = 3;
    if (scenario.id === 'ROUND_TIE') {
        players.forEach(player => {
            player.hand = [domino(`${player.id}-tie`, 2, 3)];
            player.handSize = 1;
        });
    }

    return {
        gameId: `debug-${scenario.id.toLowerCase()}`,
        players,
        talonMort: [],
        table: { sequence: [{ domino: domino('bot-final', 6, 6), sideAtTable: 'left', isReversed: false }], leftValue: 6, rightValue: 6 },
        currentPlayerId: 'bot-1',
        phase: scenario.phase,
        firstPlayerOfRound: 'bot-1',
        history: [{ playerId: 'bot-1', action: 'PLAY', domino: domino('bot-final', 6, 6), timestamp: Date.now() }],
        winningCondition: 3,
        gameMode: 'COCHON',
        mancheResult: scenario.mancheResult ?? null,
        turnDuration: 15,
        lastActionTimestamp: Date.now(),
        turnId: 1,
        mancheHistory: scenario.mancheResult ? [{
            mancheNumber: 1,
            points: { 'local-preview': 0, 'bot-1': 1, 'bot-2': 0 },
            winnerId: scenario.mancheResult === 'CHIRE' ? 'TIE' : 'bot-1',
            resultType: scenario.mancheResult,
            cochonCount: scenario.id === 'DOUBLE_COCHON' ? 2 : scenario.id === 'COCHON' ? 1 : 0,
        }] : [],
        roundNumber: 3,
        mancheNumber: 1,
        startingHandSize: 7,
    };
};

export default function DebugEndFlowScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [selected, setSelected] = useState<ScenarioDefinition | null>(null);
    const [botHasPlayed, setBotHasPlayed] = useState(false);
    const state = useMemo(() => selected ? createState(selected) : null, [selected]);

    useEffect(() => {
        if (!__DEV__) router.replace('/home');
    }, [router]);

    useEffect(() => {
        if (!selected) return;
        setBotHasPlayed(false);
        const timer = setTimeout(() => setBotHasPlayed(true), 550);
        return () => clearTimeout(timer);
    }, [selected]);

    if (!__DEV__) return null;

    const launch = (scenario: ScenarioDefinition) => setSelected(scenario);
    const dismiss = () => setSelected(null);

    return (
        <LinearGradient colors={['#13051F', '#1C0B36', '#0B0615']} style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity onPress={() => selected ? dismiss() : router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={22} color="#FFD700" />
                </TouchableOpacity>
                <View>
                    <Text style={styles.title}>🛠 Prévisualisation des fins</Text>
                    <Text style={styles.subtitle}>Local uniquement — aucune donnée n’est enregistrée</Text>
                </View>
            </View>

            {!selected ? (
                <View style={styles.menu}>
                    <Text style={styles.intro}>Choisissez un scénario. Un bot joue le dernier domino, puis le véritable flux d’animation est affiché.</Text>
                    <View style={styles.grid}>
                        {SCENARIOS.map(scenario => (
                            <TouchableOpacity key={scenario.id} style={styles.choice} onPress={() => launch(scenario)}>
                                <View><Text style={styles.choiceTitle}>{scenario.label}</Text><Text style={styles.choiceDescription}>{scenario.description}</Text></View>
                                <Ionicons name="play" size={18} color="#FFD700" />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            ) : (
                <View style={styles.previewTable}>
                    <Text style={styles.previewLabel}>{selected.label}</Text>
                    <View style={styles.table}><Text style={styles.tableText}>{botHasPlayed ? 'Mickaël a posé le dernier domino' : 'Mickaël réfléchit…'}</Text><Text style={styles.domino}>{botHasPlayed ? '⚄ | ⚄' : '🂠'}</Text></View>
                    <Text style={styles.previewHint}>L’animation se lance automatiquement. Touchez retour pour rejouer un autre scénario.</Text>
                    {state && <RoundEndFlow gameState={state} visible={botHasPlayed} onDismiss={dismiss} localPlayerId="local-preview" opponents={state.players.slice(1)} isHost autoAdvanceDelay={6000} isFinalMatch={state.phase === 'MATCH_END'} />}
                </View>
            )}
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingBottom: 14, paddingHorizontal: 16 },
    backButton: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
    title: { color: '#FFD700', fontSize: 17, fontWeight: '900' },
    subtitle: { color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 2 },
    menu: { gap: 12, padding: 18 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    intro: { color: 'rgba(255,255,255,0.8)', fontSize: 15, lineHeight: 22, marginBottom: 6 },
    choice: { alignItems: 'flex-start', backgroundColor: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,215,0,0.35)', borderRadius: 13, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 100, padding: 10, width: '31.8%' },
    choiceTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
    choiceDescription: { color: 'rgba(255,255,255,0.58)', fontSize: 10, lineHeight: 13, marginTop: 4, maxWidth: 76 },
    previewTable: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 },
    previewLabel: { color: '#FFD700', fontSize: 20, fontWeight: '900', marginBottom: 18 },
    table: { alignItems: 'center', backgroundColor: '#154B35', borderColor: '#D8A641', borderRadius: 24, borderWidth: 5, height: 260, justifyContent: 'center', width: '100%' },
    tableText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    domino: { color: '#FFF7DE', fontSize: 38, marginTop: 14 },
    previewHint: { color: 'rgba(255,255,255,0.62)', fontSize: 12, lineHeight: 18, marginTop: 22, textAlign: 'center' },
});
