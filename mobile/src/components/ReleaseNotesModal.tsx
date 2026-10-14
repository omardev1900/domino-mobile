import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { ReleaseNotesContent } from './ReleaseNotesContent';

interface ReleaseNotesModalProps {
    visible: boolean;
    onAcknowledge: () => void;
}

export function ReleaseNotesModal({ visible, onAcknowledge }: ReleaseNotesModalProps) {
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const isSmallPhone = Math.min(screenWidth, screenHeight) < 430;

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onAcknowledge} statusBarTranslucent>
            <Animated.View entering={FadeIn.duration(180)} style={styles.backdrop}>
                <Animated.View entering={ZoomIn.duration(240)} style={[styles.card, { height: Math.round(screenHeight * 0.88) }]}>
                    <LinearGradient colors={['#3D2464', '#1A0E2E']} style={styles.gradient}>
                        <View style={styles.header}>
                            <View style={styles.titleRow}>
                                <Ionicons name="sparkles" size={25} color="#FFD700" />
                                <Text style={styles.title}>Nouveautés de cette version</Text>
                            </View>
                            <Pressable
                                style={styles.closeButton}
                                onPress={onAcknowledge}
                                accessibilityRole="button"
                                accessibilityLabel="Fermer les nouveautés"
                            >
                                <Ionicons name="close" size={25} color="#FFD700" />
                            </Pressable>
                        </View>
                        <View style={styles.listViewport}>
                            <ScrollView
                                style={styles.scroll}
                                contentContainerStyle={styles.scrollContent}
                                showsVerticalScrollIndicator
                                nestedScrollEnabled
                                scrollEnabled
                                persistentScrollbar={isSmallPhone}
                            >
                                <ReleaseNotesContent />
                            </ScrollView>
                        </View>
                    </LinearGradient>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
        backgroundColor: 'rgba(0,0,0,0.78)',
    },
    card: {
        width: '96%',
        maxWidth: 920,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: 'rgba(255,215,0,0.72)',
        borderRadius: 22,
        elevation: 18,
    },
    gradient: {
        padding: 20,
        minHeight: 0,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    titleRow: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 9,
        paddingLeft: 32,
    },
    title: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: '900',
        textAlign: 'center',
    },
    listViewport: {
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 2,
        paddingBottom: 4,
        flexGrow: 1,
        justifyContent: 'center',
    },
    closeButton: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,215,0,0.12)',
    },
});
