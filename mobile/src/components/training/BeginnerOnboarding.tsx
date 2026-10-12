import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

type OnboardingStep = {
    title: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
};

const STEPS: OnboardingStep[] = [
    {
        title: 'Bienvenue à la table',
        description: 'Cette partie est une pratique : prends ton temps, elle ne modifie ni tes statistiques ni tes récompenses.',
        icon: 'school-outline',
    },
    {
        title: 'Le plateau',
        description: 'Au centre, les dominos déjà joués forment la chaîne. Les deux valeurs aux extrémités indiquent les dominos que tu peux poser.',
        icon: 'git-branch-outline',
    },
    {
        title: 'Les joueurs',
        description: 'Les avatars autour du plateau représentent les adversaires. Le cadre lumineux et le compteur indiquent à qui est le tour.',
        icon: 'people-outline',
    },
    {
        title: 'Les mains',
        description: 'Tes dominos sont visibles en bas. Les dominos des adversaires restent cachés : leurs rectangles blancs indiquent seulement combien il leur en reste.',
        icon: 'apps-outline',
    },
    {
        title: 'Le menu Options',
        description: 'Le bouton engrenage en haut ouvre les réglages : musique, effets, vibration, changement de skin et quitter la partie.',
        icon: 'settings-outline',
    },
    {
        title: 'Trier ta main',
        description: 'Le petit bouton de tri près de ta main alterne entre trois ordres : Auto, Doubles puis Somme des points. Choisis celui qui t’aide à lire ton jeu.',
        icon: 'swap-horizontal-outline',
    },
    {
        title: 'À toi de jouer',
        description: 'Repère une valeur identique à une extrémité, puis touche le domino correspondant dans ta main. Les coups possibles sont mis en évidence.',
        icon: 'play-circle-outline',
    },
];

type BeginnerOnboardingProps = {
    onComplete: () => void;
};

export function BeginnerOnboarding({ onComplete }: BeginnerOnboardingProps) {
    const [stepIndex, setStepIndex] = useState(0);
    const step = STEPS[stepIndex];
    const isLastStep = stepIndex === STEPS.length - 1;

    const advance = () => {
        if (isLastStep) {
            onComplete();
            return;
        }
        setStepIndex(index => index + 1);
    };

    return (
        <View style={styles.backdrop}>
            <LinearGradient colors={['rgba(7, 27, 51, 0.97)', 'rgba(26, 14, 46, 0.97)']} style={styles.card}>
                <View style={styles.stepRow}>
                    <Text style={styles.stepText}>PRISE EN MAIN · {stepIndex + 1}/{STEPS.length}</Text>
                    <View style={styles.dots}>
                        {STEPS.map((_, index) => <View key={index} style={[styles.dot, index <= stepIndex && styles.dotActive]} />)}
                    </View>
                </View>
                <View style={styles.iconCircle}>
                    <Ionicons name={step.icon} size={42} color="#FFD700" />
                </View>
                <Text style={styles.title}>{step.title}</Text>
                <Text style={styles.description}>{step.description}</Text>
                <View style={styles.actions}>
                    {stepIndex > 0 ? (
                        <TouchableOpacity style={styles.previousButton} onPress={() => setStepIndex(index => index - 1)}>
                            <Text style={styles.previousText}>PRÉCÉDENT</Text>
                        </TouchableOpacity>
                    ) : <View />}
                    <TouchableOpacity style={styles.nextButton} onPress={advance}>
                        <Text style={styles.nextText}>{isLastStep ? 'COMMENCER' : 'SUIVANT'}</Text>
                        <Ionicons name={isLastStep ? 'play' : 'arrow-forward'} size={18} color="#1A0E2E" />
                    </TouchableOpacity>
                </View>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 10000,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 24,
    },
    card: {
        width: '100%',
        maxWidth: 480,
        borderRadius: 24,
        padding: 26,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.5)',
        alignItems: 'center',
        gap: 16,
    },
    stepRow: { width: '100%', alignItems: 'center', gap: 8 },
    stepText: { color: '#70D6FF', fontSize: 12, fontWeight: '900', letterSpacing: 0.9 },
    dots: { flexDirection: 'row', gap: 5 },
    dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.22)' },
    dotActive: { backgroundColor: '#FFD700' },
    iconCircle: { width: 82, height: 82, borderRadius: 41, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,215,0,0.13)' },
    title: { color: '#FFF', fontSize: 25, fontWeight: '900', textAlign: 'center' },
    description: { color: 'rgba(255,255,255,0.86)', fontSize: 16, lineHeight: 23, textAlign: 'center' },
    actions: { width: '100%', minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
    previousButton: { minHeight: 44, borderRadius: 13, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
    previousText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
    nextButton: { minHeight: 44, borderRadius: 13, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFD700' },
    nextText: { color: '#1A0E2E', fontSize: 12, fontWeight: '900' },
});
