import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInRight } from 'react-native-reanimated';

interface Props {
    title: string;
    description: string;
    icon: string;
    colors: string[];
    onBack: () => void;
    actionLabel?: string;
    onActionPress?: () => void;
    actionCost?: number;
}

export const SelectedModeHeader = ({ 
    title, 
    description, 
    icon, 
    colors, 
    onBack,
    actionLabel = "C'EST PARTI",
    onActionPress,
    actionCost
}: Props) => {
    const gradientColors = colors.length >= 2 ? colors : [colors[0], colors[0]];

    return (
        <Animated.View entering={FadeInRight.duration(400)} style={styles.container}>
            <LinearGradient
                colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.glassBorder}
            >
                <View style={styles.content}>
                    {/* Back Arrow + Icon */}
                    <View style={styles.leftGroup}>
                        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                            <Ionicons name="chevron-back" size={24} color="rgba(255,255,255,0.6)" />
                        </TouchableOpacity>
                        
                        <View style={styles.iconContainer}>
                            <LinearGradient 
                                colors={gradientColors as [string, string, ...string[]]} 
                                style={styles.iconGlow}
                            >
                                <Text style={styles.iconText}>{icon}</Text>
                            </LinearGradient>
                        </View>
                    </View>
                    
                    {/* Middle Text Info */}
                    <View style={styles.textContainer}>
                        <Text style={styles.title} numberOfLines={1}>{title}</Text>
                        <Text style={styles.description} numberOfLines={1}>{description}</Text>
                    </View>

                    {/* Right Action Button */}
                    {onActionPress && (
                        <TouchableOpacity onPress={onActionPress} style={styles.actionBtn}>
                            <LinearGradient
                                colors={['#FFD700', '#FFA500']}
                                style={styles.actionGradient}
                            >
                                <View style={styles.actionContent}>
                                    {actionCost !== undefined && (
                                        <>
                                            <View style={styles.costPart}>
                                                <Text style={styles.coinIcon}>🪙</Text>
                                                <Text style={styles.costText}>-{actionCost}</Text>
                                            </View>
                                            <View style={styles.divider} />
                                        </>
                                    )}
                                    <Text style={styles.actionLabel}>{actionLabel}</Text>
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    )}
                </View>
            </LinearGradient>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginBottom: 20,
        borderRadius: 24,
        overflow: 'hidden',
    },
    glassBorder: {
        padding: 1,
        borderRadius: 24,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: 'rgba(20, 10, 40, 0.7)',
        borderRadius: 23,
    },
    leftGroup: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backBtn: {
        padding: 4,
        marginRight: 8,
    },
    iconContainer: {
        marginRight: 12,
    },
    iconGlow: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    iconText: {
        fontSize: 22,
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center',
        marginRight: 10,
    },
    title: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    description: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 10,
        fontWeight: '600',
        marginTop: 1,
    },
    actionBtn: {
        height: 40,
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 5,
        shadowColor: '#FFA500',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    actionGradient: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 12,
    },
    actionContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    costPart: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    coinIcon: {
        fontSize: 12,
    },
    costText: {
        color: '#000',
        fontSize: 11,
        fontWeight: '900',
    },
    divider: {
        width: 1,
        height: 14,
        backgroundColor: 'rgba(0,0,0,0.15)',
    },
    actionLabel: {
        color: '#000',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.5,
    }
});
