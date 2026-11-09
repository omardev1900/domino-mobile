import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { auth, gameFunctions } from '../../core/services/firebase';
import { economyService } from '../../core/services/economy.service';
import { readConfirmedReplayBalance } from '../../core/services/replayBalance';
import { GameState } from '../../core/types';
import { listSavedReplays, openSavedReplay, ReplaySummary } from '../../core/services/replayLibrary.service';

interface Props {
    enabled: boolean;
    solo: boolean;
    matchId: string;
    sessionId?: string;
    finalized: boolean;
    hasFrames: boolean;
    frames: GameState[];
    localPlayerId: string;
    settle: () => Promise<void>;
    onOpened: (frames: GameState[] | undefined, requestId: string) => void;
    hideEntry?: boolean;
}

export interface PaidReplayEntryHandle { show: () => void }

export const PaidReplayEntry = forwardRef<PaidReplayEntryHandle, Props>(({ enabled, solo, matchId, sessionId, finalized, hasFrames, frames, localPlayerId, settle, onOpened, hideEntry = false }, ref) => {
    const [confirm, setConfirm] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [occupied, setOccupied] = useState<ReplaySummary[] | null>(null);
    const [replacement, setReplacement] = useState<ReplaySummary | null>(null);
    const [checked, setChecked] = useState(false);
    const lock = useRef(false);
    const attempt = useRef<string | null>(null);
    const sourceId = solo ? matchId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80) : `${matchId}_${sessionId}`;
    const checkSlots = async () => {
        setBusy(true); setChecked(false); setError('');
        try {
            const uid = auth.currentUser?.uid;
            if (!uid) throw new Error('Connexion requise.');
            const saved = await listSavedReplays();
            const existing = saved.find(item => item.metadata.mode === (solo ? 'SOLO' : 'MULTIPLAYER') && item.metadata.sourceId === sourceId);
            if (existing) {
                const result = await openSavedReplay(existing.id, '');
                if (auth.currentUser?.uid !== uid) throw new Error('Le compte connecté a changé.');
                setConfirm(false);
                onOpened(result.replay.frames, '');
                return;
            }
            setOccupied(saved.length >= 2 ? saved : null);
            setChecked(true);
        } catch (failure) { setError(failure instanceof Error ? failure.message : 'Impossible de vérifier les emplacements. Réessaie.'); }
        finally { setBusy(false); }
    };
    const show = () => { if (enabled) { setError(''); setOccupied(null); setReplacement(null); setConfirm(true); void checkSlots(); } };
    useImperativeHandle(ref, () => ({ show }));
    const open = async () => {
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        setError('');
        try {
            const uid = auth.currentUser?.uid;
            if (!uid) throw new Error('Connexion requise.');
            if (solo) {
                if (!hasFrames) throw new Error('Cette partie ne dispose pas d’un replay complet.');
                await settle();
            } else if (!finalized || !sessionId) throw new Error('La finalisation du match est encore en cours.');
            await readConfirmedReplayBalance(uid);
            attempt.current ??= `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const call = httpsCallable<unknown, { remainingCoins: number; replayId: string; frames?: GameState[] }>(gameFunctions, 'buyAndSaveReplay');
            const result = await call({ source: solo ? 'current' : 'multiplayer', sourceId, requestId: attempt.current, acceptedCost: 2000, localPlayerId, ...(replacement ? { replaceReplayId: replacement.id } : {}), ...(solo ? { frames } : {}) });
            const read = httpsCallable<{ replayId: string }, { replay: { frames: GameState[] } }>(gameFunctions, 'readSavedReplay');
            const [replayFrames, confirmedCoins] = await Promise.all([
                result.data.frames ? Promise.resolve(result.data.frames) : read({ replayId: result.data.replayId }).then(response => response.data.replay.frames),
                readConfirmedReplayBalance(uid),
            ]);
            if (auth.currentUser?.uid !== uid) throw new Error('Le compte connecté a changé.');
            await economyService.applyConfirmedReplayBalance(confirmedCoins);
            const completedRequestId = attempt.current;
            attempt.current = null;
            setConfirm(false);
            onOpened(replayFrames, completedRequestId);
        } catch (failure) {
            const details = failure && typeof failure === 'object' && 'details' in failure ? failure.details : undefined;
            if (details && typeof details === 'object' && 'reason' in details && details.reason === 'REPLAY_SLOT_FULL') {
                try { setOccupied(await listSavedReplays()); setReplacement(null); }
                catch { setError('Impossible de charger les replays sauvegardés. Réessaie.'); }
            } else setError(failure instanceof Error ? failure.message : 'Ouverture impossible. Réessaie.');
        } finally {
            lock.current = false;
            setBusy(false);
        }
    };
    return <>
        {enabled && !hideEntry && <TouchableOpacity style={styles.entry} onPress={show} accessibilityLabel="Ouvrir un replay pour 2 000 coins"><Text style={styles.text}>Replay · 2 000 coins</Text></TouchableOpacity>}
        <Modal visible={confirm} transparent animationType="fade" onRequestClose={() => { if (!busy) setConfirm(false); }}>
            <View style={styles.backdrop}><View style={styles.card}>
                <Text style={styles.title}>{!checked && busy ? 'Vérification des emplacements…' : occupied ? 'Emplacements de replay complets' : 'Ouvrir ce replay pour 2 000 coins ?'}</Text>
                {checked && <Text style={styles.text}>{replacement ? 'Remplacer ce replay par la nouvelle partie pour 2 000 coins ? Le replay remplacé sera supprimé.' : occupied ? 'Quelle partie veux-tu remplacer ? Pas d’inquiétude : ton ancien replay reste intact tant que le nouvel achat n’est pas validé.' : 'Ce replay sera sauvegardé et pourra être revu gratuitement.'}</Text>}
                {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
                {occupied && !replacement && <ScrollView style={styles.savedList}>{occupied.map(item => <TouchableOpacity key={item.id} accessibilityRole="button" accessibilityLabel={`Remplacer le replay du ${new Date(item.metadata.endedAt).toLocaleDateString('fr-FR')}`} onPress={() => setReplacement(item)} style={styles.button}><Text style={styles.text}>{new Date(item.metadata.endedAt).toLocaleDateString('fr-FR')} · {item.metadata.mode === 'SOLO' ? 'Solo' : 'Multijoueur'} · {item.metadata.opponents.join(', ')}</Text></TouchableOpacity>)}</ScrollView>}
                {replacement && <Text style={styles.text}>{new Date(replacement.metadata.endedAt).toLocaleDateString('fr-FR')} · {replacement.metadata.opponents.join(', ')}</Text>}
                <View style={styles.row}>
                    <TouchableOpacity disabled={busy} onPress={() => setConfirm(false)} style={styles.button}><Text style={styles.text}>Annuler</Text></TouchableOpacity>
                    {!checked && !busy && <TouchableOpacity onPress={() => { void checkSlots(); }} style={styles.button}><Text style={styles.text}>Réessayer</Text></TouchableOpacity>}
                    {checked && (!occupied || replacement) && <TouchableOpacity disabled={busy} onPress={() => { void open(); }} style={styles.button} accessibilityLabel="Confirmer l’ouverture à 2 000 coins"><Text style={styles.text}>{busy ? 'Chargement…' : replacement ? 'Remplacer · 2 000 coins' : 'Ouvrir · 2 000 coins'}</Text></TouchableOpacity>}
                </View>
            </View></View>
        </Modal>
    </>;
});
PaidReplayEntry.displayName = 'PaidReplayEntry';
const styles = StyleSheet.create({
    entry: { position: 'absolute', bottom: 20, right: 20, zIndex: 6000, elevation: 30, backgroundColor: '#816218', borderRadius: 10, padding: 12 },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.75)', alignItems: 'center', justifyContent: 'center', padding: 20 },
    card: { maxWidth: 480, backgroundColor: '#123c32', borderRadius: 14, padding: 20, gap: 12 },
    title: { color: '#ffd700', fontWeight: 'bold', fontSize: 20 },
    text: { color: '#fff', fontSize: 15 },
    error: { color: '#ffc1b9' },
    row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
    button: { padding: 12, backgroundColor: '#286c58', borderRadius: 8 },
    savedList: { maxHeight: 160 },
});
