import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DominoTile } from '../DominoTile';
import { SkinConfig, StoreItem } from '../../core/store.types';

const skinFor = (item: StoreItem): SkinConfig => ({
  tableBackgroundColor: item.skinConfig?.tableBackgroundColor ?? '#105B3A',
  boardColor: item.skinConfig?.boardColor ?? '#1B5E20',
  dominoBackgroundColor: item.skinConfig?.dominoBackgroundColor ?? '#fff',
  dominoDotColor: item.skinConfig?.dominoDotColor ?? '#000',
  dominoLineColor: item.skinConfig?.dominoLineColor ?? '#000',
  dominoValueBackgroundColors: item.skinConfig?.dominoValueBackgroundColors,
  dominoValueDotColors: item.skinConfig?.dominoValueDotColors,
});

export function SkinPreviewModal({ item, visible, onClose }: { item: StoreItem | null; visible: boolean; onClose: () => void }) {
  if (!item) return null;
  const skin = skinFor(item);
  const tile = (left: 0 | 1 | 2 | 3 | 4 | 5 | 6, right: 0 | 1 | 2 | 3 | 4 | 5 | 6, vertical = false) => (
    <DominoTile left={left} right={right} size={vertical ? 34 : 31} orientation={vertical ? 'vertical' : 'horizontal'} skinConfig={skin} noMargin animateOnMount={false} disablePressScale />
  );
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.overlay}><View style={[styles.card, { backgroundColor: skin.tableBackgroundColor }]}>
      <View style={styles.header}><View><Text style={styles.eyebrow}>APERÇU EN PARTIE</Text><Text style={styles.title}>{item.name}</Text></View><TouchableOpacity onPress={onClose} style={styles.close}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity></View>
      <View style={[styles.board, { backgroundColor: skin.boardColor ?? skin.tableBackgroundColor }]}>
        <Text style={styles.boardLabel}>Plateau en cours</Text>
        <View style={styles.chain}>
          <View style={styles.chainSide}>{tile(3, 1)}{tile(5, 3)}{tile(6, 5)}</View>
          {tile(6, 6, true)}
          <View style={styles.chainSide}>{tile(6, 4)}{tile(4, 2)}{tile(2, 0)}</View>
        </View>
      </View>
      <Text style={styles.hint}>Voici le rendu des dominos et du plateau avec ce skin.</Text>
    </View></View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', padding: 18 },
  card: { borderRadius: 22, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  eyebrow: { color: 'rgba(255,255,255,0.72)', fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  title: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 2 }, close: { padding: 8 },
  board: { minHeight: 300, borderRadius: 16, paddingHorizontal: 8, paddingVertical: 18, justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.18)' },
  boardLabel: { position: 'absolute', top: 16, alignSelf: 'center', color: 'rgba(255,255,255,0.62)', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  chain: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  chainSide: { flexDirection: 'row', alignItems: 'center' },
  hint: { color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 14, lineHeight: 20 },
});
