import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface Props { visible: boolean; trialEligible: boolean; onClose: () => void; onDiscover: () => void }
export function ReplayPremiumOffer({ visible, trialEligible, onClose, onDiscover }: Props) {
    const { height } = useWindowDimensions();
    return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
        <View style={styles.backdrop}><View style={[styles.card, { maxHeight: height * 0.9 }]}>
            <LinearGradient pointerEvents="none" colors={['#583176', '#241538']} style={StyleSheet.absoluteFillObject} />
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.header}><View style={styles.icon}><Ionicons name="play" size={26} color="#291a42" /></View><Text accessibilityRole="header" style={styles.title}>Revis ta partie</Text></View>
                <Text style={styles.text}>Revois les coups, retrouve les moments décisifs et découvre les dominos de tes adversaires.</Text>
                <View style={styles.premium}><Ionicons name="star" size={18} color="#FFD700" /><Text style={styles.premiumText}>Fonction réservée aux joueurs Premium</Text></View>
                <Text style={styles.detail}>L’achat du replay coûte 2 000 coins. Il est sauvegardé et peut être revu gratuitement tant que Premium est actif.</Text>
                <TouchableOpacity accessibilityRole="button" onPress={onDiscover} style={styles.primary}><Text style={styles.primaryText}>{trialEligible ? 'Essayer Premium gratuitement' : 'Découvrir Premium'}</Text><Ionicons name="arrow-forward" size={18} color="#28153e" /></TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" onPress={onClose} style={styles.later}><Text style={styles.text}>Plus tard</Text></TouchableOpacity>
            </ScrollView>
        </View></View>
    </Modal>;
}
const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', alignItems: 'center', padding: 12 },
    card: { width: '100%', maxWidth: 500, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,215,0,0.45)' },
    content: { padding: 18, gap: 10 }, header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFD700', alignItems: 'center', justifyContent: 'center' },
    title: { color: '#FFD700', fontSize: 21, fontWeight: '900', flexShrink: 1 }, text: { color: '#fff', fontSize: 14, lineHeight: 20 },
    premium: { flexDirection: 'row', alignItems: 'center', gap: 8 }, premiumText: { color: '#FFD700', fontWeight: '800', flexShrink: 1 },
    detail: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 18 },
    primary: { backgroundColor: '#FFD700', borderRadius: 10, padding: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }, primaryText: { color: '#28153e', fontWeight: '900', textAlign: 'center', flexShrink: 1 },
    later: { alignItems: 'center', padding: 6 },
});
