import React from 'react';
import { Image, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Campaign } from '../core/campaigns/campaignPolicy';
import { LogService } from '../core/services/LogService';

export function CampaignModal({ campaign, onClose }: { campaign: Campaign | null; onClose: () => void }) {
    const router = useRouter();
    const open = () => {
        if (!campaign) return;
        const destination = campaign.destination;
        onClose();
        if (destination.type === 'EXTERNAL') void Linking.openURL(destination.url).catch(error => LogService.warn('Campaign', 'Lien indisponible.', error));
        else router.push(destination.type === 'STORE' ? '/store' : '/premium');
    };
    return <Modal visible={!!campaign} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlay}><View style={styles.card}>
            <TouchableOpacity accessibilityLabel="Fermer" accessibilityRole="button" style={styles.close} onPress={onClose}><Text style={styles.closeText}>✕</Text></TouchableOpacity>
            <ScrollView contentContainerStyle={styles.content}>
            {campaign && <><TouchableOpacity accessibilityRole="button" accessibilityLabel="Ouvrir la campagne" onPress={open} style={styles.imageLink}><Image source={{ uri: campaign.imageUrl }} style={styles.image} resizeMode="contain" /></TouchableOpacity><Text style={styles.title}>{campaign.title}</Text>{!!campaign.message && <Text style={styles.message}>{campaign.message}</Text>}<TouchableOpacity accessibilityRole="button" style={styles.button} onPress={open}><Text style={styles.buttonText}>{campaign.buttonLabel}</Text></TouchableOpacity></>}
            </ScrollView>
        </View></View>
    </Modal>;
}
const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    card: { width: '100%', maxWidth: 420, maxHeight: '90%', backgroundColor: '#271641', borderRadius: 20, padding: 20, alignItems: 'center' },
    close: { alignSelf: 'flex-end', padding: 8 }, closeText: { color: '#fff', fontSize: 22 },
    content: { alignItems: 'center', width: '100%' },
    imageLink: { width: '100%' }, image: { width: '100%', height: 180 }, title: { color: '#fff', fontWeight: 'bold', fontSize: 22, textAlign: 'center', marginTop: 12 },
    message: { color: '#eee', textAlign: 'center', marginTop: 10 }, button: { backgroundColor: '#ffd700', borderRadius: 10, padding: 14, marginTop: 18 }, buttonText: { color: '#1a0e2e', fontWeight: 'bold' },
});
