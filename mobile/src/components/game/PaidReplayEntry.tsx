import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { auth, gameFunctions } from '../../core/services/firebase';
import { economyService } from '../../core/services/economy.service';
import { readConfirmedReplayBalance } from '../../core/services/replayBalance';
import { GameState } from '../../core/types';

interface Props {
    enabled: boolean;
    solo: boolean;
    matchId: string;
    sessionId?: string;
    finalized: boolean;
    hasFrames: boolean;
    settle: () => Promise<void>;
    onOpened: (frames?: GameState[]) => void;
    hideEntry?: boolean;
}

export interface PaidReplayEntryHandle { show: () => void }

export const PaidReplayEntry = forwardRef<PaidReplayEntryHandle, Props>(({ enabled, solo, matchId, sessionId, finalized, hasFrames, settle, onOpened, hideEntry = false }, ref) => {
    const [confirm, setConfirm] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const lock = useRef(false);
    const attempt = useRef<string | null>(null);
    const show = () => { if (enabled) { setError(''); setConfirm(true); } };
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
            const call = httpsCallable<unknown, { remainingCoins: number; frames?: GameState[] }>(gameFunctions, solo ? 'chargeCurrentReplay' : 'openMultiplayerReplay');
            const result = await call(solo
                ? { matchId: matchId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80), requestId: attempt.current }
                : { sessionId: `${matchId}_${sessionId}`, requestId: attempt.current });
            // The confirmed balance is cached locally only; never push the old economy back.
            const confirmedCoins = await readConfirmedReplayBalance(uid);
            if (auth.currentUser?.uid !== uid) throw new Error('Le compte connecté a changé.');
            await economyService.applyConfirmedReplayBalance(confirmedCoins);
            attempt.current = null;
            setConfirm(false);
            onOpened(result.data.frames);
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : 'Ouverture impossible. Réessaie.');
        } finally {
            lock.current = false;
            setBusy(false);
        }
    };
    return <>
        {enabled && !hideEntry && <TouchableOpacity style={styles.entry} onPress={show} accessibilityLabel="Ouvrir un replay pour 1 000 coins"><Text style={styles.text}>Replay · 1 000 coins</Text></TouchableOpacity>}
        <Modal visible={confirm} transparent animationType="fade" onRequestClose={() => { if (!busy) setConfirm(false); }}>
            <View style={styles.backdrop}><View style={styles.card}>
                <Text style={styles.title}>Ouvrir ce replay pour 1 000 coins ?</Text>
                <Text style={styles.text}>Chaque ouverture coûte 1 000 coins.</Text>
                {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
                <View style={styles.row}>
                    <TouchableOpacity disabled={busy} onPress={() => setConfirm(false)} style={styles.button}><Text style={styles.text}>Annuler</Text></TouchableOpacity>
                    <TouchableOpacity disabled={busy} onPress={() => { void open(); }} style={styles.button} accessibilityLabel="Confirmer l’ouverture à 1 000 coins"><Text style={styles.text}>{busy ? 'Chargement…' : 'Ouvrir · 1 000 coins'}</Text></TouchableOpacity>
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
});
