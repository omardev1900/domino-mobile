/**
 * SoloResumeModal
 *
 * Petit modal centré qui propose de reprendre une partie solo en cours.
 * Deux boutons : "Reprendre" et "Abandonner".
 * Affiché globalement depuis _layout.tsx.
 */
import React from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    TouchableWithoutFeedback,
    Platform,
} from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { SoloResumeInfo } from '../hooks/useSoloResume';

const GAME_MODE_LABEL: Record<string, string> = {
    SCORE: 'Score',
    COCHON: 'Cochons 🐷',
    MANCHE: 'Manches',
};

interface SoloResumeModalProps {
    resumeInfo: SoloResumeInfo;
    onResume: () => void;
    onAbandon: () => void;
}

export function SoloResumeModal({ resumeInfo, onResume, onAbandon }: SoloResumeModalProps) {
    const modeLabel = GAME_MODE_LABEL[resumeInfo.gameMode] ?? resumeInfo.gameMode;

    return (
        <Modal
            transparent
            animationType="none"
            visible
            statusBarTranslucent
        >
            <TouchableWithoutFeedback onPress={() => { /* ne pas fermer en cliquant dehors */ }}>
                <View style={styles.overlay}>
                    <Animated.View
                        entering={FadeIn.duration(200)}
                        style={styles.backdrop}
                    />
                    <Animated.View
                        entering={ZoomIn.springify().damping(18).stiffness(220)}
                        style={styles.card}
                    >
                        {/* Icône */}
                        <View style={styles.iconCircle}>
                            <Text style={styles.iconText}>⏸️</Text>
                        </View>

                        {/* Titre */}
                        <Text style={styles.title}>Partie solo en cours</Text>

                        {/* Infos de la partie */}
                        <View style={styles.infoBadge}>
                            <Text style={styles.infoText}>
                                {modeLabel} · Manche {resumeInfo.mancheNumber} · Round {resumeInfo.roundNumber}
                            </Text>
                        </View>

                        <Text style={styles.subtitle}>
                            Tu as une partie en attente.{'\n'}Veux-tu la reprendre ?
                        </Text>

                        {/* Boutons */}
                        <TouchableOpacity
                            id="btn-solo-resume"
                            style={styles.resumeBtn}
                            onPress={onResume}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.resumeBtnText}>▶  Reprendre la partie</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            id="btn-solo-abandon"
                            style={styles.abandonBtn}
                            onPress={onAbandon}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.abandonBtnText}>Abandonner</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 28,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.65)',
    },
    card: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#1E1140',
        borderRadius: 24,
        padding: 28,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.25)',
        // Ombre douce
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.45,
                shadowRadius: 20,
            },
            android: { elevation: 16 },
        }),
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255,215,0,0.12)',
        borderWidth: 1.5,
        borderColor: 'rgba(255,215,0,0.35)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 14,
    },
    iconText: {
        fontSize: 28,
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        color: '#FFD700',
        marginBottom: 10,
        textAlign: 'center',
    },
    infoBadge: {
        backgroundColor: 'rgba(255,215,0,0.1)',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 5,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.2)',
    },
    infoText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
        fontWeight: '600',
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.55)',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    resumeBtn: {
        width: '100%',
        backgroundColor: '#FFD700',
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
        marginBottom: 10,
    },
    resumeBtnText: {
        fontSize: 15,
        fontWeight: '900',
        color: '#1A0E2E',
    },
    abandonBtn: {
        width: '100%',
        backgroundColor: 'transparent',
        borderRadius: 14,
        paddingVertical: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    abandonBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.4)',
    },
});
