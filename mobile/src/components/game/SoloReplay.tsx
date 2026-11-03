import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
    onSave?: () => Promise<void>;
}

export const SoloReplay = ({ visible, frames, onClose, localPlayerId, theme, skinConfig, onSave }: Props) => {
    const { width } = useWindowDimensions();
    const [index, setIndex] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [speed, setSpeed] = useState<1 | 2 | 4>(1);
    const [showOpponentHands, setShowOpponentHands] = useState(false);
    const [confirmQuit, setConfirmQuit] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const { boardRef, tableRef, avatarRefs, flight, hiddenDominoId, finishFlight } = useReplayFlight(frames, index, visible);
    const state = frames[index];
    const phase = state?.phase;
    const boudePlayerId = state?.boudePlayerId;
    const manches = useMemo(() => Array.from(new Set(frames.map(frame => frame.mancheNumber))), [frames]);
    const parties = useMemo(() => Array.from(new Set(frames
        .filter(frame => frame.mancheNumber === state?.mancheNumber)
        .map(frame => frame.roundNumber))), [frames, state?.mancheNumber]);

    useEffect(() => {
        if (visible) { setIndex(0); setSaved(false); setSaveMessage(''); setShowOpponentHands(false); }
        setConfirmQuit(false);
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
    const highlightedPlayerId = state.boudePlayerId ?? action?.playerId ?? (state.phase === 'PLAYING' ? state.currentPlayerId : null);
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
        : state.boudePlayerId ? `${state.players.find(p => p.id === state.boudePlayerId)?.name ?? 'Joueur'} est boudé`
        : roundEnded ? 'Fin du round'
        : isNewDeal ? 'Début de la partie'
        : action ? `${player?.name ?? 'Joueur'} ${action.action === 'PASS' ? 'passe' : 'joue'}` : 'Suite de la partie';
    const jump = (manche: number, partie?: number) => {
        const target = frames.findIndex(frame => frame.mancheNumber === manche && (partie === undefined || frame.roundNumber === partie));
        if (target >= 0) { setPlaying(false); setIndex(target); }
    };
    const step = (offset: number) => { setPlaying(false); setIndex(current => Math.max(0, Math.min(frames.length - 1, current + offset))); };
    const requestQuit = () => { setPlaying(false); setConfirmQuit(true); };

    return (
        <Modal visible={visible} animationType="fade" onRequestClose={requestQuit} supportedOrientations={['portrait', 'landscape']} presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}>
            <View style={styles.container}>
                {skinConfig?.boardColor || skinConfig?.tableBackgroundColor
                    ? <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: skinConfig.boardColor ?? skinConfig.tableBackgroundColor }]} />
                    : <LinearGradient pointerEvents="none" colors={['#0a2e0a', '#4a0e0e', '#000000']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFillObject} />}
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
                <View style={styles.progressHeader}>
                    <Text style={styles.actionText} accessibilityLiveRegion="polite" numberOfLines={1}>{saveMessage || (saving ? 'Sauvegarde…' : description)}</Text>
                    <TouchableOpacity
                        accessibilityRole="switch"
                        accessibilityLabel="Afficher les dominos adverses"
                        accessibilityState={{ checked: showOpponentHands }}
                        onPress={() => setShowOpponentHands(current => !current)}
                        style={[styles.handsToggle, showOpponentHands && styles.handsToggleActive]}
                    >
                        <Ionicons name={showOpponentHands ? 'eye-outline' : 'eye-off-outline'} size={18} color="#fff" />
                        <Text style={styles.handsToggleText}>Mains</Text>
                    </TouchableOpacity>
                    <Text style={styles.progressText}>{index + 1} / {frames.length}</Text>
                </View>
                <View accessibilityRole="progressbar" accessibilityLabel="Progression du replay" accessibilityValue={{ min: 1, max: frames.length, now: index + 1 }} style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${((index + 1) / frames.length) * 100}%` }]} />
                </View>
                <View ref={boardRef} collapsable={false} style={styles.board}>
                    <View style={[styles.tableArea, width < 600 && styles.compactTableArea]}>
                        <GameTable ref={tableRef} gameState={state} theme={theme} skinConfig={skinConfig} replayMode hiddenDominoId={hiddenDominoId} />
                    </View>
                    {state.table.sequence.length === 0 && <Text style={styles.empty}>Plateau vide</Text>}
                    <ReplayPlayers gameState={state} localPlayerId={localPlayerId} skinConfig={skinConfig} avatarRefs={avatarRefs} activePlayerId={highlightedPlayerId} showOpponentHands={showOpponentHands} />
                    {localPlayer && <ScrollView horizontal style={styles.hand} contentContainerStyle={styles.handContent} showsHorizontalScrollIndicator={false} testID="replay-local-hand">
                        {localPlayer.hand.map(domino => <DominoTile key={domino.id} left={domino.left} right={domino.right} size={28} orientation="vertical" disabled noMargin flat pipScale={1.6} animateOnMount={false} skinConfig={skinConfig} />)}
                    </ScrollView>}
                    <View style={styles.bottomActions}>
                        {onSave && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Sauvegarder le replay" disabled={saving || saved} onPress={() => {
                            setSaving(true); setSaveMessage('');
                            void onSave().then(() => { setSaved(true); setSaveMessage('Replay sauvegardé'); }).catch((error: unknown) => { setSaveMessage(error instanceof Error ? error.message : 'Sauvegarde impossible.'); }).finally(() => setSaving(false));
                        }} style={[styles.actionButton, saved && styles.savedButton]}><Ionicons name={saved ? 'checkmark' : 'bookmark-outline'} size={20} color="#fff" /></TouchableOpacity>}
                        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Quitter le replay" onPress={requestQuit} style={styles.actionButton}><Ionicons name="exit-outline" size={20} color="#fff" /></TouchableOpacity>
                    </View>
                    {flight && <FlyingDomino key={flight.animationId} data={flight} onFinished={finishFlight} skinConfig={skinConfig} durationMs={400 / speed} />}
                    {roundEnded && !hiddenDominoId && <View pointerEvents="none" style={styles.roundEnd}><Text style={styles.roundEndText}>Fin du Round</Text>{winner && <Text style={styles.winnerText}>Vainqueur : {winner.name} · {winningScore}</Text>}</View>}
                </View>
                {confirmQuit && <View style={styles.confirmBackdrop} accessibilityViewIsModal>
                    <View style={styles.confirmCard}>
                        <Text style={styles.confirmTitle}>Quitter le replay ?</Text>
                        <View style={styles.confirmActions}>
                            <TouchableOpacity accessibilityRole="button" onPress={() => setConfirmQuit(false)} style={styles.confirmButton}><Text style={styles.buttonText}>Annuler</Text></TouchableOpacity>
                            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Confirmer la sortie du replay" onPress={() => { setConfirmQuit(false); onClose(); }} style={styles.confirmButton}><Text style={styles.buttonText}>Quitter</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>}
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
    progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5, gap: 8 },
    actionText: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600' },
    progressText: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600' },
    handsToggle: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.12)' },
    handsToggleActive: { backgroundColor: '#286c58' },
    handsToggleText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    progressTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, marginTop: 4, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#e7b430', borderRadius: 2 },
    label: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
    selectorList: { flexGrow: 0, flexShrink: 1 },
    chips: { alignItems: 'center', gap: 6 },
    chip: { minWidth: 32, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#24584a', alignItems: 'center' },
    selected: { backgroundColor: '#a57710' },
    board: { flex: 1, minHeight: 60, position: 'relative' },
    tableArea: { flex: 1, marginHorizontal: 140, marginBottom: 66 },
    compactTableArea: { marginHorizontal: 105 },
    hand: { position: 'absolute', left: 95, right: 95, bottom: 0, flexGrow: 0, zIndex: 1 },
    handContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 7, paddingHorizontal: 3, paddingVertical: 4 },
    bottomActions: { position: 'absolute', right: 0, bottom: 12, flexDirection: 'row', gap: 8, zIndex: 2 },
    actionButton: { backgroundColor: '#286c58', borderRadius: 8, padding: 9 },
    confirmBackdrop: { ...StyleSheet.absoluteFillObject, zIndex: 5000, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center' },
    confirmCard: { backgroundColor: '#123c32', borderRadius: 12, padding: 20, gap: 16, minWidth: 240 },
    confirmTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
    confirmButton: { backgroundColor: '#286c58', borderRadius: 8, padding: 10 },
    empty: { position: 'absolute', alignSelf: 'center', top: '45%', color: '#b5cec2' },
    roundEnd: { position: 'absolute', alignSelf: 'center', top: '38%', backgroundColor: 'rgba(0, 0, 0, 0.82)', borderColor: '#ffd700', borderWidth: 1, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
    roundEndText: { color: '#ffd700', fontSize: 20, fontWeight: 'bold' },
    winnerText: { color: '#fff', fontSize: 14, textAlign: 'center', marginTop: 4 },
    controls: { flexDirection: 'row', justifyContent: 'flex-end', gap: 6 },
    button: { backgroundColor: '#286c58', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
    play: { backgroundColor: '#a57710' },
    savedButton: { backgroundColor: '#387b4b' },
    disabled: { opacity: 0.4 },
    buttonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
});
