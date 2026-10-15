import React, { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

type TrainingHubProps = {
    onLearnBasics: () => void;
    onUnderstandTable: () => void;
    onFreeGame: () => void;
    onPractice: () => void;
    onExpert: () => void;
};

type HubCard = {
    title: string;
    description: string;
    action: string;
    icon: keyof typeof Ionicons.glyphMap;
    colors: [string, string];
    premium?: boolean;
    onPress: () => void;
};

function AnimatedHubCard({ card, index }: { card: HubCard; index: number }) {
    const entrance = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(entrance, { toValue: 1, duration: 400, delay: 130 * index, useNativeDriver: true }).start();
    }, [entrance, index]);

    return (
        <Animated.View style={{ opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }] }}>
            <TouchableOpacity activeOpacity={0.9} onPress={card.onPress} style={styles.cardTouch}>
                <LinearGradient colors={card.colors} style={styles.card}>
                    <View style={styles.cardTop}>
                        <View style={styles.iconCircle}><Ionicons name={card.icon} size={25} color="#FFF" /></View>
                        {card.premium && <View style={styles.premiumBadge}><Ionicons name="star" size={10} color="#2A1648" /><Text style={styles.premiumText}>PREMIUM</Text></View>}
                    </View>
                    <Text style={styles.cardTitle}>{card.title}</Text>
                    <Text style={styles.cardDescription}>{card.description}</Text>
                    <View style={styles.cardAction}><Text style={styles.cardActionText}>{card.action}</Text><Ionicons name="arrow-forward" size={17} color="#FFF" /></View>
                </LinearGradient>
            </TouchableOpacity>
        </Animated.View>
    );
}

export function TrainingHub({ onLearnBasics, onUnderstandTable, onFreeGame, onPractice, onExpert }: TrainingHubProps) {
    const { width } = useWindowDimensions();
    const cardWidth = Math.min(248, Math.max(192, width * 0.61));
    const [visibleCard, setVisibleCard] = useState(0);
    const cards: HubCard[] = [
        { title: 'Apprendre les bases', description: 'Comprends les règles et lis les dominos pas à pas.', action: 'COMMENCER', icon: 'school-outline', colors: ['#1C9ED6', '#3154B2'], onPress: onLearnBasics },
        { title: 'Comprendre une table', description: 'Repère les joueurs, le plateau et ta main avant ta première partie.', action: 'DÉCOUVRIR', icon: 'map-outline', colors: ['#00BDA4', '#087A75'], onPress: onUnderstandTable },
        { title: 'Faire une partie gratuite', description: 'Joue une manche guidée contre des bots, sans pression.', action: 'JOUER', icon: 'play-circle-outline', colors: ['#F2A51A', '#D85B13'], onPress: onFreeGame },
        { title: "S'entraîner", description: 'Maîtrise les sorties, les doubles et les relais avec Mapipi.', action: 'S’ENTRAÎNER', icon: 'fitness-outline', colors: ['#A748E4', '#5C2DA6'], premium: true, onPress: onPractice },
        { title: 'Devenir expert', description: 'Anticipe, lis les passages et contrôle la table avec Gran-Moun.', action: 'DEVENIR EXPERT', icon: 'trophy-outline', colors: ['#F04791', '#A81D67'], premium: true, onPress: onExpert },
    ];

    return (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.hero}>
                <Text style={styles.title}>Apprends, joue et progresse.</Text>
                <Text style={styles.promise}>Progresse à ton rythme.</Text>
            </View>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cards}
                scrollEventThrottle={16}
                onScroll={({ nativeEvent }) => {
                    const index = Math.max(0, Math.min(cards.length - 1, Math.round(nativeEvent.contentOffset.x / (cardWidth + 12))));
                    setVisibleCard(current => current === index ? current : index);
                }}
            >
                {cards.map((card, index) => <View key={card.title} style={{ width: cardWidth }}><AnimatedHubCard card={card} index={index} /></View>)}
            </ScrollView>
            <View style={styles.carouselHint}>
                <View style={styles.dots}>
                    {cards.map((card, index) => <View key={card.title} style={[styles.dot, index === visibleCard && styles.activeDot]} />)}
                </View>
                <Text style={styles.hintText}>{visibleCard + 1}/{cards.length} · Fais glisser pour découvrir la suite</Text>
                <Ionicons name="arrow-forward" size={15} color="#FFD700" />
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    content: { paddingVertical: 12, paddingBottom: 22 },
    hero: { alignItems: 'center', paddingHorizontal: 18, paddingTop: 4, paddingBottom: 14 },
    title: { color: '#FFD700', fontSize: 24, fontWeight: '900', lineHeight: 29, textAlign: 'center', textShadowColor: 'rgba(255, 190, 0, 0.82)', textShadowRadius: 12 },
    promise: { marginTop: 3, color: 'rgba(255,255,255,0.72)', fontSize: 12, textAlign: 'center' },
    cards: { gap: 12, paddingHorizontal: 18, paddingRight: 36 },
    carouselHint: { marginTop: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18 },
    dots: { flexDirection: 'row', gap: 5 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.30)' },
    activeDot: { width: 18, backgroundColor: '#FFD700' },
    hintText: { color: 'rgba(255,255,255,0.70)', fontSize: 11, fontWeight: '700' },
    cardTouch: { borderRadius: 20 },
    card: { height: 195, padding: 16, borderRadius: 20, overflow: 'hidden' },
    cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    iconCircle: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.15)' },
    premiumBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12, backgroundColor: '#FFD700' },
    premiumText: { color: '#2A1648', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
    cardTitle: { marginTop: 10, color: '#FFF', fontSize: 20, fontWeight: '900' },
    cardDescription: { marginTop: 4, color: 'rgba(255,255,255,0.85)', fontSize: 12, lineHeight: 17 },
    cardAction: { marginTop: 'auto', paddingTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
    cardActionText: { color: '#FFF', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
});
