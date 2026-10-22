import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    LayoutChangeEvent,
    NativeSyntheticEvent,
    StyleSheet,
    Text,
    TextInput,
    View,
    ViewProps,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { hexToHsv, HsvColor, hsvToHex, normalizeHexColor } from './color.utils';

interface PremiumColorPickerProps {
    color: string;
    onChange: (color: string) => void;
}

type ResponderEvent = NativeSyntheticEvent<{
    locationX: number;
    locationY: number;
}>;

const HUE_COLORS = ['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000'] as const;

export function PremiumColorPicker({ color, onChange }: PremiumColorPickerProps) {
    const [hsv, setHsv] = useState<HsvColor>(() => hexToHsv(color));
    const [hexText, setHexText] = useState(color.toUpperCase());
    const [fieldSize, setFieldSize] = useState({ width: 1, height: 1 });
    const [hueWidth, setHueWidth] = useState(1);

    useEffect(() => {
        const normalized = normalizeHexColor(color);
        if (!normalized || normalized === hsvToHex(hsv)) return;
        setHsv(hexToHsv(normalized));
        setHexText(normalized);
    }, [color, hsv]);

    const emit = useCallback((next: HsvColor) => {
        const nextHex = hsvToHex(next);
        setHsv(next);
        setHexText(nextHex);
        onChange(nextHex);
    }, [onChange]);

    const updateSaturationValue = useCallback((event: ResponderEvent) => {
        emit({
            ...hsv,
            saturation: Math.min(1, Math.max(0, event.nativeEvent.locationX / fieldSize.width)),
            value: 1 - Math.min(1, Math.max(0, event.nativeEvent.locationY / fieldSize.height)),
        });
    }, [emit, fieldSize, hsv]);

    const updateHue = useCallback((event: ResponderEvent) => {
        emit({
            ...hsv,
            hue: Math.min(359.999, Math.max(0, event.nativeEvent.locationX / hueWidth) * 360),
        });
    }, [emit, hsv, hueWidth]);

    const saturationResponders = useMemo<ViewProps>(() => ({
        onStartShouldSetResponder: () => true,
        onMoveShouldSetResponder: () => true,
        onResponderGrant: updateSaturationValue,
        onResponderMove: updateSaturationValue,
    }), [updateSaturationValue]);

    const hueResponders = useMemo<ViewProps>(() => ({
        onStartShouldSetResponder: () => true,
        onMoveShouldSetResponder: () => true,
        onResponderGrant: updateHue,
        onResponderMove: updateHue,
    }), [updateHue]);

    const onFieldLayout = (event: LayoutChangeEvent) => setFieldSize(event.nativeEvent.layout);
    const onHueLayout = (event: LayoutChangeEvent) => setHueWidth(Math.max(1, event.nativeEvent.layout.width));
    const pureHue = hsvToHex({ hue: hsv.hue, saturation: 1, value: 1 });

    const commitHex = () => {
        const normalized = normalizeHexColor(hexText);
        if (!normalized) {
            setHexText(hsvToHex(hsv));
            return;
        }
        emit(hexToHsv(normalized));
    };

    return (
        <View style={styles.container}>
            <View
                {...saturationResponders}
                accessibilityLabel="Saturation et luminosité"
                accessibilityRole="adjustable"
                onLayout={onFieldLayout}
                style={[styles.colorField, { backgroundColor: pureHue }]}
            >
                <LinearGradient
                    colors={['#FFFFFF', 'rgba(255,255,255,0)']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={StyleSheet.absoluteFill}
                />
                <LinearGradient
                    colors={['rgba(0,0,0,0)', '#000000']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />
                <View
                    pointerEvents="none"
                    style={[
                        styles.colorThumb,
                        {
                            left: `${hsv.saturation * 100}%`,
                            top: `${(1 - hsv.value) * 100}%`,
                            backgroundColor: hsvToHex(hsv),
                        },
                    ]}
                />
            </View>

            <View style={styles.hueRow}>
                <Text style={styles.hueLabel}>Teinte</Text>
                <View
                    {...hueResponders}
                    accessibilityLabel="Teinte"
                    accessibilityRole="adjustable"
                    onLayout={onHueLayout}
                    style={styles.hueTrack}
                >
                    <LinearGradient
                        colors={HUE_COLORS}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={StyleSheet.absoluteFill}
                    />
                    <View pointerEvents="none" style={[styles.hueThumb, { left: `${(hsv.hue / 360) * 100}%` }]} />
                </View>
                <TextInput
                    accessibilityLabel="Couleur hexadécimale"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={7}
                    onBlur={commitHex}
                    onChangeText={setHexText}
                    onSubmitEditing={commitHex}
                    selectTextOnFocus
                    style={styles.hexInput}
                    value={hexText}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: 8 },
    colorField: { height: 76, borderRadius: 12, overflow: 'hidden' },
    colorThumb: {
        position: 'absolute', width: 20, height: 20, marginLeft: -10, marginTop: -10,
        borderRadius: 10, borderWidth: 3, borderColor: '#FFFFFF', elevation: 3,
        shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    },
    hueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    hueLabel: { color: 'rgba(255,255,255,0.68)', fontSize: 11, fontWeight: '700' },
    hueTrack: { flex: 1, height: 28, borderRadius: 9, overflow: 'hidden' },
    hueThumb: {
        position: 'absolute', width: 8, height: 32, top: -2, marginLeft: -4,
        borderRadius: 4, borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: 'rgba(0,0,0,0.15)',
    },
    hexInput: {
        width: 82, height: 34, borderRadius: 9, paddingHorizontal: 8,
        backgroundColor: 'rgba(255,255,255,0.1)', color: '#FFFFFF',
        fontSize: 11, fontWeight: '800', textAlign: 'center',
    },
});
