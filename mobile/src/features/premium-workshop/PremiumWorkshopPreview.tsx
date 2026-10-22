import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { DominoTile } from '../../components/DominoTile';
import { SkinConfig } from '../../core/store.types';

interface PremiumWorkshopPreviewProps {
    name: string;
    skinConfig: SkinConfig;
}

function PlayerPreview({ name, initial, bottom = false }: { name: string; initial: string; bottom?: boolean }) {
    return (
        <View style={[styles.player, bottom ? styles.playerBottom : styles.playerTop]}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{initial}</Text></View>
            <Text style={styles.playerName}>{name}</Text>
            <View style={styles.hand}>
                {[0, 1, 2, 3, 4].map(index => <View key={index} style={styles.hiddenTile} />)}
            </View>
        </View>
    );
}

export function PremiumWorkshopPreview({ name, skinConfig }: PremiumWorkshopPreviewProps) {
    return (
        <View style={[styles.container, { backgroundColor: skinConfig.tableBackgroundColor }]}>
            <View style={styles.previewLabel}>
                <Ionicons name="eye-outline" size={14} color="rgba(255,255,255,0.8)" />
                <Text style={styles.previewLabelText}>APERÇU EN DIRECT</Text>
                <Text numberOfLines={1} style={styles.designName}>{name || 'Ma création'}</Text>
            </View>
            <View style={[styles.board, { backgroundColor: skinConfig.boardColor ?? skinConfig.tableBackgroundColor }]}>
                <PlayerPreview name="Mapipi" initial="M" />
                <View style={styles.chain}>
                    <DominoTile left={6} right={5} size={32} orientation="horizontal" skinConfig={skinConfig} noMargin animateOnMount={false} disablePressScale />
                    <DominoTile left={5} right={4} size={32} orientation="horizontal" skinConfig={skinConfig} noMargin animateOnMount={false} disablePressScale />
                    <DominoTile left={4} right={2} size={32} orientation="horizontal" skinConfig={skinConfig} noMargin animateOnMount={false} disablePressScale />
                    <DominoTile left={2} right={0} size={32} orientation="horizontal" skinConfig={skinConfig} noMargin animateOnMount={false} disablePressScale />
                </View>
                <PlayerPreview name="Omar" initial="O" bottom />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 12 },
    previewLabel: { height: 30, flexDirection: 'row', alignItems: 'center', gap: 6 },
    previewLabelText: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    designName: { marginLeft: 'auto', maxWidth: '45%', color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
    board: {
        flex: 1, borderRadius: 18, overflow: 'hidden', justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
    },
    player: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 7 },
    playerTop: { top: 12 },
    playerBottom: { bottom: 12 },
    avatar: {
        width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#633D82', borderWidth: 2, borderColor: '#FFD700',
    },
    avatarText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
    playerName: { color: 'rgba(255,255,255,0.86)', fontSize: 11, fontWeight: '800' },
    hand: { marginLeft: 'auto', flexDirection: 'row', gap: 3 },
    hiddenTile: {
        width: 14, height: 27, borderRadius: 3, backgroundColor: '#E8D7FF',
        borderWidth: 1, borderColor: 'rgba(0,0,0,0.22)',
    },
    chain: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
