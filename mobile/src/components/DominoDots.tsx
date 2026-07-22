import React from 'react';
import { View, StyleSheet } from 'react-native';

type DotPosition = 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'middle-center' | 'middle-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

interface DominoDotsProps {
    value: number;
    size?: number;
    color?: string;
}

export const DominoDots: React.FC<DominoDotsProps> = ({ value, size = 40, color = '#333' }) => {
    const dotSize = size / 5;
    const padding = size / 10;

    const renderDot = (position: DotPosition) => {
        const style: any = {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: color,
            position: 'absolute',
        };

        switch (position) {
            case 'top-left': style.top = padding; style.left = padding; break;
            case 'top-center': style.top = padding; style.left = (size - dotSize) / 2; break;
            case 'top-right': style.top = padding; style.right = padding; break;
            case 'middle-left': style.top = (size - dotSize) / 2; style.left = padding; break;
            case 'middle-center': style.top = (size - dotSize) / 2; style.left = (size - dotSize) / 2; break;
            case 'middle-right': style.top = (size - dotSize) / 2; style.right = padding; break;
            case 'bottom-left': style.bottom = padding; style.left = padding; break;
            case 'bottom-center': style.bottom = padding; style.left = (size - dotSize) / 2; break;
            case 'bottom-right': style.bottom = padding; style.right = padding; break;
        }

        return <View key={position} style={style} />;
    };

    const getDots = () => {
        switch (value) {
            case 1: return [renderDot('middle-center')];
            case 2: return [renderDot('top-right'), renderDot('bottom-left')];
            case 3: return [renderDot('top-right'), renderDot('middle-center'), renderDot('bottom-left')];
            case 4: return [renderDot('top-left'), renderDot('top-right'), renderDot('bottom-left'), renderDot('bottom-right')];
            case 5: return [renderDot('top-left'), renderDot('top-right'), renderDot('middle-center'), renderDot('bottom-left'), renderDot('bottom-right')];
            case 6: return [renderDot('top-left'), renderDot('top-center'), renderDot('top-right'), renderDot('bottom-left'), renderDot('bottom-center'), renderDot('bottom-right')];
            default: return [];
        }
    };

    return (
        <View style={{ width: size, height: size, position: 'relative' }}>
            {getDots()}
        </View>
    );
};
