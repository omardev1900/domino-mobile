import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

type Props = { active: boolean; onReplays: () => void; onWorkshop: () => void; onTraining: () => void; onShop: () => void; onPremium: () => void };

export function PremiumHomeFeatures({ active, onReplays, onWorkshop, onTraining, onShop, onPremium }: Props) {
    const features = [
        { title: 'Mes replays', description: 'Revoir mes parties', icon: 'play' as const, decoration: 'grid-outline' as const, accent: '#FFD775', colors: ['#775019', '#291A36'] as const, onPress: onReplays },
        { title: 'Atelier des skins', description: 'Créer mon style', icon: 'color-palette' as const, decoration: 'color-wand-outline' as const, accent: '#E8ABFF', colors: ['#6B3286', '#291A46'] as const, onPress: onWorkshop },
        { title: 'Entraînement avancé', description: 'Progresser en jouant', icon: 'trophy' as const, decoration: 'flash-outline' as const, accent: '#9CE6B5', colors: ['#276B59', '#192E3B'] as const, onPress: onTraining },
        ...(active ? [{ title: 'Boutique Premium', description: 'Découvrir les offres', icon: 'storefront' as const, decoration: 'sparkles-outline' as const, accent: '#FFD775', colors: ['#8A5228', '#3B2045'] as const, onPress: onShop }] : []),
    ];
    return <View style={styles.section}>
        <Text style={styles.heading}>AVANTAGES PREMIUM</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.list}>{features.map(feature => <TouchableOpacity key={feature.title} accessibilityRole="button" accessibilityLabel={feature.title} onPress={active ? feature.onPress : onPremium} activeOpacity={0.8} style={styles.card}>
            <LinearGradient colors={feature.colors} style={styles.cardContent}>
                <Ionicons name={feature.decoration} size={58} color="rgba(255,255,255,0.09)" style={styles.decoration} />
                <View style={[styles.icon, { borderColor: feature.accent }]}><Ionicons name={feature.icon} size={23} color={feature.accent} /></View>
                <View style={styles.copy}><Text style={styles.title}>{feature.title}</Text><Text style={styles.description}>{feature.description}</Text></View>
                <View style={styles.footer}><View style={[styles.accentLine, { backgroundColor: feature.accent }]} /><Ionicons name={active ? 'arrow-forward' : 'lock-closed'} size={16} color={feature.accent} /></View>
                {!active && <View pointerEvents="none" style={styles.lockedOverlay} />}
            </LinearGradient>
        </TouchableOpacity>)}</ScrollView>
    </View>;
}

const styles = StyleSheet.create({
    section: { gap: 8 },
    heading: { color: '#FFD700', fontSize: 13, fontWeight: '900', letterSpacing: 0.8 },
    list: { flexDirection: 'row', gap: 8, paddingBottom: 5 },
    card: { width: 148, borderRadius: 15, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,215,0,0.35)', elevation: 3 },
    cardContent: { flex: 1, minHeight: 155, padding: 10, justifyContent: 'space-between', gap: 8, overflow: 'hidden' },
    decoration: { position: 'absolute', right: -8, top: 2, transform: [{ rotate: '-18deg' }] },
    icon: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.24)', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    copy: { flexGrow: 1, justifyContent: 'center' },
    title: { color: '#fff', fontSize: 13, fontWeight: '900' },
    description: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 3 },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    accentLine: { height: 3, width: 24, borderRadius: 2 },
    lockedOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.15)' },
});
