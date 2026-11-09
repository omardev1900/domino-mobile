import React, { useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth } from '../../core/services/firebase';
import { readConfirmedReplayBalance } from '../../core/services/replayBalance';
import { economyService } from '../../core/services/economy.service';
import { buyReplaySlot } from '../../core/services/replayLibrary.service';

export function ReplaySlotPurchase({ onPurchased }: { onPurchased?: () => void }) {
    const [confirm, setConfirm] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const request = useRef<string | null>(null);
    const lock = useRef(false);
    const purchase = async () => {
        if (lock.current) return;
        lock.current = true; setBusy(true); setMessage('');
        try {
            const uid = auth.currentUser?.uid;
            if (!uid) throw new Error('Connexion requise.');
            await readConfirmedReplayBalance(uid);
            request.current ??= `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            await buyReplaySlot(request.current);
            const coins = await readConfirmedReplayBalance(uid);
            if (auth.currentUser?.uid !== uid) throw new Error('Le compte connecté a changé.');
            await economyService.applyConfirmedReplayBalance(coins);
            request.current = null; setConfirm(false); setMessage('Emplacement ajouté.'); onPurchased?.();
        } catch (error) { setMessage(error instanceof Error ? error.message : 'Achat impossible. Réessaie.'); }
        finally { lock.current = false; setBusy(false); }
    };
    return <View style={styles.box}>
        {confirm ? <><Text style={styles.text}>Ajouter un emplacement pour 3 000 coins pendant 30 jours ?</Text>
            <View style={styles.row}><TouchableOpacity disabled={busy} onPress={() => setConfirm(false)} style={styles.button}><Text style={styles.text}>Annuler</Text></TouchableOpacity>
            <TouchableOpacity disabled={busy} onPress={() => { void purchase(); }} style={styles.button}><Text style={styles.text}>{busy ? 'Chargement…' : 'Confirmer · 3 000 coins'}</Text></TouchableOpacity></View></>
            : <TouchableOpacity accessibilityRole="button" onPress={() => { setMessage(''); setConfirm(true); }} style={styles.button}><Text style={styles.text}>Acheter un emplacement · 3 000 coins / 30 jours</Text></TouchableOpacity>}
        {!!message && <Text accessibilityRole="alert" style={styles.text}>{message}</Text>}
    </View>;
}
const styles = StyleSheet.create({
    box: { gap: 8 }, row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    button: { backgroundColor: '#286c58', padding: 10, borderRadius: 8 }, text: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
