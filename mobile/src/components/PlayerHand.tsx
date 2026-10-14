
import React, { useMemo } from 'react';
import { StyleSheet, ScrollView, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Domino, DominoSide } from '../core/types';
import { DominoTile } from './DominoTile';
import { checkValidMove } from '../core/LogicEngine';
import { SkinConfig } from '../core/store.types';

export type HandSortMode = 'AUTO' | 'DOUBLES' | 'SUM' | 'MANUAL';

const DRAG_ACTIVATION_DISTANCE = 6;

export const orderHand = (
    hand: Domino[],
    sortMode: HandSortMode,
    manualOrderIds: string[] = [],
): Domino[] => {
    const withMeta = hand.map((domino, index) => ({
        domino,
        index,
        sum: domino.left + domino.right,
    }));

    if (sortMode === 'MANUAL') {
        const byId = new Map(hand.map(domino => [domino.id, domino]));
        const manuallyOrdered = manualOrderIds
            .map(id => byId.get(id))
            .filter((domino): domino is Domino => domino !== undefined);
        const knownIds = new Set(manuallyOrdered.map(domino => domino.id));

        return [
            ...manuallyOrdered,
            ...hand.filter(domino => !knownIds.has(domino.id)),
        ];
    }

    const byOriginalIndex = (a: typeof withMeta[number], b: typeof withMeta[number]) => a.index - b.index;
    const bySumDesc = (a: typeof withMeta[number], b: typeof withMeta[number]) => {
        if (b.sum !== a.sum) return b.sum - a.sum;
        if (Number(b.domino.isDouble) !== Number(a.domino.isDouble)) {
            return Number(b.domino.isDouble) - Number(a.domino.isDouble);
        }
        return byOriginalIndex(a, b);
    };

    const sorted = [...withMeta].sort((a, b) => {
        if (sortMode === 'SUM') return bySumDesc(a, b);

        if (a.domino.isDouble !== b.domino.isDouble) {
            return a.domino.isDouble ? -1 : 1;
        }

        return sortMode === 'AUTO' ? bySumDesc(a, b) : byOriginalIndex(a, b);
    });

    return sorted.map(({ domino }) => domino);
};

interface PlayerHandProps {
    hand: Domino[];
    onPlayDomino: (domino: Domino, position?: { x: number, y: number }) => void;
    disabled?: boolean;
    leftValue?: DominoSide | null;
    rightValue?: DominoSide | null;
    isLocked?: boolean;
    forcedPlayableDominoId?: string | null;
    skinConfig?: SkinConfig; // Cosmetic skin configuration
    sortMode?: HandSortMode;
    manualOrderIds?: string[];
    onManualOrderChange?: (orderedIds: string[]) => void;
    allowManualReorder?: boolean;
    hiddenDominoId?: string | null;
    preservePlayableHighlights?: boolean;
    preservedPlayableDominoIds?: string[];
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
    hand,
    onPlayDomino,
    disabled = false,
    leftValue = null,
    rightValue = null,
    isLocked = false,
    forcedPlayableDominoId = null,
    skinConfig,
    sortMode = 'AUTO',
    manualOrderIds = [],
    onManualOrderChange,
    allowManualReorder = false,
    hiddenDominoId = null,
    preservePlayableHighlights = false,
    preservedPlayableDominoIds = [],
}) => {
    const tileRefs = React.useRef<{ [key: string]: View | null }>({});
    const pressedDominoIdRef = React.useRef<string | null>(null);
    const draggedDominoIdRef = React.useRef<string | null>(null);
    const [draggedDomino, setDraggedDomino] = React.useState<{ id: string; translationX: number } | null>(null);
    
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const isCompact = width < 430;
    const dominoSize = isCompact ? 32 : 38;
    const gapSize = isCompact ? 4 : 10;
    const paddingLeftAmount = isCompact ? Math.max(insets.left + 80, 20) : 20;

    React.useEffect(() => {
        pressedDominoIdRef.current = null;
    }, [hand]);

    const sortedHand = useMemo(
        () => orderHand(hand, sortMode, manualOrderIds),
        [hand, manualOrderIds, sortMode],
    );

    const dominoStep = dominoSize + 8 + gapSize;

    const handleTilePress = (domino: Domino) => {
        if (draggedDominoIdRef.current === domino.id) {
            draggedDominoIdRef.current = null;
            return;
        }
        if (disabled) return;
        if (pressedDominoIdRef.current) return;
        pressedDominoIdRef.current = domino.id;

        const ref = tileRefs.current[domino.id];
        if (ref) {
            ref.measure((x, y, width, height, pageX, pageY) => {
                onPlayDomino(domino, { x: pageX, y: pageY });
            });
        } else {
            onPlayDomino(domino);
        }
    };

    const createManualReorderGesture = (domino: Domino, fromIndex: number) => Gesture.Pan()
        .enabled(allowManualReorder)
        .activeOffsetX([-DRAG_ACTIVATION_DISTANCE, DRAG_ACTIVATION_DISTANCE])
        .failOffsetY([-20, 20])
        // Les callbacks mettent à jour l'affichage React. Les exécuter côté JS
        // évite toute concurrence avec le tap qui joue un domino.
        .runOnJS(true)
        .onStart(() => {
                draggedDominoIdRef.current = domino.id;
                setDraggedDomino({ id: domino.id, translationX: 0 });
        })
        .onUpdate(event => {
            setDraggedDomino({ id: domino.id, translationX: event.translationX });
        })
        .onEnd(event => {
            const toIndex = Math.max(0, Math.min(
                sortedHand.length - 1,
                fromIndex + Math.round(event.translationX / dominoStep),
            ));
            if (toIndex !== fromIndex) {
                const nextOrder = [...sortedHand];
                const [movedDomino] = nextOrder.splice(fromIndex, 1);
                nextOrder.splice(toIndex, 0, movedDomino);
                onManualOrderChange?.(nextOrder.map(item => item.id));
            }
            setTimeout(() => {
                if (draggedDominoIdRef.current === domino.id) {
                    draggedDominoIdRef.current = null;
                }
            }, 0);
        })
        .onFinalize(() => {
            setDraggedDomino(null);
        });

    return (
        <View
            style={[styles.container]}
            pointerEvents="box-none"
        >
            <ScrollView
                horizontal
                scrollEnabled={!draggedDomino}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.scrollContent, { gap: gapSize, paddingLeft: paddingLeftAmount, paddingRight: Math.max(insets.right + 20, 20) }]}
                style={styles.scrollView}
                pointerEvents={isLocked && !allowManualReorder ? 'none' : 'auto'}
            >
                {sortedHand.map((domino, index) => {
                    const isVisuallyDisabled = disabled && !preservePlayableHighlights;
                    const canPlayByBoardRule = preservePlayableHighlights
                        ? preservedPlayableDominoIds.includes(domino.id)
                        : !isVisuallyDisabled && checkValidMove(domino, leftValue, rightValue).canPlay;
                    const canPlay = canPlayByBoardRule && (!forcedPlayableDominoId || domino.id === forcedPlayableDominoId);
                    const isHiddenDomino = hiddenDominoId === domino.id;
                    const isDragging = draggedDomino?.id === domino.id;
                    const reorderGesture = createManualReorderGesture(domino, index);
                    return (
                        // ✅ FIX B1: Le style d'élévation (translateY) est sur un plain View PARENT.
                        // L'Animated.View enfant gère uniquement l'animation d'entrée (FadeInDown).
                        // Avant ce fix, FadeInDown et translateY étaient sur le même Animated.View :
                        // FadeInDown remettait translateY à 0 pendant son animation, annulant l'élévation.
                        <GestureDetector key={domino.id} gesture={reorderGesture}>
                            <View
                                ref={(el) => (tileRefs.current[domino.id] = el as any)}
                                style={[
                                    !isDragging && (canPlay
                                        ? styles.tileElevated
                                        : disabled
                                            ? styles.tileDisabled
                                            // ✅ FIX B2: Pas de transform scale sur les tuiles non-jouables.
                                            // L'ancien scale(0.92) + translateY(-25) sur les tuiles voisines
                                            // créait le visuel "dominos qui se bousculent". Opacity seule = propre.
                                            : styles.tileNotPlayable),
                                    isDragging && [
                                        styles.tileDragging,
                                        {
                                            transform: [
                                                { translateY: canPlay ? -25 : 0 },
                                                { translateX: draggedDomino.translationX },
                                            ],
                                        },
                                    ],
                                    isHiddenDomino && styles.tileHidden,
                                ]}
                            >
                                <Animated.View
                                    entering={FadeInDown.springify().damping(12).stiffness(100).delay(index * 120)}
                                    // 🚨 RADICAL FIX: On retire 'layout' car il cause des mutations sur objets gelés en React 19
                                    style={styles.tileWrapper}
                                >
                                    <DominoTile
                                        left={domino.left}
                                        right={domino.right}
                                        size={dominoSize}
                                        orientation="vertical"
                                        onPress={() => handleTilePress(domino)}
                                        disabled={!canPlay || disabled}
                                        skinConfig={skinConfig}
                                        isPlayable={canPlay}
                                        disablePressScale
                                    />
                                </Animated.View>
                            </View>
                        </GestureDetector>
                    );
                })}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        height: 150, // Increased to account for larger domino size
        justifyContent: 'center',
        overflow: 'visible',
        zIndex: 10,
    },
    scrollView: {
        flex: 1,
        width: '100%',
        overflow: 'visible',
    },
    scrollContent: {
        alignItems: 'center',
        justifyContent: 'center',
        flexGrow: 1,
        paddingTop: 35, // ++ Increased: make room for elevated domino (-25px) without clipping
        paddingBottom: 10,
        overflow: 'visible',
    },
    tileWrapper: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
    },
    // ✅ B1 FIX: styles d'état sur le View parent (plain View, pas Animated.View)
    // pour ne pas interférer avec l'animation entering FadeInDown
    tileElevated: {
        transform: [{ translateY: -25 }],
        zIndex: 10,
        elevation: 15,
    },
    tileDisabled: {
        // Pas mon tour : tuiles visibles sans réduction d'opacité
        zIndex: 1,
        elevation: 3,
    },
    tileNotPlayable: {
        // ✅ A3 FIX: Mon tour, tuile non jouable — aucun grisage (opacity supprimée)
        // Le grisage gênait le joueur dans le choix de son domino (feedback client A3)
        zIndex: 1,
        elevation: 3,
    },
    tileHidden: {
        opacity: 0,
    },
    tileDragging: {
        zIndex: 30,
        elevation: 30,
        opacity: 0.88,
    },
});
