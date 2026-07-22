import React, { useCallback, useEffect, useState } from 'react';
import { Platform, StyleProp, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type FullscreenDocument = Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
    webkitFullscreenElement?: Element | null;
};

type FullscreenElement = HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
};

type WebFullscreenButtonProps = {
    style?: StyleProp<ViewStyle>;
    iconColor?: string;
    size?: number;
};

export function WebFullscreenButton({
    style,
    iconColor = '#FFD700',
    size = 20,
}: WebFullscreenButtonProps) {
    const [isSupported, setIsSupported] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        if (Platform.OS !== 'web') return;

        const doc = document as FullscreenDocument;
        const root = document.documentElement as FullscreenElement;
        const supported = !!(root.requestFullscreen || root.webkitRequestFullscreen);
        setIsSupported(supported);

        const handleChange = () => {
            setIsFullscreen(!!(doc.fullscreenElement || doc.webkitFullscreenElement));
        };

        document.addEventListener('fullscreenchange', handleChange);
        document.addEventListener('webkitfullscreenchange', handleChange as EventListener);
        handleChange();

        return () => {
            document.removeEventListener('fullscreenchange', handleChange);
            document.removeEventListener('webkitfullscreenchange', handleChange as EventListener);
        };
    }, []);

    const toggleFullscreen = useCallback(async () => {
        if (Platform.OS !== 'web') return;

        const doc = document as FullscreenDocument;
        const root = document.documentElement as FullscreenElement;
        const activeElement = doc.fullscreenElement || doc.webkitFullscreenElement;

        try {
            if (!activeElement) {
                if (root.requestFullscreen) {
                    await root.requestFullscreen();
                } else if (root.webkitRequestFullscreen) {
                    await root.webkitRequestFullscreen();
                }
            } else if (doc.exitFullscreen) {
                await doc.exitFullscreen();
            } else if (doc.webkitExitFullscreen) {
                await doc.webkitExitFullscreen();
            }
        } catch (error) {
            console.warn('Fullscreen toggle failed:', error);
        }
    }, []);

    if (Platform.OS !== 'web' || !isSupported) return null;

    return (
        <TouchableOpacity
            style={[styles.button, style]}
            onPress={toggleFullscreen}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={isFullscreen ? 'Quitter le plein écran' : 'Passer en plein écran'}
        >
            <Ionicons
                name={isFullscreen ? 'contract-outline' : 'expand-outline'}
                size={size}
                color={iconColor}
            />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderWidth: 1.5,
        borderColor: 'rgba(255,215,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
