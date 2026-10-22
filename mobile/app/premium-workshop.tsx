import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { SkinConfig } from '../src/core/store.types';
import { premiumService } from '../src/core/services/premium.service';
import { storeService } from '../src/core/services/store.service';
import { PremiumColorPicker } from '../src/features/premium-workshop/PremiumColorPicker';
import { PremiumWorkshopPreview } from '../src/features/premium-workshop/PremiumWorkshopPreview';

const TABLES = ['#18391E', '#A6674C', '#24466B', '#51286F', '#7C1D35'];
const TILES = ['#F8E9D2', '#D9ED92', '#BDE0FE', '#E4C1F9', '#20252F'];
const DOTS = ['#1F2430', '#FFFFFF', '#FFD700', '#FF7043', '#75D6B1'];
const LINES = ['#FFD700', '#FF7043', '#75D6B1', '#B68CFF', '#4FC3F7'];

type PaletteId = 'TABLE' | 'TILE' | 'DOT' | 'LINE';
type Designs = NonNullable<Awaited<ReturnType<typeof storeService.getInventory>>['customPremiumSkins']>;

const PALETTES: Record<PaletteId, { label: string; icon: keyof typeof Ionicons.glyphMap; colors: string[] }> = {
  TABLE: { label: 'Plateau', icon: 'tablet-landscape-outline', colors: TABLES },
  TILE: { label: 'Tuiles', icon: 'square-outline', colors: TILES },
  DOT: { label: 'Points', icon: 'radio-button-on-outline', colors: DOTS },
  LINE: { label: 'Ligne', icon: 'remove-outline', colors: LINES },
};

const DEFAULTS = { name: 'Ma création', table: TABLES[0], tile: TILES[0], dot: DOTS[0], line: LINES[0] };

export default function PremiumWorkshopScreen() {
  const router = useRouter();
  const [designs, setDesigns] = useState<Designs>([]);
  const [name, setName] = useState(DEFAULTS.name);
  const [table, setTable] = useState(DEFAULTS.table);
  const [tile, setTile] = useState(DEFAULTS.tile);
  const [dot, setDot] = useState(DEFAULTS.dot);
  const [line, setLine] = useState(DEFAULTS.line);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [activePalette, setActivePalette] = useState<PaletteId>('TABLE');

  const load = useCallback(async () => {
    const [inventory, premium] = await Promise.all([
      storeService.getInventory(),
      premiumService.hasActiveAccess(),
    ]);
    if (!premium || !inventory.ownedItems.includes('skin_premium_atelier')) {
      Alert.alert('Skin Creator indisponible', 'Le Skin Creator nécessite un accès Premium actif et doit être acheté dans la boutique.');
      router.back();
      return;
    }
    setDesigns(inventory.customPremiumSkins ?? []);
  }, [router]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const skinConfig = useMemo<SkinConfig>(() => ({
    tableBackgroundColor: table,
    boardColor: table,
    dominoBackgroundColor: tile,
    dominoDotColor: dot,
    dominoLineColor: line,
  }), [dot, line, table, tile]);

  const activeColor = activePalette === 'TABLE' ? table : activePalette === 'TILE' ? tile : activePalette === 'DOT' ? dot : line;
  const setActiveColor = useCallback((color: string) => {
    if (activePalette === 'TABLE') setTable(color);
    else if (activePalette === 'TILE') setTile(color);
    else if (activePalette === 'DOT') setDot(color);
    else setLine(color);
  }, [activePalette]);

  const selectDesign = (design: Designs[number]) => {
    setEditingId(design.id);
    setName(design.name);
    setTable(design.skinConfig.tableBackgroundColor);
    setTile(design.skinConfig.dominoBackgroundColor);
    setDot(design.skinConfig.dominoDotColor);
    setLine(design.skinConfig.dominoLineColor || design.buttonColor);
  };

  const resetDraft = () => {
    setEditingId(undefined);
    setName(DEFAULTS.name);
    setTable(DEFAULTS.table);
    setTile(DEFAULTS.tile);
    setDot(DEFAULTS.dot);
    setLine(DEFAULTS.line);
  };

  const createNew = () => {
    if (designs.length >= 5) {
      Alert.alert('Cinq créations maximum', 'Supprime une création existante pour libérer une place.');
      return;
    }
    resetDraft();
  };

  const deleteDesign = async () => {
    if (!editingId) return;
    setDeleting(true);
    try {
      const result = await storeService.removeOwnedItem(editingId);
      if (!result.success) {
        Alert.alert('Suppression impossible', result.message);
        return;
      }
      resetDraft();
      await load();
    } finally {
      setDeleting(false);
    }
  };

  const confirmDeleteDesign = () => {
    if (!editingId) return;
    const selectedDesign = designs.find(design => design.id === editingId);
    const message = `Supprimer définitivement « ${selectedDesign?.name ?? name} » ? Cette action libérera une place.`;
    if (Platform.OS === 'web') {
      if (window.confirm(message)) void deleteDesign();
      return;
    }
    Alert.alert('Supprimer cette création ?', message, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => { void deleteDesign(); } },
    ]);
  };

  const save = async () => {
    setSaving(true);
    try {
      const result = await storeService.savePremiumCustomSkin({ id: editingId, name, skinConfig, buttonColor: line });
      if (!result.success) {
        Alert.alert('Impossible d’enregistrer', result.message);
        return;
      }
      setEditingId(result.id);
      await load();
      Alert.alert('Création enregistrée', 'Ton design est équipé et utilisable en partie.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.container}>
      <LinearGradient colors={['#261644', '#10081F']} style={StyleSheet.absoluteFillObject} />
      <View style={styles.layout}>
        <View style={styles.controlsPanel}>
          <View style={styles.header}>
            <TouchableOpacity accessibilityLabel="Retour" onPress={() => router.back()} style={styles.iconButton}>
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>SKIN CREATOR</Text>
              <Text numberOfLines={1} style={styles.headerTitle}>{editingId ? 'Modifier la création' : 'Nouvelle création'}</Text>
            </View>
            <Text style={styles.count}>{designs.length}/5</Text>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.nameField}>
              <Ionicons name="pencil" size={15} color="#FFD700" />
              <TextInput
                accessibilityLabel="Nom de la création"
                maxLength={24}
                onChangeText={setName}
                placeholder="Nom de la création"
                placeholderTextColor="#B8AACB"
                style={styles.nameInput}
                value={name}
              />
            </View>

            <View style={styles.tabs}>
              {(Object.keys(PALETTES) as PaletteId[]).map(id => (
                <TouchableOpacity
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activePalette === id }}
                  key={id}
                  onPress={() => setActivePalette(id)}
                  style={[styles.tab, activePalette === id && styles.tabActive]}
                >
                  <Ionicons name={PALETTES[id].icon} size={16} color={activePalette === id ? '#291640' : 'rgba(255,255,255,0.72)'} />
                  <Text style={[styles.tabText, activePalette === id && styles.tabTextActive]}>{PALETTES[id].label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.settingTitle}>
              <Text style={styles.settingTitleText}>Couleur : {PALETTES[activePalette].label.toLowerCase()}</Text>
              <Text style={styles.hexValue}>{activeColor}</Text>
            </View>
            <PremiumColorPicker color={activeColor} onChange={setActiveColor} />

            <View style={styles.swatches}>
              {PALETTES[activePalette].colors.map(color => (
                <TouchableOpacity
                  accessibilityLabel={`Choisir ${color}`}
                  key={color}
                  onPress={() => setActiveColor(color)}
                  style={[styles.swatch, { backgroundColor: color }, activeColor === color && styles.swatchSelected]}
                />
              ))}
            </View>

            <View style={styles.designHeader}>
              <Text style={styles.designLabel}>MES CRÉATIONS</Text>
              <TouchableOpacity onPress={createNew} style={styles.newButton}>
                <Ionicons name="add" size={14} color="#FFD700" />
                <Text style={styles.newButtonText}>Nouveau</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.designs}>
              {designs.map(design => (
                <TouchableOpacity
                  key={design.id}
                  onPress={() => selectDesign(design)}
                  style={[styles.design, editingId === design.id && styles.designSelected]}
                >
                  <View style={[styles.designColor, { backgroundColor: design.skinConfig.tableBackgroundColor }]} />
                  <Text numberOfLines={1} style={styles.designText}>{design.name}</Text>
                </TouchableOpacity>
              ))}
              {designs.length === 0 && <Text style={styles.emptyText}>Ta première création apparaîtra ici.</Text>}
            </ScrollView>
          </ScrollView>

          <View style={styles.actions}>
            {editingId && (
              <TouchableOpacity
                accessibilityLabel="Supprimer cette création"
                disabled={deleting || saving}
                onPress={confirmDeleteDesign}
                style={[styles.deleteButton, deleting && styles.disabled]}
              >
                <Ionicons name="trash-outline" size={18} color="#FF7A86" />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={createNew} style={styles.cancelButton}><Text style={styles.cancelText}>RÉINITIALISER</Text></TouchableOpacity>
            <TouchableOpacity disabled={saving || deleting} onPress={save} style={[styles.saveButton, (saving || deleting) && styles.disabled]}>
              <Text style={styles.saveText}>{saving ? 'ENREGISTREMENT…' : editingId ? 'METTRE À JOUR' : 'ENREGISTRER'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.previewPanel}>
          <PremiumWorkshopPreview name={name} skinConfig={skinConfig} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#10081F' },
  layout: { flex: 1, flexDirection: 'row' },
  controlsPanel: { width: '42%', minWidth: 300, maxWidth: 400, backgroundColor: 'rgba(16,8,31,0.94)', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.12)' },
  previewPanel: { flex: 1 },
  header: { minHeight: 54, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#FFD700', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  headerTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', marginTop: 1 },
  count: { color: 'rgba(255,255,255,0.68)', fontSize: 11, fontWeight: '800' },
  scrollContent: { padding: 12, paddingBottom: 16, gap: 10 },
  nameField: { height: 38, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10 },
  nameInput: { flex: 1, height: 38, color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 5 },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)' },
  tabActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  tabText: { color: 'rgba(255,255,255,0.72)', fontSize: 9, fontWeight: '800' },
  tabTextActive: { color: '#291640' },
  settingTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingTitleText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  hexValue: { color: 'rgba(255,255,255,0.58)', fontSize: 10, fontWeight: '700' },
  swatches: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  swatchSelected: { borderWidth: 3, borderColor: '#FFFFFF', transform: [{ scale: 1.08 }] },
  designHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  designLabel: { color: '#FFD700', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  newButton: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7 },
  newButtonText: { color: '#FFD700', fontSize: 9, fontWeight: '900' },
  designs: { gap: 7, paddingRight: 8 },
  design: { width: 92, height: 34, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6, borderRadius: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.06)' },
  designSelected: { borderColor: '#FFD700', backgroundColor: 'rgba(255,215,0,0.08)' },
  designColor: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  designText: { flex: 1, color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  emptyText: { color: 'rgba(255,255,255,0.5)', fontSize: 10, paddingVertical: 8 },
  actions: { height: 58, flexDirection: 'row', gap: 8, padding: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', backgroundColor: '#160B29' },
  deleteButton: { width: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: 1, borderColor: 'rgba(255,122,134,0.35)', backgroundColor: 'rgba(255,90,105,0.1)' },
  cancelButton: { flex: 0.8, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.06)' },
  cancelText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  saveButton: { flex: 1.2, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#FFD700' },
  saveText: { color: '#291640', fontSize: 10, fontWeight: '900' },
  disabled: { opacity: 0.55 },
});
