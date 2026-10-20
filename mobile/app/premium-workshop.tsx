import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StoreItem, SkinConfig } from '../src/core/store.types';
import { premiumService } from '../src/core/services/premium.service';
import { storeService } from '../src/core/services/store.service';
import { StoreItemPreview } from '../src/components/store/StoreItemPreview';

const TABLES = [
  '#18391E', '#A6674C', '#24466B', '#51286F', '#7C1D35',
  '#F4D6A0', '#BDE0FE', '#E8D7FF', '#E3F6F5', '#F8C8D8',
];
const TILES = [
  '#F8E9D2', '#D9ED92', '#BDE0FE', '#E4C1F9', '#FFD6A5',
  '#20252F', '#3B245C', '#18391E', '#073F52', '#7C1D35',
];
const BUTTONS = ['#FFD700', '#FF7043', '#75D6B1', '#B68CFF', '#4FC3F7', '#EC407A', '#8BC34A', '#FFB74D', '#26A69A', '#78909C'];
const DOTS = ['#1F2430', '#FFFFFF', '#FFD700', '#FF7043', '#75D6B1', '#B68CFF', '#4FC3F7', '#EC407A', '#8BC34A', '#5B3328'];

export default function PremiumWorkshopScreen() {
  const router = useRouter();
  const [designs, setDesigns] = useState<NonNullable<Awaited<ReturnType<typeof storeService.getInventory>>['customPremiumSkins']>>([]);
  const [name, setName] = useState('Ma création');
  const [table, setTable] = useState(TABLES[0]);
  const [tile, setTile] = useState(TILES[0]);
  const [button, setButton] = useState(BUTTONS[0]);
  const [dot, setDot] = useState(DOTS[0]);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [activePalette, setActivePalette] = useState<'TABLE' | 'TILE' | 'BUTTON' | 'DOT'>('TABLE');

  const load = useCallback(async () => {
    const [inventory, premium] = await Promise.all([storeService.getInventory(), premiumService.hasActiveAccess()]);
    if (!premium || !inventory.ownedItems.includes('skin_premium_atelier')) {
      Alert.alert('Atelier indisponible', 'L’Atelier nécessite un accès Premium actif et doit être acheté dans la boutique.');
      router.back();
      return;
    }
    setDesigns(inventory.customPremiumSkins ?? []);
  }, [router]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const skinConfig: SkinConfig = { tableBackgroundColor: table, boardColor: table, dominoBackgroundColor: tile, dominoDotColor: dot, dominoLineColor: button };
  const preview: StoreItem = { id: 'atelier_preview', name, description: '', type: 'SKIN', rarity: 'LEGENDARY', assetId: 'premium_workshop', skinConfig };
  const choose = (value: string, selected: string, onPick: (value: string) => void) => <TouchableOpacity key={value} onPress={() => onPick(value)} style={[styles.swatch, { backgroundColor: value }, selected === value && styles.selected]} />;

  const save = async () => {
    setSaving(true);
    const result = await storeService.savePremiumCustomSkin({ id: editingId, name, skinConfig, buttonColor: button });
    setSaving(false);
    if (!result.success) return Alert.alert('Impossible d’enregistrer', result.message);
    Alert.alert('Création enregistrée', 'Ton design est équipé et utilisable en partie.');
    await load();
  };

  return <SafeAreaView style={styles.container}><LinearGradient colors={['#261644', '#10081F']} style={StyleSheet.absoluteFillObject} />
    <View style={styles.header}><TouchableOpacity onPress={() => router.back()}><Text style={styles.back}>‹</Text></TouchableOpacity><Text style={styles.title}>ATELIER PREMIUM</Text><Text style={styles.count}>{designs.length}/5</Text></View>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.preview}><StoreItemPreview item={preview} height={180} /></View>
      <View style={styles.saveRow}>
        <View style={styles.nameField}><Ionicons name="pencil" size={17} color="#FFD700" /><TextInput value={name} onChangeText={setName} maxLength={24} style={styles.input} placeholder="Nom de la création" placeholderTextColor="#B8AACB" /></View>
        <TouchableOpacity disabled={saving || (!editingId && designs.length >= 5)} onPress={save} style={[styles.save, (saving || (!editingId && designs.length >= 5)) && styles.disabled]}><Text style={styles.saveText}>{saving ? '…' : 'ENREGISTRER'}</Text></TouchableOpacity>
      </View>
      {designs.length > 0 && <><Text style={styles.label}>Mes créations</Text><View style={styles.designs}>{designs.map(design => <TouchableOpacity key={design.id} onPress={() => { setEditingId(design.id); setName(design.name); setTable(design.skinConfig.tableBackgroundColor); setTile(design.skinConfig.dominoBackgroundColor); setButton(design.buttonColor); setDot(design.skinConfig.dominoDotColor); }} style={[styles.design, editingId === design.id && styles.designSelected]}><Text style={styles.designText}>{design.name}</Text></TouchableOpacity>)}<TouchableOpacity onPress={() => { setEditingId(undefined); setName('Ma création'); }} style={styles.design}><Text style={styles.designText}>+ Nouveau</Text></TouchableOpacity></View></>}
      <View style={styles.tabs}>
        {([{ id: 'TABLE', label: 'Plateau' }, { id: 'TILE', label: 'Tuiles' }, { id: 'DOT', label: 'Points' }, { id: 'BUTTON', label: 'Ligne' }] as const).map(tab => <TouchableOpacity key={tab.id} onPress={() => setActivePalette(tab.id)} style={[styles.tab, activePalette === tab.id && styles.tabActive]}><Text style={[styles.tabText, activePalette === tab.id && styles.tabTextActive]}>{tab.label}</Text></TouchableOpacity>)}
      </View>
      <Text style={styles.label}>{activePalette === 'TABLE' ? 'Couleur du plateau' : activePalette === 'TILE' ? 'Fond des tuiles' : activePalette === 'DOT' ? 'Couleur des points' : 'Boutons et séparateurs'}</Text>
      <View style={styles.swatches}>{activePalette === 'TABLE' ? TABLES.map(value => choose(value, table, setTable)) : activePalette === 'TILE' ? TILES.map(value => choose(value, tile, setTile)) : activePalette === 'DOT' ? DOTS.map(value => choose(value, dot, setDot)) : BUTTONS.map(value => choose(value, button, setButton))}</View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#10081F' }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18 }, back: { color: '#fff', fontSize: 38, lineHeight: 34 }, title: { color: '#FFD700', fontWeight: '900', letterSpacing: 1 }, count: { color: '#fff', fontWeight: '800' }, content: { padding: 20, gap: 12 }, preview: { borderRadius: 16, overflow: 'hidden', marginVertical: 8 }, saveRow: { flexDirection: 'row', gap: 8, alignItems: 'center' }, nameField: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,.1)', borderRadius: 12, paddingLeft: 12 }, input: { flex: 1, color: '#fff', paddingHorizontal: 8, height: 48, fontWeight: '700' }, label: { marginTop: 8, color: '#FFD700', fontWeight: '900' }, tabs: { flexDirection: 'row', borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,.09)' }, tab: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center' }, tabActive: { backgroundColor: '#FFD700' }, tabText: { color: 'rgba(255,255,255,.75)', fontWeight: '800', fontSize: 12 }, tabTextActive: { color: '#291640' }, swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 }, swatch: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: 'rgba(255,255,255,.45)' }, selected: { borderColor: '#fff', borderWidth: 4, transform: [{ scale: 1.08 }] }, designs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, design: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: 'rgba(255,255,255,.12)' }, designSelected: { borderWidth: 1, borderColor: '#FFD700' }, designText: { color: '#fff', fontSize: 12, fontWeight: '700' }, save: { minHeight: 48, paddingHorizontal: 12, backgroundColor: '#FFD700', borderRadius: 12, justifyContent: 'center', alignItems: 'center' }, disabled: { opacity: .5 }, saveText: { color: '#291640', fontWeight: '900', fontSize: 10 },
});
