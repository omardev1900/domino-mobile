import React, { useState, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { LeagueHubView, LeagueHubTabType } from '../src/components/LeagueHubView';

export default function LigueCochonsScreen() {
    const insets = useSafeAreaInsets();
    const [activeTab, setActiveTab] = useState<LeagueHubTabType>('MA_LIGUE');

    useFocusEffect(
        useCallback(() => {

        }, [])
    );

    return (
        <LinearGradient colors={['#1A0535', '#0D0520', '#180830']} style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <Text style={styles.headerTitle}>Ligue des Cochons</Text>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.headerTabsScroll}
                    contentContainerStyle={styles.headerTabsRow}
                >
                    {([
                        { id: 'MA_LIGUE', label: 'Ma Ligue' },
                        { id: 'CLASSEMENT_MOIS', label: 'Mois' },
                        { id: 'CLASSEMENT_GLOBAL', label: 'Global' },
                    ] as { id: LeagueHubTabType; label: string }[]).map((tab) => (
                        <TouchableOpacity
                            key={tab.id}
                            style={[styles.headerTabBtn, activeTab === tab.id && styles.headerTabBtnActive]}
                            onPress={() => setActiveTab(tab.id)}
                        >
                            <Text style={[styles.headerTabText, activeTab === tab.id && styles.headerTabTextActive]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <View style={[styles.content, { paddingBottom: insets.bottom + 16 }]}>
                <LeagueHubView activeTab={activeTab} onActiveTabChange={setActiveTab} hidePrimaryTabs />
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 18,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,215,0,0.15)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerTitle: {
        color: '#FFD700',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 0.2,
        textAlign: 'left',
        flexShrink: 0,
    },
    headerTabsScroll: {
        flex: 1,
    },
    headerTabsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 4,
    },
    headerTabBtn: {
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    headerTabBtnActive: {
        backgroundColor: 'rgba(255,215,0,0.14)',
        borderColor: '#FFD700',
    },
    headerTabText: {
        color: 'rgba(255,255,255,0.62)',
        fontSize: 11,
        fontWeight: '800',
    },
    headerTabTextActive: {
        color: '#FFD700',
    },
    content: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 10,
    },
});
