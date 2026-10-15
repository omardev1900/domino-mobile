import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

type Target = 'title' | 'info' | 'board' | 'hand' | 'next';
type Rect = { left: number; top: number; width: number; height: number };

const steps: { title: string; description: string; target?: Target; icon: keyof typeof Ionicons.glyphMap }[] = [
    { title: 'Bienvenue à l’entraînement', description: 'Le programme Mapipi contient 10 situations pour t’apprendre à garder des sorties et mieux gérer ta main.', icon: 'school-outline' },
    { title: 'Le titre de l’exercice', description: 'Il indique la stratégie travaillée dans la situation en cours.', target: 'title', icon: 'ribbon-outline' },
    { title: 'Le bouton INFO', description: 'Appuie ici si tu veux relire l’objectif détaillé avant de jouer.', target: 'info', icon: 'information-circle-outline' },
    { title: 'Le plateau', description: 'Pose un domino sur une des deux extrémités ouvertes. Un coup jouable est accepté, même s’il n’est pas optimal.', target: 'board', icon: 'git-branch-outline' },
    { title: 'Ta main', description: 'Glisse un domino vers le plateau. Tu peux aussi le sélectionner puis toucher l’extrémité voulue.', target: 'hand', icon: 'apps-outline' },
    { title: 'Exercice suivant', description: 'Ce bouton permet de passer au défi suivant quand tu le souhaites.', target: 'next', icon: 'arrow-forward-circle-outline' },
    { title: 'À toi de jouer', description: 'Choisis maintenant la meilleure pose pour cette première situation Mapipi.', icon: 'play-circle-outline' },
];

export function TrainingExerciseOnboarding({ onComplete }: { onComplete: () => void }) {
    const [stepIndex, setStepIndex] = useState(0);
    const { width, height } = useWindowDimensions();
    const step = steps[stepIndex];
    const rect = step.target ? getRect(step.target, width, height) : null;
    const isLast = stepIndex === steps.length - 1;

    return (
        <View style={styles.root}>
            {rect ? <SpotlightMask rect={rect} width={width} height={height} /> : <View style={styles.fullMask} />}
            {rect && <View pointerEvents="none" style={[styles.border, rect]} />}
            <LinearGradient colors={['rgba(16,42,67,0.98)', 'rgba(45,27,78,0.98)']} style={[styles.card, getCardPosition(rect, width, height, step.target)]}>
                <View style={styles.stepLine}><Text style={styles.stepText}>GUIDE D’ENTRAÎNEMENT · {stepIndex + 1}/{steps.length}</Text><View style={styles.dots}>{steps.map((_, index) => <View key={index} style={[styles.dot, index <= stepIndex && styles.dotActive]} />)}</View></View>
                <View style={styles.iconCircle}><Ionicons name={step.icon} size={28} color="#FFD700" /></View>
                <Text style={styles.title}>{step.title}</Text>
                <Text style={styles.description}>{step.description}</Text>
                <View style={styles.actions}>
                    {stepIndex > 0 ? <TouchableOpacity style={styles.previous} onPress={() => setStepIndex(index => index - 1)}><Text style={styles.previousText}>PRÉCÉDENT</Text></TouchableOpacity> : <View />}
                    <TouchableOpacity style={styles.next} onPress={() => isLast ? onComplete() : setStepIndex(index => index + 1)}><Text style={styles.nextText}>{isLast ? 'COMMENCER' : 'SUIVANT'}</Text><Ionicons name={isLast ? 'play' : 'arrow-forward'} size={17} color="#1A0E2E" /></TouchableOpacity>
                </View>
            </LinearGradient>
        </View>
    );
}

function getRect(target: Target, width: number, height: number): Rect {
    const landscape = width >= height;
    const verticalOffset = Math.max(20, Math.min(40, height * 0.04)) + 10;
    if (landscape) {
        const rects: Record<Target, Rect> = {
            title: { left: width * 0.035 - 20, top: height * 0.12, width: width * 0.32, height: height * 0.143 },
            info: { left: width * 0.43 - 20, top: height * 0.13, width: width * 0.1, height: height * 0.08 + 20 },
            board: { left: width * 0.05, top: height * 0.25, width: width * 0.9, height: height * 0.37 },
            hand: { left: width * 0.08, top: height * 0.67, width: width * 0.84, height: height * 0.2 + 20 },
            next: { left: width * 0.82 - 60, top: height * 0.12, width: width * 0.13 + 40, height: height * 0.1 + 30 },
        };
        return { ...rects[target], top: rects[target].top + verticalOffset };
    }
    const rects: Record<Target, Rect> = {
        title: { left: width * 0.05 - 20, top: height * 0.14, width: width * 0.48, height: height * 0.13 },
        info: { left: width * 0.42 - 20, top: height * 0.14, width: width * 0.18, height: height * 0.07 + 20 },
        board: { left: width * 0.06, top: height * 0.27, width: width * 0.88, height: height * 0.32 },
        hand: { left: width * 0.06, top: height * 0.64, width: width * 0.88, height: height * 0.16 + 20 },
        next: { left: width * 0.73 - 60, top: height * 0.14, width: width * 0.21 + 40, height: height * 0.08 + 30 },
    };
    return { ...rects[target], top: rects[target].top + verticalOffset };
}

function getCardPosition(rect: Rect | null, width: number, height: number, target?: Target) {
    const landscape = width >= height;
    if (!rect) return { top: '50%', transform: [{ translateY: -138 }] };
    if (target === 'next') return { top: '50%', width: '62%', transform: [{ translateY: -138 }] };
    if (landscape) return rect.top < height * 0.23 ? { bottom: 18, right: 18, maxWidth: width * 0.28 } : { top: 18, right: 18, maxWidth: width * 0.28 };
    return rect.top < height * 0.35 ? { bottom: 22 } : { top: 22 };
}

function SpotlightMask({ rect, width, height }: { rect: Rect; width: number; height: number }) {
    return <View pointerEvents="none" style={styles.maskLayer}>
        <View style={[styles.mask, { left: 0, top: 0, width, height: rect.top }]} />
        <View style={[styles.mask, { left: 0, top: rect.top, width: rect.left, height: rect.height }]} />
        <View style={[styles.mask, { left: rect.left + rect.width, top: rect.top, width: width - rect.left - rect.width, height: rect.height }]} />
        <View style={[styles.mask, { left: 0, top: rect.top + rect.height, width, height: height - rect.top - rect.height }]} />
    </View>;
}

const styles = StyleSheet.create({
    root: { ...StyleSheet.absoluteFillObject, zIndex: 10000 },
    fullMask: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.74)' },
    maskLayer: { ...StyleSheet.absoluteFillObject },
    mask: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.74)' },
    border: { position: 'absolute', borderWidth: 3, borderColor: '#FFD700', borderRadius: 18, backgroundColor: 'rgba(255,215,0,0.08)', shadowColor: '#FFD700', shadowOpacity: 0.9, shadowRadius: 18, elevation: 9 },
    card: { position: 'absolute', alignSelf: 'center', width: '88%', padding: 16, borderRadius: 19, borderWidth: 1, borderColor: 'rgba(255,215,0,0.55)', alignItems: 'center' },
    stepLine: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
    stepText: { color: '#70D6FF', fontSize: 9, fontWeight: '900', letterSpacing: 0.55 },
    dots: { flexDirection: 'row', gap: 3 },
    dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
    dotActive: { backgroundColor: '#FFD700' },
    iconCircle: { width: 47, height: 47, marginTop: 10, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,215,0,0.13)' },
    title: { marginTop: 7, color: '#FFF', fontSize: 19, fontWeight: '900', textAlign: 'center' },
    description: { marginTop: 7, color: 'rgba(255,255,255,0.86)', fontSize: 13, lineHeight: 18, textAlign: 'center' },
    actions: { width: '100%', marginTop: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    previous: { minHeight: 38, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
    previousText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
    next: { minHeight: 38, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 11, backgroundColor: '#FFD700' },
    nextText: { color: '#1A0E2E', fontSize: 10, fontWeight: '900' },
});
