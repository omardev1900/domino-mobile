import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const benefits = [
    { title: 'Skins Premiums', icon: 'color-palette' as const, color: '#E6ABFF' },
    { title: 'Entraînement avancé', icon: 'school' as const, color: '#82D9B2' },
    { title: 'Stratégie', icon: 'bulb' as const, color: '#FFCE70' },
    { title: 'Pas de pub', icon: 'shield-checkmark' as const, color: '#87D5FF' },
    { title: 'Gains doubles', icon: 'wallet' as const, color: '#FFD86D' },
    { title: 'Replay de matchs', icon: 'play-circle' as const, color: '#FF9D9D' },
];

export function PremiumBenefitsCarousel({ width }: { width: number }) {
    const [index, setIndex] = useState(0);
    const opacity = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        const interval = setInterval(() => {
            Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(({ finished }) => {
                if (!finished) return;
                setIndex(current => (current + 1) % benefits.length);
                Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }).start();
            });
        }, 3000);
        return () => { clearInterval(interval); opacity.stopAnimation(); };
    }, [opacity]);
    const benefit = benefits[index];
    return <LinearGradient colors={['#5A327C', '#28183F']} style={[styles.card, { width }]}>
        <Text style={styles.heading}>LES AVANTAGES</Text>
        <Animated.View style={[styles.benefit, { opacity }]} accessibilityLiveRegion="polite">
            <View style={[styles.icon, { backgroundColor: `${benefit.color}26` }]}><Ionicons name={benefit.icon} size={26} color={benefit.color} /></View>
            <Text style={styles.title}>{benefit.title}</Text>
        </Animated.View>
        <View style={styles.dots}>{benefits.map((item, i) => <View key={item.title} style={[styles.dot, i === index && { backgroundColor: benefit.color, width: 14 }]} />)}</View>
    </LinearGradient>;
}

const styles = StyleSheet.create({
    card: { height: 132, borderRadius: 20, padding: 15, justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(255,215,0,0.45)' },
    heading: { color: '#FFD875', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
    benefit: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    icon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    title: { flex: 1, color: '#FFF', fontSize: 17, fontWeight: '900' },
    dots: { flexDirection: 'row', gap: 5 },
    dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
});
