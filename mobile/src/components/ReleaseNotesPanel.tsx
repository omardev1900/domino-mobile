import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ReleaseNotesContent } from './ReleaseNotesContent';
import { RELEASE_VERSION } from '../core/releaseNotes';

export function ReleaseNotesPanel({ onClose }: { onClose: () => void }) {
    const { height } = useWindowDimensions();
    return <View style={styles.overlay} accessibilityViewIsModal>
        <View style={[styles.card, { maxHeight: height * 0.88 }]}>
            <View style={styles.header}>
                <View style={styles.heading}><Text accessibilityRole="header" style={styles.title}>Notes de version</Text><Text style={styles.version}>Version {RELEASE_VERSION}</Text></View>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Fermer les notes de version" onPress={onClose} style={styles.close}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator contentContainerStyle={styles.content}><ReleaseNotesContent /></ScrollView>
        </View>
    </View>;
}

const styles = StyleSheet.create({
    overlay: { ...StyleSheet.absoluteFillObject, zIndex: 10000, elevation: 30, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center', padding: 16 },
    card: { width: '100%', maxWidth: 560, backgroundColor: '#24163c', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,215,0,0.5)', overflow: 'hidden' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.12)' },
    heading: { flex: 1 },
    title: { fontSize: 20, fontWeight: '900', color: '#fff' },
    version: { color: '#FFD700', fontSize: 13, marginTop: 3, fontWeight: '700' },
    close: { padding: 8 },
    content: { padding: 16 },
});
