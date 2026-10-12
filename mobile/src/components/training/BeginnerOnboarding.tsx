import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

type OnboardingStep = {
    title: string;
    description: string;
    icon?: keyof typeof Ionicons.glyphMap;
    spotlight?: SpotlightTarget;
    cardPosition: 'top' | 'bottom' | 'center' | 'left';
};

type SpotlightTarget = 'table' | 'players' | 'hands' | 'options' | 'sort';

type SpotlightRect = { left: number; top: number; width: number; height: number };

const STEPS: OnboardingStep[] = [
    {
        title: 'Bienvenue à la table',
        description: 'Cette partie est une pratique : prends ton temps, elle ne modifie ni tes statistiques ni tes récompenses.',
        icon: 'school-outline',
        cardPosition: 'center',
    },
    {
        title: 'Le plateau',
        description: 'Au centre, les dominos déjà joués forment la chaîne. Les deux valeurs aux extrémités indiquent les dominos que tu peux poser.',
        icon: 'git-branch-outline',
        spotlight: 'table',
        cardPosition: 'left',
    },
    {
        title: 'Les joueurs',
        description: 'Les avatars autour du plateau représentent les adversaires. Le cadre lumineux et le compteur indiquent à qui est le tour.',
        icon: 'people-outline',
        spotlight: 'players',
        cardPosition: 'bottom',
    },
    {
        title: 'Les mains',
        description: 'Tes dominos sont visibles en bas. Les dominos des adversaires restent cachés : leurs rectangles blancs indiquent seulement combien il leur en reste.',
        icon: 'apps-outline',
        spotlight: 'hands',
        cardPosition: 'top',
    },
    {
        title: 'Le menu Options',
        description: 'Le bouton engrenage en haut ouvre les réglages : musique, effets, vibration, changement de skin et quitter la partie.',
        icon: 'settings-outline',
        spotlight: 'options',
        cardPosition: 'bottom',
    },
    {
        title: 'Trier ta main',
        description: 'Le petit bouton de tri près de ta main alterne entre trois ordres : Auto, Doubles puis Somme des points. Choisis celui qui t’aide à lire ton jeu.',
        icon: 'swap-horizontal-outline',
        spotlight: 'sort',
        cardPosition: 'top',
    },
    {
        title: 'À toi de jouer',
        description: 'Repère une valeur identique à une extrémité, puis touche le domino correspondant dans ta main. Les coups possibles sont mis en évidence.',
        icon: 'play-circle-outline',
        spotlight: 'hands',
        cardPosition: 'top',
    },
];

type BeginnerOnboardingProps = {
    onComplete: () => void;
};

export function BeginnerOnboarding({ onComplete }: BeginnerOnboardingProps) {
    const [stepIndex, setStepIndex] = useState(0);
    const { width, height } = useWindowDimensions();
    const step = STEPS[stepIndex];
    const isLastStep = stepIndex === STEPS.length - 1;
    const spotlights = step.spotlight ? getSpotlightRects(step.spotlight, width, height) : undefined;
    const isIntroduction = stepIndex === 0;

    const advance = () => {
        if (isLastStep) {
            onComplete();
            return;
        }
        setStepIndex(index => index + 1);
    };

    return (
        <View style={styles.backdrop}>
            {spotlights ? <SpotlightMask rects={spotlights} width={width} height={height} /> : <View style={styles.fullMask} />}
            {spotlights?.map((spotlight, index) => <View key={index} pointerEvents="none" style={[styles.spotlightBorder, spotlight]} />)}
            <LinearGradient colors={['rgba(7, 27, 51, 0.98)', 'rgba(26, 14, 46, 0.98)']} style={[styles.card, isIntroduction ? styles.introductionCard : styles.compactCard, getCardPosition(step.cardPosition, height, width)]}>
                {isIntroduction ? <>
                    <View style={styles.stepRow}>
                        <Text style={styles.stepText}>PRISE EN MAIN · {stepIndex + 1}/{STEPS.length}</Text>
                        <View style={styles.dots}>
                            {STEPS.map((_, index) => <View key={index} style={[styles.dot, index <= stepIndex && styles.dotActive]} />)}
                        </View>
                    </View>
                    <View style={styles.iconCircle}>
                        <Ionicons name={step.icon!} size={42} color="#FFD700" />
                    </View>
                </> : <Text style={styles.compactStepText}>{stepIndex + 1}/{STEPS.length} · {step.title}</Text>}
                {isIntroduction && <Text style={styles.title}>{step.title}</Text>}
                <Text style={[styles.description, !isIntroduction && styles.compactDescription]}>{step.description}</Text>
                <View style={styles.actions}>
                    {stepIndex > 0 ? (
                        <TouchableOpacity accessibilityLabel="Étape précédente" style={[styles.previousButton, !isIntroduction && styles.iconButton]} onPress={() => setStepIndex(index => index - 1)}>
                            {isIntroduction ? <Text style={styles.previousText}>PRÉCÉDENT</Text> : <Ionicons name="arrow-back" size={19} color="#FFF" />}
                        </TouchableOpacity>
                    ) : <View />}
                    <TouchableOpacity accessibilityLabel={isLastStep ? 'Commencer la partie' : 'Étape suivante'} style={[styles.nextButton, !isIntroduction && styles.iconButton]} onPress={advance}>
                        {isIntroduction && <Text style={styles.nextText}>SUIVANT</Text>}
                        <Ionicons name={isIntroduction && isLastStep ? 'play' : 'arrow-forward'} size={isIntroduction ? 18 : 20} color="#1A0E2E" />
                    </TouchableOpacity>
                </View>
            </LinearGradient>
        </View>
    );
}

function getSpotlightRects(target: SpotlightTarget, width: number, height: number): SpotlightRect[] {
    const landscape = width >= height;
    if (!landscape) {
        const portraitRects: Record<SpotlightTarget, SpotlightRect[]> = {
            table: [{ left: width * 0.08, top: height * 0.27, width: width * 0.84, height: height * 0.34 }],
            players: [{ left: width * 0.04, top: height * 0.08, width: width * 0.38, height: height * 0.22 }, { left: width * 0.58, top: height * 0.08, width: width * 0.38, height: height * 0.22 }],
            hands: [{ left: width * 0.05, top: height * 0.7, width: width * 0.9, height: height * 0.22 }],
            options: [{ left: width * 0.62, top: height * 0.03, width: width * 0.28, height: height * 0.1 }],
            sort: [{ left: width * 0.81, top: height * 0.71, width: width * 0.15, height: height * 0.16 }],
        };
        return portraitRects[target];
    }

    const landscapeRects: Record<SpotlightTarget, SpotlightRect[]> = {
        table: [{ left: width * 0.26, top: height * 0.25, width: width * 0.48, height: height * 0.42 }],
        players: [{ left: width * 0.018, top: height * 0.05, width: width * 0.19, height: height * 0.27 }, { left: width * 0.792, top: height * 0.05, width: width * 0.19, height: height * 0.27 }],
        hands: [{ left: width * 0.28, top: height * 0.7, width: width * 0.48, height: height * 0.27 }],
        options: [{ left: width * 0.44, top: height * 0.015, width: width * 0.13, height: height * 0.17 }],
        sort: [{ left: width * 0.905, top: height * 0.755, width: width * 0.07, height: height * 0.17 }],
    };
    return landscapeRects[target];
}

function getCardPosition(position: OnboardingStep['cardPosition'], height: number, width: number) {
    const margin = Math.max(14, Math.min(28, height * 0.035));
    if (position === 'top') return { top: margin };
    if (position === 'bottom') return { bottom: margin };
    if (position === 'left') return { left: margin, top: height * 0.36, maxWidth: Math.min(330, width * 0.23) };
    return { top: '50%', transform: [{ translateY: -150 }] };
}

function SpotlightMask({ rects, width, height }: { rects: SpotlightRect[]; width: number; height: number }) {
    const [first, second] = rects;
    if (second) {
        return <View pointerEvents="none" style={styles.maskLayer}>
            <View style={[styles.mask, { left: 0, top: 0, width, height: first.top }]} />
            <View style={[styles.mask, { left: 0, top: first.top, width: first.left, height: first.height }]} />
            <View style={[styles.mask, { left: first.left + first.width, top: first.top, width: second.left - first.left - first.width, height: first.height }]} />
            <View style={[styles.mask, { left: second.left + second.width, top: first.top, width: width - second.left - second.width, height: first.height }]} />
            <View style={[styles.mask, { left: 0, top: first.top + first.height, width, height: height - first.top - first.height }]} />
        </View>;
    }
    return <View pointerEvents="none" style={styles.maskLayer}>
        <View style={[styles.mask, { left: 0, top: 0, width, height: first.top }]} />
        <View style={[styles.mask, { left: 0, top: first.top, width: first.left, height: first.height }]} />
        <View style={[styles.mask, { left: first.left + first.width, top: first.top, width: width - first.left - first.width, height: first.height }]} />
        <View style={[styles.mask, { left: 0, top: first.top + first.height, width, height: height - first.top - first.height }]} />
    </View>;
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 10000,
    },
    fullMask: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.72)' },
    maskLayer: { ...StyleSheet.absoluteFillObject },
    mask: { position: 'absolute', backgroundColor: 'rgba(0, 0, 0, 0.72)' },
    spotlightBorder: { position: 'absolute', borderWidth: 3, borderColor: '#FFD700', borderRadius: 22, backgroundColor: 'rgba(255, 215, 0, 0.08)', shadowColor: '#FFD700', shadowOpacity: 0.85, shadowRadius: 18, elevation: 8 },
    card: {
        position: 'absolute',
        alignSelf: 'center',
        maxWidth: 480,
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.5)',
        alignItems: 'center',
        gap: 12,
    },
    introductionCard: { width: '92%', padding: 20, gap: 12 },
    compactCard: { width: '31%', minWidth: 230, padding: 13, gap: 7, borderRadius: 14 },
    stepRow: { width: '100%', alignItems: 'center', gap: 8 },
    stepText: { color: '#70D6FF', fontSize: 12, fontWeight: '900', letterSpacing: 0.9 },
    dots: { flexDirection: 'row', gap: 5 },
    dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.22)' },
    dotActive: { backgroundColor: '#FFD700' },
    iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,215,0,0.13)' },
    title: { color: '#FFF', fontSize: 22, fontWeight: '900', textAlign: 'center' },
    description: { color: 'rgba(255,255,255,0.86)', fontSize: 15, lineHeight: 21, textAlign: 'center' },
    compactDescription: { fontSize: 13, lineHeight: 17 },
    compactStepText: { color: '#70D6FF', fontSize: 11, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
    actions: { width: '100%', minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
    previousButton: { minHeight: 44, borderRadius: 13, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
    previousText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
    nextButton: { minHeight: 44, borderRadius: 13, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFD700' },
    nextText: { color: '#1A0E2E', fontSize: 12, fontWeight: '900' },
    iconButton: { width: 38, minHeight: 38, paddingHorizontal: 0, borderRadius: 19 },
});
