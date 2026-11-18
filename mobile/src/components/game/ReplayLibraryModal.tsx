import React, { useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { deleteSavedReplay, listSavedReplays, readSavedReplay, ReplaySummary, SavedReplay } from '../../core/services/replayLibrary.service';
import { SoloReplay } from './SoloReplay';

interface Props { visible: boolean; onClose: () => void }
const objective = (mode: string, target: number) => {
    if (mode === 'COCHON') return `${target} cochon${target > 1 ? 's' : ''}`;
    if (mode === 'MANCHE') return `${target} manche${target > 1 ? 's' : ''}`;
    if (mode === 'VICTOIRE') return `${target} victoire${target > 1 ? 's' : ''}`;
    return `Score ${target}`;
};
export const ReplayLibraryModal = ({ visible, onClose }: Props) => {
    const [items, setItems] = useState<ReplaySummary[]>([]);
    const [selected, setSelected] = useState<ReplaySummary | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [playing, setPlaying] = useState<SavedReplay | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const lock = useRef(false);
    const load = async () => { try { setItems(await listSavedReplays()); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Chargement impossible.'); } };
    useEffect(() => { if (visible) void load(); }, [visible]);
    const open = async () => {
        if (!selected || lock.current) return;
        lock.current = true; setBusy(true); setError('');
        try {
            const result = await readSavedReplay(selected.id);
            setSelected(null); setPlaying(result.replay);
        } catch (e) { setError(e instanceof Error ? e.message : 'Ouverture impossible.'); }
        finally { lock.current = false; setBusy(false); }
    };
    const remove = async () => {
        if (!deleteId || lock.current) return;
        lock.current = true; setBusy(true);
        try { await deleteSavedReplay(deleteId); setDeleteId(null); await load(); }
        catch (e) { setError(e instanceof Error ? e.message : 'Suppression impossible.'); }
        finally { lock.current = false; setBusy(false); }
    };
    return <>
        <Modal visible={visible && !playing} animationType="fade" transparent onRequestClose={() => { if (!busy) onClose(); }}>
            <View style={styles.backdrop}><View style={styles.panel}>
                <View style={styles.heading}><Text style={styles.title}>Mes replays · {items.length > 2 ? `${items.length} sauvegardés` : `${items.length} / 2`}</Text><TouchableOpacity disabled={busy} onPress={onClose} accessibilityLabel="Fermer les replays"><Ionicons name="close" size={26} color="#fff" /></TouchableOpacity></View>
                {!!error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
                {!selected && !deleteId && <ScrollView>{items.length === 0 ? <Text style={styles.muted}>Aucun replay sauvegardé.</Text> : items.map(item => <View key={item.id} style={styles.row}>
                    <TouchableOpacity style={styles.detail} onPress={() => { setError(''); setSelected(item); }} accessibilityLabel={`Ouvrir le replay du ${new Date(item.metadata.endedAt).toLocaleDateString('fr-FR')}`}>
                        <Text style={styles.text}>{new Date(item.metadata.endedAt).toLocaleString('fr-FR')} · {item.metadata.mode === 'SOLO' ? 'Solo' : 'Multijoueur'}</Text>
                        <Text style={styles.muted}>{objective(item.metadata.gameMode, item.metadata.winningCondition)} · {item.metadata.opponents.join(', ')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setError(''); setDeleteId(item.id); }} accessibilityLabel="Supprimer ce replay" style={styles.icon}><Ionicons name="trash-outline" size={22} color="#ffb5a8" /></TouchableOpacity>
                </View>)}</ScrollView>}
                {selected && <View style={styles.confirm}><Text style={styles.text}>Ouvrir ce replay gratuitement ?</Text><View style={styles.actions}>
                    <TouchableOpacity disabled={busy} onPress={() => { setSelected(null); setError(''); }} style={styles.button}><Text style={styles.text}>Annuler</Text></TouchableOpacity>
                    <TouchableOpacity disabled={busy} onPress={() => { void open(); }} style={styles.button}><Text style={styles.text}>{busy ? 'Chargement…' : 'Ouvrir'}</Text></TouchableOpacity>
                </View></View>}
                {deleteId && <View style={styles.confirm}><Text style={styles.text}>Supprimer ce replay ?</Text><View style={styles.actions}>
                    <TouchableOpacity disabled={busy} onPress={() => { setDeleteId(null); setError(''); }} style={styles.button}><Text style={styles.text}>Annuler</Text></TouchableOpacity>
                    <TouchableOpacity disabled={busy} onPress={() => { void remove(); }} style={styles.button}><Text style={styles.text}>Supprimer</Text></TouchableOpacity>
                </View></View>}
            </View></View>
        </Modal>
        {playing && <SoloReplay visible frames={playing.frames} localPlayerId={playing.localPlayerId} onClose={() => setPlaying(null)} />}
    </>;
};
const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.8)', justifyContent: 'center', alignItems: 'center', padding: 15 },
    panel: { backgroundColor: '#123c32', borderRadius: 14, padding: 16, width: '90%', maxWidth: 720, maxHeight: '90%', minHeight: 180 },
    heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    title: { color: '#ffd700', fontSize: 20, fontWeight: 'bold' },
    row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: 'rgba(255,255,255,.15)', paddingVertical: 9 },
    detail: { flex: 1, gap: 4 }, icon: { padding: 10 }, text: { color: '#fff', fontSize: 15 },
    muted: { color: 'rgba(255,255,255,.7)', fontSize: 13 }, error: { color: '#ffc1b9', marginBottom: 8 },
    confirm: { gap: 14, paddingVertical: 10 }, actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
    button: { backgroundColor: '#286c58', borderRadius: 8, padding: 10 },
});
