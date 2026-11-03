import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RELEASE_SECTIONS } from '../core/releaseNotes';

export function ReleaseNotesContent() {
    return <View>{RELEASE_SECTIONS.map(section => <View key={section.title} style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>{section.title}</Text>
        {section.notes.map(note => <View key={note} style={styles.noteRow}>
            <Text style={styles.bullet}>•</Text><Text style={styles.note}>{note}</Text>
        </View>)}
    </View>)}</View>;
}

const styles = StyleSheet.create({
    section: { marginBottom: 12 },
    heading: { color: '#FFD700', fontSize: 16, fontWeight: '900', marginBottom: 10 },
    noteRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
    bullet: { color: '#FFD700', fontSize: 18, fontWeight: '900', lineHeight: 20, marginRight: 8 },
    note: { flex: 1, color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 20 },
});
