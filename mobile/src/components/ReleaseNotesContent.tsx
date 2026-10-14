import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RELEASE_NOTES } from '../core/releaseNotes';

export function ReleaseNotesContent() {
    return (
        <View>
            {RELEASE_NOTES.map((note) => (
                <View key={note} style={styles.noteRow}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.note}>{note}</Text>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    noteRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'center',
        marginBottom: 10,
        paddingHorizontal: 16,
    },
    bullet: {
        color: '#FFD700',
        fontSize: 18,
        fontWeight: '900',
        lineHeight: 20,
        marginRight: 8,
    },
    note: {
        flexShrink: 1,
        color: 'rgba(255,255,255,0.9)',
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
    },
});
