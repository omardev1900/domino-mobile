import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
    PREVIOUS_RELEASE_SECTIONS,
    PREVIOUS_RELEASE_VERSION,
    RELEASE_SECTIONS,
    RELEASE_VERSION,
} from '../core/releaseNotes';

export function ReleaseNotesContent() {
    return <View>
        <View style={styles.currentRelease}>
            <View style={styles.releaseHeadingRow}>
                <Text accessibilityRole="header" style={styles.releaseHeading}>Version {RELEASE_VERSION}</Text>
                <Text style={styles.featuredLabel}>À LA UNE</Text>
            </View>
            {RELEASE_SECTIONS.map(section => <View key={`current-${section.title}`} style={styles.section}>
                <Text accessibilityRole="header" style={styles.heading}>{section.title}</Text>
                {section.notes.map(note => <View key={note} style={styles.noteRow}>
                    <Text style={styles.bullet}>•</Text><Text style={styles.note}>{note}</Text>
                </View>)}
            </View>)}
        </View>

        <View style={styles.previousRelease}>
            <Text accessibilityRole="header" style={styles.previousHeading}>Version {PREVIOUS_RELEASE_VERSION}</Text>
            {PREVIOUS_RELEASE_SECTIONS.map(section => <View key={`previous-${section.title}`} style={styles.section}>
                <Text accessibilityRole="header" style={styles.heading}>{section.title}</Text>
                {section.notes.map(note => <View key={note} style={styles.noteRow}>
                    <Text style={styles.bullet}>•</Text><Text style={styles.note}>{note}</Text>
                </View>)}
            </View>)}
        </View>
    </View>;
}

const styles = StyleSheet.create({
    currentRelease: { padding: 12, marginBottom: 16, borderRadius: 12, backgroundColor: 'rgba(255,215,0,0.08)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)' },
    previousRelease: { paddingTop: 4 },
    releaseHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    releaseHeading: { color: '#fff', fontSize: 18, fontWeight: '900' },
    featuredLabel: { color: '#24163c', backgroundColor: '#FFD700', fontSize: 10, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    previousHeading: { color: '#FFD700', fontSize: 17, fontWeight: '900', marginBottom: 12 },
    section: { marginBottom: 12 },
    heading: { color: '#FFD700', fontSize: 16, fontWeight: '900', marginBottom: 10 },
    noteRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
    bullet: { color: '#FFD700', fontSize: 18, fontWeight: '900', lineHeight: 20, marginRight: 8 },
    note: { flex: 1, color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 20 },
});
