import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import SoundManager from '../../core/audio/SoundManager';
import HapticManager from '../../core/audio/HapticManager';

export interface PremiumButtonProps extends Omit<PressableProps, 'style'> {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    disabled?: boolean;
    scaleDownTo?: number;
    soundName?: 'clack1' | 'notify';
    disableFeedback?: boolean; // Si on veut ponctuellement désactiver le son/haptic
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const PremiumButton: React.FC<PremiumButtonProps> = ({
    children,
    style,
    onPress,
    onPressIn,
    onPressOut,
    disabled = false,
    scaleDownTo = 0.95,
    soundName = 'clack1',
    disableFeedback = false,
    ...rest
}) => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
            opacity: disabled ? 0.5 : 1,
        };
    });

    const handlePressIn = (e: any) => {
        if (!disabled) {
            scale.value = withSpring(scaleDownTo, { damping: 15, stiffness: 300 });
            if (!disableFeedback) {
                // Feedback léger à l'appui
                HapticManager.triggerLightSelection();
                // SoundManager est appelé sur onPress pour ne pas couper en plein milieu
            }
        }
        if (onPressIn) onPressIn(e);
    };

    const handlePressOut = (e: any) => {
        if (!disabled) {
            scale.value = withSpring(1, { damping: 15, stiffness: 300 });
        }
        if (onPressOut) onPressOut(e);
    };

    const handlePress = (e: any) => {
        if (!disabled && !disableFeedback) {
            // Lecture du son au relachement complet (clic effectif)
            if (soundName === 'notify' || soundName === 'clack1') {
                SoundManager.playSound(soundName);
            }
        }
        if (onPress) onPress(e);
    };

    return (
        <AnimatedPressable
            {...rest}
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled}
            style={[animatedStyle, style]}
        >
            {children}
        </AnimatedPressable>
    );
};
