import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GameState } from '../../core/types';
import { SkinConfig } from '../../core/store.types';
import { TableTheme } from '../../core/themes/tableThemes';
import { GameTable } from '../GameTable';
import { ReplayPlayers } from './ReplayPlayers';
import { FlyingDomino } from '../FlyingDomino';
import { DominoTile } from '../DominoTile';
import { useReplayFlight } from './useReplayFlight';

interface Props {
    visible: boolean;
    frames: GameState[];
    onClose: () => void;
    localPlayerId: string;
    theme?: TableTheme;
    skinConfig?: SkinConfig;
}

export const SoloReplay = ({ visible, frames, onClose, localPlayerId, theme, skinConfig }: Props) => {
    const [index, setIndex] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [speed, setSpeed] = useState<1 | 2 | 4>(1);
    const { boardRef, tableRef, avatarRefs, flight, hiddenDominoId, finishFlight } = useReplayFlight(frames, index, visible);
    const state = frames[index];
    const phase = state?.phase;
    const boudePlayerId = state?.boudePlayerId;
    const manches = useMemo(() => Array.from(new Set(frames.map(frame => frame.mancheNumber))), [frames]);
    const parties = useMemo(() => Array.from(new Set(frames
        .filter(frame => frame.mancheNumber === state?.mancheNumber)
        .map(frame => frame.roundNumber))), [frames, state?.mancheNumber]);

    useEffect(() => {
        if (visible) setIndex(0);
        setPlaying(false);
    }, [visible]);
    useEffect(() => {
        if (!visible || !playing || index >= frames.length - 1) {
            if (index >= frames.length - 1) setPlaying(false);
            return;
        }
        const roundEnded = phase === 'PARTIE_END' || phase === 'MANCHE_END' || phase === 'MATCH_END';
        const delay = roundEnded || (phase === 'PLAYING' && boudePlayerId) ? 2000 : 1100;
        const timer = setTimeout(() => setIndex(current => current + 1), delay / speed);
        return () => clearTimeout(timer);
    }, [visible, playing, index, frames.length, phase, boudePlayerId, speed]);

    if (!state) return null;
    const roundEnded = ['PARTIE_END', 'MANCHE_END', 'MATCH_END'].includes(state.phase);
    const previous = frames[index - 1];
    const isNewDeal = !previous || previous.roundNumber !== state.roundNumber || previous.mancheNumber !== state.mancheNumber;
    const action = !isNewDeal && state.history.length > (previous?.history.length ?? 0)
        ? state.history[state.history.length - 1] : undefined;
    const player = state.players.find(item => item.id === action?.playerId);
    const localPlayer = state.players.find(item => item.id === localPlayerId);
    const winner = state.phase === 'MATCH_END' ? [...state.players].sort((a, b) => {
        if (state.gameMode === 'COCHON' && (b.totalCochonsInfliges ?? 0) !== (a.totalCochonsInfliges ?? 0)) return (b.totalCochonsInfliges ?? 0) - (a.totalCochonsInfliges ?? 0);
        return (b.totalPoints ?? 0) - (a.totalPoints ?? 0) || (b.totalCochons ?? 0) - (a.totalCochons ?? 0) || (b.mancheWins ?? 0) - (a.mancheWins ?? 0);
    })[0] : undefined;
    const winningScore = winner && (state.gameMode === 'COCHON' ? `${winner.totalCochonsInfliges} cochons`
        : state.gameMode === 'MANCHE' ? `${winner.mancheWins} manches`
        : state.gameMode === 'VICTOIRE' ? `${winner.totalRoundWins} victoires` : `${winner.totalPoints} points`);
    const description = state.phase === 'MATCH_END' ? 'Fin du match'
        : state.phase === 'BOUDE' ? 'Partie bloquée'
        : state.boudePlayerId ? `${state.players.find(p => p.id === state.boudePlayerId)?.name ?? 'Joueur'} : boudé`
        : isNewDeal ? 'Début de la partie'
        : action ? `${player?.name ?? 'Joueur'} : ${action.action === 'PASS' ? 'passe' : 'joue'}` : 'Résultat de la partie';
    const jump = (manche: number, partie?: number) => {
        const target = frames.findIndex(frame => frame.mancheNumber === manche && (partie === undefined || frame.roundNumber === partie));
        if (target >= 0) { setPlaying(false); setIndex(target); }
    };
    const step = (offset: number) => { setPlaying(false); setIndex(current => Math.max(0, Math.min(frames.length - 1, current + offset))); };

    return (
        <Modal visible={visible} animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']} presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'} allowSwipeDismissal={Platform.OS === 'ios'}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <View style={styles.headerSection}>
                        <Text style={styles.label}>Manche</Text>
                        <ScrollView horizontal style={styles.selectorList} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                            {manches.map(manche => <TouchableOpacity key={manche} accessibilityRole="button" accessibilityLabel={`Manche ${manche}`} accessibilityState={{ selected: manche === state.mancheNumber }} onPress={() => jump(manche)} style={[styles.chip, manche === state.mancheNumber && styles.selected]}><Text style={styles.buttonText}>{manche}</Text></TouchableOpacity>)}
                        </ScrollView>
                    </View>
                    <View style={[styles.headerSection, styles.centerSection]}>
                        <Text style={styles.label}>Partie</Text>
                        <ScrollView horizontal style={styles.selectorList} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                            {parties.map(partie => <TouchableOpacity key={partie} accessibilityRole="button" accessibilityLabel={`Partie ${partie}`} accessibilityState={{ selected: partie === state.roundNumber }} onPress={() => jump(state.mancheNumber, partie)} style={[styles.chip, partie === state.roundNumber && styles.selected]}><Text style={styles.buttonText}>{partie}</Text></TouchableOpacity>)}
                        </ScrollView>
                    </View>
                    <View style={styles.closeSection}>
                        <View style={styles.controls}>
                            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Précédent" disabled={index === 0} onPress={() => step(-1)} style={[styles.button, index === 0 && styles.disabled]}><Ionicons name="play-skip-back" size={20} color="#fff" /></TouchableOpacity>
                            <TouchableOpacity accessibilityRole="button" accessibilityLabel={playing ? 'Pause' : 'Lecture'} onPress={() => { if (!playing && index === frames.length - 1) setIndex(0); setPlaying(!playing); }} style={[styles.button, styles.play]}><Ionicons name={playing ? 'pause' : 'play'} size={20} color="#fff" /></TouchableOpacity>
                            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Suivant" disabled={index === frames.length - 1} onPress={() => step(1)} style={[styles.button, index === frames.length - 1 && styles.disabled]}><Ionicons name="play-skip-forward" size={20} color="#fff" /></TouchableOpacity>
                            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Vitesse ${speed} fois`} onPress={() => setSpeed(current => current === 1 ? 2 : current === 2 ? 4 : 1)} style={styles.button}><Text style={styles.buttonText}>×{speed}</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
                <Text style={styles.text}>Étape {index + 1} / {frames.length} · {description}</Text>
                <View ref={boardRef} collapsable={false} style={styles.board}>
                    <View style={styles.tableArea}>
                        <GameTable ref={tableRef} gameState={state} theme={theme} skinConfig={skinConfig} replayMode hiddenDominoId={hiddenDominoId} />
                    </View>
                    {state.table.sequence.length === 0 && <Text style={styles.empty}>Plateau vide</Text>}
                    <ReplayPlayers gameState={state} localPlayerId={localPlayerId} skinConfig={skinConfig} avatarRefs={avatarRefs} />
                    {localPlayer && <ScrollView horizontal style={styles.hand} contentContainerStyle={styles.handContent} showsHorizontalScrollIndicator={false} testID="replay-local-hand">
                        {localPlayer.hand.map(domino => <DominoTile key={domino.id} left={domino.left} right={domino.right} size={28} orientation="vertical" disabled noMargin flat pipScale={1.6} animateOnMount={false} skinConfig={skinConfig} />)}
                    </ScrollView>}
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Quitter le replay" onPress={onClose} style={styles.quit}><Text style={styles.buttonText}>Quitter</Text></TouchableOpacity>
                    {flight && <FlyingDomino key={flight.animationId} data={flight} onFinished={finishFlight} skinConfig={skinConfig} durationMs={400 / speed} />}
                    {roundEnded && !hiddenDominoId && <View pointerEvents="none" style={styles.roundEnd}><Text style={styles.roundEndText}>Fin du Round</Text>{winner && <Text style={styles.winnerText}>Vainqueur : {winner.name} · {winningScore}</Text>}</View>}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#123c32', paddingHorizontal: 18, paddingVertical: 10 },
    header: { flexDirection: 'row', alignItems: 'center' },
    headerSection: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
    centerSection: { justifyContent: 'center' },
    closeSection: { flex: 1, minWidth: 192, alignItems: 'flex-end' },
    text: { color: 'white', fontSize: 14, marginTop: 3 },
    label: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
    selectorList: { flexGrow: 0, flexShrink: 1 },
    chips: { alignItems: 'center', gap: 6 },
    chip: { minWidth: 32, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#24584a', alignItems: 'center' },
    selected: { backgroundColor: '#a57710' },
    board: { flex: 1, minHeight: 60, position: 'relative' },
    tableArea: { flex: 1, marginHorizontal: 110, marginBottom: 66 },
    hand: { position: 'absolute', left: 95, right: 95, bottom: 0, flexGrow: 0, zIndex: 1 },
    handContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 7, paddingHorizontal: 3, paddingVertical: 4 },
    quit: { position: 'absolute', right: 0, bottom: 12, backgroundColor: '#286c58', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, zIndex: 2 },
    empty: { position: 'absolute', alignSelf: 'center', top: '45%', color: '#b5cec2' },
    roundEnd: { position: 'absolute', alignSelf: 'center', top: '38%', backgroundColor: 'rgba(0, 0, 0, 0.82)', borderColor: '#ffd700', borderWidth: 1, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
    roundEndText: { color: '#ffd700', fontSize: 20, fontWeight: 'bold' },
    winnerText: { color: '#fff', fontSize: 14, textAlign: 'center', marginTop: 4 },
    controls: { flexDirection: 'row', justifyContent: 'flex-end', gap: 6 },
    button: { backgroundColor: '#286c58', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
    play: { backgroundColor: '#a57710' },
    disabled: { opacity: 0.4 },
    buttonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
});
