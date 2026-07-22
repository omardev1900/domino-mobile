import React from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TouchableWithoutFeedback,
    ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BotDifficulty } from '../core/services/bot.service';

interface BotOption {
    difficulty: BotDifficulty;
    name: string;
    emoji: string;
    description: string;
    gradient: readonly [string, string];
    badgeColor: string;
}

const BOT_OPTIONS: BotOption[] = [
    {
        difficulty: 'TI_MANMAY',
        name: 'Ti-Manmay',
        emoji: '🌱',
        description: 'Joue les coups évidents, idéal pour apprendre.',
        gradient: ['#388E3C', '#66BB6A'],
        badgeColor: '#66BB6A',
    },
    {
        difficulty: 'MAPIPI',
        name: 'Mapipi',
        emoji: '⚡',
        description: 'Stratège basique, cherche à bloquer.',
        gradient: ['#0288D1', '#26C6DA'],
        badgeColor: '#26C6DA',
    },
    {
        difficulty: 'GRAN_MOUN',
        name: 'Gran-Moun',
        emoji: '🔥',
        description: 'Difficile. Anticipe et compte les pièces.',
        gradient: ['#E65100', '#FF7043'],
        badgeColor: '#FF7043',
    },
    {
        difficulty: 'METKAYALI',
        name: 'Mèt Kayali',
        emoji: '🧠',
        description: 'IA avancée. Simule les coups adverses (Monte-Carlo).',
        gradient: ['#4A148C', '#8E24AA'],
        badgeColor: '#CE93D8',
    },
];

interface BotSelectionModalProps {
    visible: boolean;
    onClose: () => void;
    onSelectBot: (difficulty: BotDifficulty) => void;
}

export const BotSelectionModal: React.FC<BotSelectionModalProps> = ({
    visible,
    onClose,
    onSelectBot,
}) => {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <Animated.View entering={FadeInDown.duration(280).springify()} style={styles.container}>
                            {/* Header */}
                            <LinearGradient colors={['#2D1B4E', '#1A0E2E']} style={styles.header}>
                                <Text style={styles.title}>🤖 Choisir un Bot</Text>
                                <Text style={styles.subtitle}>Sélectionne le niveau de difficulté</Text>
                                <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}>
                                    <Ionicons name="close" size={20} color="rgba(255,255,255,0.6)" />
                                </TouchableOpacity>
                            </LinearGradient>

                            {/* Bot Options */}
                            <ScrollView style={styles.optionsList} contentContainerStyle={styles.optionsListContent} showsVerticalScrollIndicator={false}>
                                {BOT_OPTIONS.map((option, index) => (
                                    <Animated.View
                                        key={option.difficulty}
                                        entering={FadeIn.delay(index * 60)}
                                        style={styles.optionWrapper}
                                    >
                                        <TouchableOpacity
                                            style={styles.optionRow}
                                            onPress={() => {
                                                onSelectBot(option.difficulty);
                                                onClose();
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <LinearGradient
                                                colors={option.gradient}
                                                style={styles.emojiContainer}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 1 }}
                                            >
                                                <Text style={styles.optionEmoji}>{option.emoji}</Text>
                                            </LinearGradient>
                                            <View style={styles.optionText}>
                                                <View style={styles.optionNameRow}>
                                                    <Text style={styles.optionName}>{option.name}</Text>
                                                    {option.difficulty === 'METKAYALI' && (
                                                        <View style={[styles.badge, { backgroundColor: option.badgeColor }]}>
                                                            <Text style={styles.badgeText}>IA+</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <Text style={styles.optionDescription}>{option.description}</Text>
                                            </View>
                                            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
                                        </TouchableOpacity>
                                    </Animated.View>
                                ))}
                            </ScrollView>
                        </Animated.View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    container: {
        width: '95%',
        maxWidth: 580,
        backgroundColor: '#1E1340',
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.2)',
        elevation: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
    },
    header: {
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        color: '#FFD700',
        letterSpacing: 0.5,
        paddingRight: 36,
    },
    subtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 2,
    },
    closeButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    optionsList: {
        // La hauteur n'est plus limitée, la grille 2x2 prend moins de place en hauteur
    },
    optionsListContent: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        padding: 12,
        gap: 8,
    },
    optionWrapper: {
        width: '49%', // Un peu moins de la moitié pour laisser la place au gap
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 12,
        padding: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        gap: 10,
        minHeight: 76,
    },
    emojiContainer: {
        width: 38,
        height: 38,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    optionEmoji: {
        fontSize: 20,
    },
    optionText: {
        flex: 1,
    },
    optionNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    optionName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFF',
    },
    badge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    badgeText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#1A0E2E',
        letterSpacing: 0.5,
    },
    optionDescription: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.45)',
        marginTop: 2,
    },
});
