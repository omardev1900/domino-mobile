/**
 * debug-level.tsx
 *
 * 🛠 Écran de DEBUG — Niveaux de Joueur
 * Permet de simuler le gain d'XP et de tester l'animation de passage de niveau.
 *
 * ⚠️ ACCÈS : Uniquement visible en développement (__DEV__ === true)
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { xpRequiredForLevel, getLevelFromXP, getLevelUpChest } from '../src/core/RewardEngine';
import { LevelUpOverlay } from '../src/components/LevelUpOverlay';
import { MAX_LEVEL } from '../src/core/economy.constants';

export default function DebugLevelScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    
    // — État simulé —
    const [xp, setXp] = useState(0);
    const [showOverlay, setShowOverlay] = useState(false);
    const [overlayData, setOverlayData] = useState({ level: 1, coins: 0, diamonds: 0 });

    const currentLevel = getLevelFromXP(xp);
    const nextLevelXP = xpRequiredForLevel(Math.min(currentLevel + 1, MAX_LEVEL));
    const isMaxLevel = currentLevel >= MAX_LEVEL;
    const progress = isMaxLevel ? 1 : (xp - xpRequiredForLevel(currentLevel)) / (nextLevelXP - xpRequiredForLevel(currentLevel));

    const handleAddXP = (amount: number) => {
        const prevLevel = currentLevel;
        const newXp = Math.max(0, xp + amount);
        const newLevel = getLevelFromXP(newXp);
        
        setXp(newXp);

        if (newLevel > prevLevel) {
            // On vient de passer un (ou plusieurs) niveau(x) !
            // On calcule la récompense pour le niveau atteint
            const chest = getLevelUpChest(newLevel);
            setOverlayData({
                level: newLevel,
                coins: chest?.coinsReward || 50, // 50 coins par défaut si pas de coffre spécial
                diamonds: chest?.diamondReward || 0,
            });
            
            // Petit délai pour laisser l'interface se mettre à jour
            setTimeout(() => setShowOverlay(true), 100);
        }
    };

    return (
        <LinearGradient colors={['#0A1A10', '#1A2A1A', '#0A1A10']} style={styles.container}>
            {/* ─── Header ─── */}
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color="#4CAF50" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>🛠 Debug — Niveaux (XP)</Text>
                    <Text style={styles.headerSub}>Mode développeur</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 30 }]}>
                {/* ─── Compteur central ─── */}
                <Animated.View key={currentLevel} entering={ZoomIn.duration(300)} style={styles.counterCard}>
                    <Text style={styles.levelLabel}>NIVEAU ACTUEL</Text>
                    <Text style={styles.levelValue}>{currentLevel}</Text>
                    <Text style={styles.xpText}>{xp} XP au total</Text>
                </Animated.View>

                {/* ─── Barre de progression ─── */}
                <View style={styles.progressSection}>
                    <View style={styles.progressHeader}>
                        <Text style={styles.progressLabel}>Progression vers Niv. {Math.min(currentLevel + 1, MAX_LEVEL)}</Text>
                        <Text style={styles.progressValue}>{Math.floor(progress * 100)}%</Text>
                    </View>
                    <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]}>
                            <LinearGradient colors={['#4CAF50', '#81C784']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFillObject} />
                        </View>
                    </View>
                    <Text style={styles.progressSubtext}>
                        {isMaxLevel ? 'Niveau maximum atteint !' : `Encore ${nextLevelXP - xp} XP requis`}
                    </Text>
                </View>

                {/* ─── Contrôles ─── */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Ajouter de l'XP</Text>
                    <View style={styles.controlsRow}>
                        {[10, 50, 100, 500, 1000].map(n => (
                            <TouchableOpacity
                                key={n}
                                style={styles.controlBtn}
                                onPress={() => handleAddXP(n)}
                            >
                                <Text style={styles.controlBtnText}>+{n} XP</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
                
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Retirer de l'XP (pour tester)</Text>
                    <View style={styles.controlsRow}>
                        {[-10, -100, -1000].map(n => (
                            <TouchableOpacity
                                key={n}
                                style={[styles.controlBtn, styles.controlBtnNeg]}
                                onPress={() => handleAddXP(n)}
                            >
                                <Text style={styles.controlBtnText}>{n} XP</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* ─── Infos Techniques ─── */}
                <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>Détails du Niveau {currentLevel}</Text>
                    <Text style={styles.infoRow}>XP de départ du niveau : <Text style={styles.infoVal}>{xpRequiredForLevel(currentLevel)}</Text></Text>
                    <Text style={styles.infoRow}>XP pour niveau suivant : <Text style={styles.infoVal}>{nextLevelXP}</Text></Text>
                    <Text style={styles.infoRow}>
                        Coffre de niveau : 
                        <Text style={styles.infoVal}>
                            {getLevelUpChest(currentLevel) 
                                ? ` ${getLevelUpChest(currentLevel)?.coinsReward}🪙 ${getLevelUpChest(currentLevel)?.diamondReward}💎` 
                                : ' Aucun (Récompense standard: 50🪙)'}
                        </Text>
                    </Text>
                </View>
            </ScrollView>

            <LevelUpOverlay
                visible={showOverlay}
                level={overlayData.level}
                coins={overlayData.coins}
                diamonds={overlayData.diamonds}
                onClose={() => setShowOverlay(false)}
            />
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(76, 175, 80, 0.2)',
        gap: 10,
    },
    backBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: 'rgba(255,255,255,0.08)',
        justifyContent: 'center', alignItems: 'center',
    },
    headerTitle: { color: '#4CAF50', fontSize: 16, fontWeight: '900' },
    headerSub: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 1 },
    scroll: { padding: 16, gap: 24 },

    counterCard: {
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: 'rgba(76, 175, 80, 0.3)',
        padding: 24,
        alignItems: 'center',
    },
    levelLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 'bold', letterSpacing: 2 },
    levelValue: { color: '#FFD700', fontSize: 72, fontWeight: '900', marginVertical: 4 },
    xpText: { color: '#A5D6A7', fontSize: 14, fontWeight: '600' },

    progressSection: { gap: 8 },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
    progressLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
    progressValue: { color: '#4CAF50', fontSize: 13, fontWeight: 'bold' },
    progressTrack: {
        height: 16, backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 8, overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: 8 },
    progressSubtext: { color: 'rgba(255,255,255,0.5)', fontSize: 11, textAlign: 'center' },

    section: { gap: 12 },
    sectionTitle: {
        color: '#4CAF50', fontSize: 12, fontWeight: '900',
        textTransform: 'uppercase', letterSpacing: 1.5,
    },
    controlsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    controlBtn: {
        paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12,
        backgroundColor: 'rgba(76,175,80,0.2)', borderWidth: 1, borderColor: '#4CAF50',
        alignItems: 'center', minWidth: 70,
    },
    controlBtnNeg: {
        backgroundColor: 'rgba(244,67,54,0.15)', borderColor: '#F44336',
    },
    controlBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },

    infoCard: {
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 16, padding: 16, gap: 6,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    },
    infoTitle: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
    infoRow: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
    infoVal: { color: '#FFD700', fontWeight: 'bold' },
});
