import React, { useEffect, useState } from 'react';
import { Image, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Campaign } from '../core/campaigns/campaignPolicy';
import { LogService } from '../core/services/LogService';

export function CampaignModal({ campaign, onClose }: { campaign: Campaign | null; onClose: () => void }) {
    const router = useRouter();
    const { width, height } = useWindowDimensions();
    const landscape = width > height;
    const [imageFailed, setImageFailed] = useState(false);
    const [imageRatio, setImageRatio] = useState<number | null>(null);
    const cardWidth = Math.min(680, width - 24);
    const cardHeight = Math.min(320, height - 24);
    const imageWidth = Math.min(cardWidth * 0.6, Math.max(cardWidth * 0.25, imageRatio ? imageRatio * cardHeight : cardWidth * 0.45));
    useEffect(() => { setImageFailed(false); setImageRatio(null); }, [campaign?.imageUrl]);
    const open = () => {
        if (!campaign) return;
        const destination = campaign.destination;
        onClose();
        if (destination.type === 'EXTERNAL') void Linking.openURL(destination.url).catch(error => LogService.warn('Campaign', 'Lien indisponible.', error));
        else router.push(destination.type === 'STORE' ? '/store' : '/premium');
    };
    const artwork = campaign && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Ouvrir la campagne" onPress={open} style={landscape ? [styles.artworkLandscape, { width: imageWidth }] : styles.artworkPortrait}>
        {imageFailed
            ? <View style={styles.imageFallback}><Text style={styles.fallbackText}>Image indisponible</Text></View>
            : <Image source={{ uri: campaign.imageUrl }} style={styles.image} resizeMode="contain" onLoad={event => {
                const nativeEvent = event.nativeEvent as { source?: { width?: number; height?: number }; target?: { naturalWidth?: number; naturalHeight?: number } } | undefined;
                const imageWidth = nativeEvent?.source?.width ?? nativeEvent?.target?.naturalWidth;
                const imageHeight = nativeEvent?.source?.height ?? nativeEvent?.target?.naturalHeight;
                if (imageWidth && imageHeight && imageWidth > 0 && imageHeight > 0) setImageRatio(imageWidth / imageHeight);
            }} onError={() => setImageFailed(true)} />}
    </TouchableOpacity>;
    const details = campaign && <View style={styles.details}>
        <Text style={styles.title}>{campaign.title}</Text>
        {!!campaign.message && <Text style={styles.message}>{campaign.message}</Text>}
        <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={open}><Text style={styles.buttonText}>{campaign.buttonLabel}</Text></TouchableOpacity>
    </View>;
    return <Modal visible={!!campaign} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlay}>
            <View style={[styles.card, landscape ? [styles.cardLandscape, { height: cardHeight }] : styles.cardPortrait]}>
                <TouchableOpacity accessibilityLabel="Fermer" accessibilityRole="button" style={styles.close} onPress={onClose}><Text style={styles.closeText}>✕</Text></TouchableOpacity>
                {landscape ? <>
                    {artwork}
                    <ScrollView style={styles.landscapeDetails} contentContainerStyle={styles.landscapeDetailsContent}>{details}</ScrollView>
                </> : <ScrollView style={styles.portraitScroll} contentContainerStyle={styles.portraitContent}>{artwork}{details}</ScrollView>}
            </View>
        </View>
    </Modal>;
}
const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', alignItems: 'center', padding: 12 },
    card: { width: '100%', backgroundColor: '#271641', borderRadius: 20, overflow: 'hidden' },
    cardLandscape: { maxWidth: 680, flexDirection: 'row' },
    cardPortrait: { maxWidth: 420, maxHeight: '94%' },
    close: { position: 'absolute', right: 10, top: 5, zIndex: 2, padding: 8 }, closeText: { color: '#fff', fontSize: 22 },
    artworkLandscape: { height: '100%' }, artworkPortrait: { width: '100%', height: 200 },
    image: { width: '100%', height: '100%' },
    imageFallback: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#392550' },
    fallbackText: { color: '#ddd', fontSize: 13 },
    landscapeDetails: { flex: 1 }, landscapeDetailsContent: { flexGrow: 1, justifyContent: 'center', padding: 20, paddingTop: 40 },
    portraitScroll: { width: '100%', flexShrink: 1 }, portraitContent: { paddingTop: 40, paddingBottom: 20 },
    details: { width: '100%', alignItems: 'center', paddingHorizontal: 12 },
    title: { color: '#fff', fontWeight: 'bold', fontSize: 20, textAlign: 'center', marginTop: 8 },
    message: { color: '#eee', textAlign: 'center', marginTop: 8 }, button: { backgroundColor: '#ffd700', borderRadius: 10, padding: 12, marginTop: 12 }, buttonText: { color: '#1a0e2e', fontWeight: 'bold', textAlign: 'center' },
});
