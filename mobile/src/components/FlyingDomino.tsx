import React, { useEffect, useRef } from 'react';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    runOnJS,
    interpolate,
    Easing
} from 'react-native-reanimated';
import { DominoTile } from './DominoTile';
import { FlyingDominoData } from '../core/animations/AnimationTypes';

import { SkinConfig } from '../core/store.types';

interface FlyingDominoProps {
    data: FlyingDominoData & { width?: number; height?: number };
    onFinished: () => void;
    skinConfig?: SkinConfig;
}

// Animation duration in ms — fast and snappy
const ANIMATION_DURATION = 400;

export const FlyingDomino: React.FC<FlyingDominoProps> = ({ data, onFinished, skinConfig }) => {
    const progress = useSharedValue(0);
    const finishedRef = useRef(false);
    const onFinishedRef = useRef(onFinished);
    const baseSize = data.baseSize ?? 34;

    useEffect(() => {
        onFinishedRef.current = onFinished;
    }, [onFinished]);

    useEffect(() => {
        const finishOnce = () => {
            if (finishedRef.current) return;
            finishedRef.current = true;
            onFinishedRef.current();
        };

        finishedRef.current = false;
        progress.value = 0;

        if (data.holdAtStart) {
            return;
        }

        const watchdog = setTimeout(finishOnce, ANIMATION_DURATION + 450);

        // If endPoint is not available (layout measurement failed, common on Web),
        // keep the fallback neutral and finish without a visual pop.
        if (!data.endPoint) {
            progress.value = withTiming(1, {
                duration: ANIMATION_DURATION,
                easing: Easing.out(Easing.back(1.5)),
            }, (finished) => {
                if (finished) runOnJS(finishOnce)();
            });
            return () => clearTimeout(watchdog);
        }

        progress.value = withTiming(1, {
            duration: ANIMATION_DURATION,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        }, (finished) => {
            if (finished) runOnJS(finishOnce)();
        });

        return () => clearTimeout(watchdog);
    }, [data, progress]);

    const animatedStyle = useAnimatedStyle(() => {
        if (data.holdAtStart) {
            return {
                position: 'absolute',
                left: 0,
                top: 0,
                transform: [
                    { translateX: data.startPoint.x },
                    { translateY: data.startPoint.y },
                ],
                opacity: 1,
                zIndex: 1000,
            };
        }

        if (!data.endPoint || !data.width || !data.height) {
            const opacity = interpolate(progress.value, [0, 0.1, 0.9, 1], [0, 1, 1, 0]);
            return {
                position: 'absolute',
                left: 0,
                top: 0,
                transform: [
                    { translateX: data.startPoint.x },
                    { translateY: data.startPoint.y },
                ],
                opacity,
                zIndex: 1000,
            };
        }

        const startCenterX = data.startPoint.x + baseSize / 2;
        const startCenterY = data.startPoint.y + baseSize;
        
        const endCenterX = data.endPoint.x + data.width / 2;
        const endCenterY = data.endPoint.y + data.height / 2;

        const currentCenterX = interpolate(progress.value, [0, 1], [startCenterX, endCenterX]);
        const currentCenterY = interpolate(progress.value, [0, 1], [startCenterY, endCenterY]);

        const isTargetHorizontal = data.orientation === 'horizontal';
        
        const naturalW = isTargetHorizontal ? baseSize * 2 : baseSize;
        const naturalH = isTargetHorizontal ? baseSize : baseSize * 2;

        const endScaleX = data.width / naturalW;
        const endScaleY = data.height / naturalH;

        const rotate = interpolate(progress.value, [0, 1], [isTargetHorizontal ? -90 : 0, 0]);
        const scaleX = interpolate(progress.value, [0, 1], [1, endScaleX]);
        const scaleY = interpolate(progress.value, [0, 1], [1, endScaleY]);

        return {
            position: 'absolute',
            left: -naturalW / 2,
            top: -naturalH / 2,
            transform: [
                { translateX: currentCenterX },
                { translateY: currentCenterY },
                { rotate: `${rotate}deg` },
                { scaleX },
                { scaleY }
            ],
            zIndex: 1000,
        };
    });

    return (
        <Animated.View style={animatedStyle} pointerEvents="none">
            <DominoTile
                left={data.visualLeft ?? data.domino.left}
                right={data.visualRight ?? data.domino.right}
                orientation={data.orientation}
                size={baseSize}
                noMargin
                skinConfig={skinConfig}
                animateOnMount={false}
            />
        </Animated.View>
    );
};
