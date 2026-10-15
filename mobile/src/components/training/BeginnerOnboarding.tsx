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

type SpotlightTarget = 'table' | 'players' | 'playerDetail' | 'hands' | 'options' | 'sort' | 'chat';

type SpotlightRect = { left: number; top: number; width: number; height: number };

const GAME_STEPS: OnboardingStep[] = [
    {
        title: 'Bienvenue dans ta partie gratuite',
        description: 'Joue une manche contre des bots pour t’entraîner. Prends ton temps : elle ne modifie ni tes statistiques ni tes récompenses.',
        icon: 'play-circle-outline',
        cardPosition: 'center',
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

const TABLE_STEPS: OnboardingStep[] = [
    {
        title: 'Bienvenue à la table',
        description: 'Découvre les éléments d’une vraie partie multijoueur avant de te lancer.',
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
        title: 'Lire un joueur',
        description: 'Chaque joueur affiche son score pour la manche et le nombre de dominos restant dans sa main. Ses dominos, eux, restent toujours cachés.',
        icon: 'person-circle-outline',
        spotlight: 'playerDetail',
        cardPosition: 'bottom',
    },
    {
        title: 'Les mains',
        description: 'Tes dominos sont visibles en bas. Les dominos des adversaires restent cachés : leurs rectangles indiquent seulement combien il leur en reste.',
        icon: 'apps-outline',
        spotlight: 'hands',
        cardPosition: 'top',
    },
    {
        title: 'Trier ta main',
        description: 'Le bouton de tri classe tes dominos par ordre automatique, doubles ou somme. Choisis l’ordre qui te permet de repérer un coup plus vite.',
        icon: 'swap-horizontal-outline',
        spotlight: 'sort',
        cardPosition: 'top',
    },
    {
        title: 'Déplacer ses dominos',
        description: 'Tu peux aussi réorganiser ta main à tout moment : fais glisser un domino à l’endroit souhaité, même pendant le tour des autres joueurs.',
        icon: 'move-outline',
        spotlight: 'hands',
        cardPosition: 'top',
    },
    {
        title: 'Le chat rapide',
        description: 'En multijoueur, cette icône ouvre le chat rapide pour envoyer des messages et des émoticônes. Elle n’apparaît pas en solo.',
        icon: 'chatbubble-ellipses-outline',
        spotlight: 'chat',
        cardPosition: 'left',
    },
    {
        title: 'La table est prête',
        description: 'Tu as vu les points essentiels. Tu peux maintenant commencer à jouer ou t’entraîner dans une partie gratuite.',
        icon: 'checkmark-circle-outline',
        cardPosition: 'center',
    },
];

type BeginnerOnboardingProps = {
    variant?: 'basics' | 'table';
    onComplete: () => void;
};

export function BeginnerOnboarding({ variant = 'basics', onComplete }: BeginnerOnboardingProps) {
    const [stepIndex, setStepIndex] = useState(0);
    const [showTablePreview, setShowTablePreview] = useState(false);
    const { width, height } = useWindowDimensions();
    const steps = variant === 'table' ? TABLE_STEPS : GAME_STEPS;
    const step = steps[stepIndex];
    const isLastStep = stepIndex === steps.length - 1;
    const spotlights = step.spotlight ? getSpotlightRects(step.spotlight, width, height) : undefined;
    const isIntroduction = stepIndex === 0;

    const advance = () => {
        if (variant === 'table' && stepIndex === 0) {
            setShowTablePreview(true);
            return;
        }
        if (isLastStep) {
            onComplete();
            return;
        }
        setStepIndex(index => index + 1);
    };

    return (
        <View style={styles.backdrop}>
            {showTablePreview ? <TouchableOpacity style={styles.beginButton} onPress={() => { setShowTablePreview(false); setStepIndex(1); }} accessibilityLabel="Commencer la visite de la table"><Text style={styles.beginButtonText}>COMMENCER</Text><Ionicons name="arrow-forward" size={16} color="#1A0E2E" /></TouchableOpacity> : <>
            {spotlights ? <SpotlightMask rects={spotlights} width={width} height={height} /> : <View style={styles.fullMask} />}
            {spotlights?.map((spotlight, index) => <View key={index} pointerEvents="none" style={[styles.spotlightBorder, spotlight]} />)}
            <LinearGradient colors={['rgba(7, 27, 51, 0.98)', 'rgba(26, 14, 46, 0.98)']} style={[styles.card, isIntroduction ? styles.introductionCard : styles.compactCard, getCardPosition(step.cardPosition, height, width)]}>
                {isIntroduction ? <>
                    <View style={styles.stepRow}>
                        <Text style={styles.stepText}>PRISE EN MAIN · {stepIndex + 1}/{steps.length}</Text>
                        <View style={styles.dots}>
                            {steps.map((_, index) => <View key={index} style={[styles.dot, index <= stepIndex && styles.dotActive]} />)}
                        </View>
                    </View>
                    <View style={styles.iconCircle}>
                        <Ionicons name={step.icon!} size={42} color="#FFD700" />
                    </View>
                </> : <Text style={styles.compactStepText}>{stepIndex + 1}/{steps.length} · {step.title}</Text>}
                {isIntroduction && <Text style={styles.title}>{step.title}</Text>}
                <Text style={[styles.description, !isIntroduction && styles.compactDescription]}>{step.description}</Text>
                <View style={styles.actions}>
                    {stepIndex > 0 ? (
                        <TouchableOpacity accessibilityLabel="Étape précédente" style={[styles.previousButton, !isIntroduction && styles.iconButton]} onPress={() => setStepIndex(index => index - 1)}>
                            {isIntroduction ? <Text style={styles.previousText}>PRÉCÉDENT</Text> : <Ionicons name="arrow-back" size={19} color="#FFF" />}
                        </TouchableOpacity>
                    ) : <View />}
                    <TouchableOpacity accessibilityLabel={isLastStep ? 'Quitter la visite' : 'Étape suivante'} style={[styles.nextButton, !isIntroduction && !(isLastStep && variant === 'table') && styles.iconButton]} onPress={advance}>
                        {(isIntroduction || (isLastStep && variant === 'table')) && <Text style={styles.nextText}>{isLastStep && variant === 'table' ? 'QUITTER' : 'SUIVANT'}</Text>}
                        <Ionicons name={isLastStep && variant === 'table' ? 'close' : 'arrow-forward'} size={isIntroduction ? 18 : 20} color="#1A0E2E" />
                    </TouchableOpacity>
                </View>
            </LinearGradient></>}
        </View>
    );
}

function getSpotlightRects(target: SpotlightTarget, width: number, height: number): SpotlightRect[] {
    const landscape = width >= height;
    if (!landscape) {
        const portraitRects: Record<SpotlightTarget, SpotlightRect[]> = {
            table: [{ left: width * 0.08, top: height * 0.27, width: width * 0.84, height: height * 0.34 }],
            players: [{ left: width * 0.04, top: height * 0.08, width: width * 0.38, height: height * 0.22 }, { left: width * 0.58, top: height * 0.08, width: width * 0.38, height: height * 0.22 }],
            playerDetail: [{ left: width * 0.04, top: height * 0.08, width: width * 0.38, height: height * 0.105 }, { left: width * 0.04, top: height * 0.195, width: width * 0.38, height: height * 0.105 }],
            hands: [{ left: width * 0.05, top: height * 0.7, width: width * 0.9, height: height * 0.22 }],
            options: [{ left: width * 0.62, top: height * 0.03, width: width * 0.28, height: height * 0.1 }],
            sort: [{ left: width * 0.81, top: height * 0.71, width: width * 0.15, height: height * 0.16 }],
            chat: [{ left: width * 0.84, top: height * 0.84, width: width * 0.14, height: height * 0.12 }],
        };
        return portraitRects[target];
    }

    const landscapeRects: Record<SpotlightTarget, SpotlightRect[]> = {
        table: [{ left: width * 0.26, top: height * 0.25, width: width * 0.48, height: height * 0.42 }],
        players: [{ left: width * 0.018, top: height * 0.05, width: width * 0.19, height: height * 0.27 }, { left: width * 0.792, top: height * 0.05, width: width * 0.19, height: height * 0.27 }],
        playerDetail: [{ left: width * 0.018, top: height * 0.05, width: width * 0.19, height: height * 0.13 }, { left: width * 0.018, top: height * 0.19, width: width * 0.19, height: height * 0.13 }],
        hands: [{ left: width * 0.28, top: height * 0.7, width: width * 0.48, height: height * 0.27 }],
        options: [{ left: width * 0.44, top: height * 0.015, width: width * 0.13, height: height * 0.17 }],
        sort: [{ left: width * 0.905, top: height * 0.755, width: width * 0.07, height: height * 0.17 }],
        chat: [{ left: width * 0.84, top: height * 0.84, width: width * 0.07, height: height * 0.15 }],
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
    beginButton: { position: 'absolute', left: 16, top: '50%', minHeight: 38, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 12, backgroundColor: '#FFD700', shadowColor: '#FFD700', shadowOpacity: 0.7, shadowRadius: 12, elevation: 9 },
    beginButtonText: { color: '#1A0E2E', fontSize: 10, fontWeight: '900' },
});
