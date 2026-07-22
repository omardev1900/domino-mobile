import React, { useMemo, useEffect } from 'react';
import { View, StyleSheet, ScrollView, useWindowDimensions, TouchableOpacity } from 'react-native';
import Animated, {
    useAnimatedStyle, useSharedValue,
    ZoomIn, withRepeat, withTiming, withSequence
} from 'react-native-reanimated';
import { GameState, Domino, DominoSide } from '../core/types';
import { DominoTile } from './DominoTile';
import { Ionicons } from '@expo/vector-icons';
import { TableTheme } from '../core/themes/tableThemes';
import { getValidMoves, ValidMove } from '../core/DominoEngine';
import { SkinConfig } from '../core/store.types';

// ═══════════════════════════════════════════════════════════════════════════
//  GRID CONSTANTS — Never change with screen size. Only 'scale' adapts.
// ═══════════════════════════════════════════════════════════════════════════
const T = 42;                 // base unit (half-tile)
const H_W = T * 2;            // horizontal tile width (84)
const H_H = T;                // horizontal tile height (42)
const V_W = T;                // vertical tile width (42)
const V_H = T * 2;            // vertical tile height (84)
const GAP = 1;                // tiny visual breathing without visible empty gap
const ROW_GAP = 30;           // ++ Reduced gap to avoid vertical bloating
const CELL = H_W + GAP;       // one grid cell advance (88)
const ROW_STEP = V_H + ROW_GAP; // vertical step between rows (134)

// ═══════════════════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════════════════
interface PlacedTile {
    domino: Domino;
    isReversed: boolean;
    visualFlip?: boolean;
    x: number;   // left edge in natural coords (anchor = 0,0)
    y: number;   // top edge in natural coords
    orientation: 'horizontal' | 'vertical';
    width: number;
    height: number;
}

export interface GameTableRef {
    measureTile: (id: string, cb: (x: number, y: number, w: number, h: number, meta?: {
        orientation: 'horizontal' | 'vertical';
        isReversed: boolean;
        visualLeft: DominoSide;
        visualRight: DominoSide;
    }) => void) => void;
}

interface GameTableProps {
    gameState: GameState;
    theme?: TableTheme;
    pendingDomino?: Domino | null;
    onSideSelect?: (side: 'left' | 'right') => void;
    skinConfig?: SkinConfig; // Cosmetic skin configuration
    hiddenDominoId?: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
//  BIDIRECTIONAL LAYOUT — Anchor-centered, ZiMAD style
//
//  The first domino is the ANCHOR at (0, 0).
//
//  RIGHT side: tiles grow to +X.  At row limit → corner DOWN → new row ←
//  LEFT side:  tiles grow to -X.  At row limit → corner UP   → new row →
//
//  Positions are in a coordinate system centered on the anchor.
//  We then compute the bounding box and translate everything to positive
//  coordinates for rendering.
// ═══════════════════════════════════════════════════════════════════════════

function computeBidirectionalLayout(
    sequence: GameState['table']['sequence'], 
    tilesPerRow: number
): {
    tiles: PlacedTile[];
    bounds: { minX: number; minY: number; maxX: number; maxY: number };
} {
    if (sequence.length === 0) {
        return { tiles: [], bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 } };
    }

    const allTiles: PlacedTile[] = [];

    // ── FIND THE ANCHOR ──────────────────────────────────────────────────
    // The sequence is: [leftN, ..., left1, ANCHOR(sideAtTable='left'), right1, ..., rightM]
    // Left plays are unshifted (prepended), so sequence[0] is the MOST RECENT left play.
    // The anchor is the LAST item with sideAtTable='left' (right before the first 'right' item).
    let anchorIndex = sequence.length - 1; // default: all 'left', anchor is last
    for (let i = 0; i < sequence.length; i++) {
        if (sequence[i].sideAtTable === 'right') {
            anchorIndex = i - 1;
            break;
        }
    }

    const anchorItem = sequence[anchorIndex];

    // ── ANCHOR TILE ──────────────────────────────────────────────────────
    const anchorIsDouble = anchorItem.domino.isDouble;
    const anchorW = anchorIsDouble ? V_W : H_W;
    const anchorH = anchorIsDouble ? V_H : H_H;
    const anchorX = -anchorW / 2;
    const anchorY = -anchorH / 2;

    allTiles.push({
        domino: anchorItem.domino,
        isReversed: anchorItem.isReversed,
        x: anchorX,
        y: anchorY,
        orientation: anchorIsDouble ? 'vertical' : 'horizontal',
        width: anchorW,
        height: anchorH,
    });

    // ── Build left & right chains ────────────────────────────────────────
    // Left chain: sequence[0..anchorIndex-1], REVERSED so closest-to-anchor is first
    const leftChain: typeof sequence = [];
    for (let i = anchorIndex - 1; i >= 0; i--) {
        leftChain.push(sequence[i]);
    }
    // Right chain: sequence[anchorIndex+1..end], already in correct order
    const rightChain: typeof sequence = [];
    for (let i = anchorIndex + 1; i < sequence.length; i++) {
        rightChain.push(sequence[i]);
    }

    // ── Helper: lay tiles in one direction ───────────────────────────────
    // dir: initial horizontal direction (1 = right, -1 = left)
    // verticalGrowth: 1 = DOWN (for right side), -1 = UP (for left side)
    function layChain(
        chain: typeof sequence,
        dir: 1 | -1,
        verticalGrowth: 1 | -1,
        startCursorX: number,
        rowCenterY: number,
        isLeftChain: boolean
    ): PlacedTile[] {
        const tiles: PlacedTile[] = [];
        const CORNER_JOIN_GAP = 1; // Slight breathing space at corner joins.
        let cursor = startCursorX;   // left-edge (dir=1) or right-edge (dir=-1)
        let curY = rowCenterY;       // center Y of current row
        let rowCount = 0;
        let currentDir = dir;
        let justPlacedCorner = false;
        let lastCornerTop = 0;
        let lastCornerBottom = 0;

        for (let i = 0; i < chain.length; i++) {
            const item = chain[i];
            const isDouble = item.domino.isDouble;

            if (rowCount >= tilesPerRow && i < chain.length - 1) {
                // ── CORNER TILE ──────────────────────────────────────────
                const cW = V_W;
                const cH = V_H;
                const edgeX = currentDir === 1 ? cursor - GAP : cursor + GAP;
                // Align corner with the first tile of the next row (not centered on edge axis).
                const cLeft = currentDir === 1 ? edgeX - cW : edgeX;
                const cTop = verticalGrowth === 1
                    ? curY + H_H / 2
                    : curY - H_H / 2 - cH;

                tiles.push({
                    domino: item.domino,
                    isReversed: item.isReversed,
                    x: cLeft,
                    y: cTop,
                    orientation: 'vertical',
                    width: cW,
                    height: cH,
                });
                justPlacedCorner = true;
                lastCornerTop = cTop;
                lastCornerBottom = cTop + cH;

                // Move to next row: stick the corner to the first tile of the new row.
                curY += (V_H + H_H) * verticalGrowth;
                currentDir = currentDir === 1 ? -1 : 1;
                cursor = edgeX;
                rowCount = 0;
                continue;
            }

            // ── NORMAL TILE ──────────────────────────────────────────────
            const tW = isDouble ? V_W : H_W;
            const tH = isDouble ? V_H : H_H;
            const tLeft = currentDir === 1 ? cursor : cursor - tW;
            let tTop = curY - tH / 2;
            if (justPlacedCorner && rowCount === 0) {
                tTop = verticalGrowth === 1
                    ? lastCornerBottom + CORNER_JOIN_GAP
                    : lastCornerTop - tH - CORNER_JOIN_GAP;
                // Re-anchor row center on the first tile after the corner.
                curY = tTop + tH / 2;
                justPlacedCorner = false;
            }

            const visualFlip = isLeftChain ? currentDir === 1 : currentDir === -1;

            // DO NOT flip isReversed logiquement — the engine already computes it correctly
            // for the logic sequence. We use visualFlip to twist the tile display only.
            tiles.push({
                domino: item.domino,
                isReversed: item.isReversed,
                visualFlip: !isDouble ? visualFlip : false,
                x: tLeft,
                y: tTop,
                orientation: isDouble ? 'vertical' : 'horizontal',
                width: tW,
                height: tH,
            });

            cursor = currentDir === 1 ? tLeft + tW + GAP : tLeft - GAP;
            rowCount++;
        }
        return tiles;
    }

    // ── RIGHT CHAIN: starts right of anchor, wraps DOWN ──────────────────
    const rightStart = anchorX + anchorW + GAP;
    const rightTiles = layChain(rightChain, 1, 1, rightStart, 0, false);

    // ── LEFT CHAIN: starts left of anchor, wraps UP ──────────────────────
    const leftStart = anchorX - GAP;
    const leftTiles = layChain(leftChain, -1, -1, leftStart, 0, true);


    allTiles.push(...rightTiles, ...leftTiles);

    // ── Compute bounding box ─────────────────────────────────────────────
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const t of allTiles) {
        minX = Math.min(minX, t.x);
        minY = Math.min(minY, t.y);
        maxX = Math.max(maxX, t.x + t.width);
        maxY = Math.max(maxY, t.y + t.height);
    }

    // ── Add small padding to bounds for shadows ─────────────────────────
    const P = 2;
    return { tiles: allTiles, bounds: { minX: minX - P, minY: minY - P, maxX: maxX + P, maxY: maxY + P } };
}

// ═══════════════════════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export const GameTable = React.forwardRef<GameTableRef, GameTableProps>((
    { gameState, pendingDomino, onSideSelect, skinConfig, hiddenDominoId },
    ref
) => {
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const isLandscape = screenWidth > screenHeight;
    const pulse = useSharedValue(1);
    const tileRefs = React.useRef<{ [key: string]: View | null }>({});

    // Valid-move arrows
    const showLeftArrow = useMemo(() => {
        if (!pendingDomino || !onSideSelect) return false;
        return getValidMoves([pendingDomino], { left: gameState.table.leftValue, right: null })
            .some((m: ValidMove) => m.side === 'left' || m.side === 'start');
    }, [pendingDomino, gameState.table.leftValue, onSideSelect]);

    const showRightArrow = useMemo(() => {
        if (!pendingDomino || !onSideSelect) return false;
        return getValidMoves([pendingDomino], { left: null, right: gameState.table.rightValue })
            .some((m: ValidMove) => m.side === 'right' || m.side === 'start');
    }, [pendingDomino, gameState.table.rightValue, onSideSelect]);

    // Pulse animation for arrows
    useEffect(() => {
        if (pendingDomino) {
            pulse.value = withRepeat(
                withSequence(withTiming(1.3, { duration: 800 }), withTiming(1, { duration: 800 })),
                -1, true
            );
        } else { pulse.value = 1; }
    }, [pendingDomino]);

    const animatedPulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulse.value }],
        opacity: withTiming(pendingDomino ? 0.6 / pulse.value : 0),
    }));

    // ── Compute layout ───────────────────────────────────────────────────
    // Si on a "4", la gauche peut faire 4 dominos, la droite 4 = ligne de 9 dominos.
    // L'utilisateur veut max ~10 dominos de large.
    // Portrait: 3 (gauche) + 1 (centre) + 3 (droite) = 7 dominos de large max !
    // Paysage: 5 (gauche) + 1 (centre) + 5 (droite) = 11 dominos de large max !
    // Augmentation de tilesPerRow : on laisse la ligne s'étirer plus loin
    // avant de commencer le serpent. Le zoom automatique (boardScale)
    // s'occupera de réduire la taille des dominos si nécessaire.
    const tilesPerRow = isLandscape ? 10 : 6;

    const { placedTiles, canvasW, canvasH, offsetX, offsetY } = useMemo(() => {
        const { tiles, bounds } = computeBidirectionalLayout(gameState.table.sequence, tilesPerRow);
        const w = bounds.maxX - bounds.minX;
        const h = bounds.maxY - bounds.minY;
        // Translate all tiles so that top-left = (0,0) in the canvas
        const ox = -bounds.minX;
        const oy = -bounds.minY;
        return { placedTiles: tiles, canvasW: Math.max(w, 1), canvasH: Math.max(h, 1), offsetX: ox, offsetY: oy };
    }, [gameState.table.sequence]);

    // ── Scale constraints to fit safe zone ─────────────────────────
    // Augmentation MAJEURE des marges : exclure complètement les avatars du bord gauche/droit
    React.useImperativeHandle(ref, () => ({
        measureTile: (id, cb) => {
            tileRefs.current[id]?.measure((x, y, w, h, pageX, pageY) => {
                const tile = placedTiles.find(item => item.domino.id === id);
                if (!tile) {
                    cb(pageX, pageY, w, h);
                    return;
                }

                const logicalLeft = tile.isReversed ? tile.domino.right : tile.domino.left;
                const logicalRight = tile.isReversed ? tile.domino.left : tile.domino.right;
                cb(pageX, pageY, w, h, {
                    orientation: tile.orientation,
                    isReversed: tile.isReversed,
                    visualLeft: tile.visualFlip ? logicalRight : logicalLeft,
                    visualRight: tile.visualFlip ? logicalLeft : logicalRight,
                });
            });
        },
    }), [placedTiles]);

    const safeXPadd = isLandscape ? 200 : 180; // Zone plus restrictive pour éviter les blocs avatars sur les côtés
    const safeYPadd = isLandscape ? 120 : 180; // Espace supplémentaire en haut et bas pour les avatars

    const availW = screenWidth - safeXPadd;

    // Approximating safe area height by removing typical HUD dimensions (header + bottom bar)
    const hudOffset = isLandscape ? 140 : 250; // Breathing room for bottom controls 
    const availH = screenHeight - hudOffset - safeYPadd;

    // Scale down to fit available space. Cap at 1.0 to ensure tiles start large but never exceed safe area.
    // Ajout explicite d'un * 0.93 pour s'assurer que si ça touche les limites calculées, il y a encore du "vide" protecteur
    const boardScale = Math.min(1, availW / Math.max(canvasW, 1), availH / Math.max(canvasH, 1)) * 0.93;
    const scaledW = canvasW * boardScale;
    const scaledH = canvasH * boardScale;

    // Find spatially leftmost & rightmost tiles for arrow positioning
    const leftmostTile = useMemo(() => {
        if (placedTiles.length === 0) return null;
        return placedTiles.reduce((best, t) => t.x < best.x ? t : best, placedTiles[0]);
    }, [placedTiles]);

    const rightmostTile = useMemo(() => {
        if (placedTiles.length === 0) return null;
        return placedTiles.reduce((best, t) =>
            (t.x + t.width) > (best.x + best.width) ? t : best, placedTiles[0]);
    }, [placedTiles]);

    return (
        <View style={[styles.container, isLandscape && styles.containerLandscape, skinConfig ? { backgroundColor: skinConfig.boardColor ?? skinConfig.tableBackgroundColor } : {}]}>
            {/* Outer wrapper at SCALED size to preserve document flow & auto-centering */}
            <View style={{ width: scaledW, height: scaledH, justifyContent: 'center', alignItems: 'center' }}>
                {/* Inner canvas at NATURAL size but scaled via transform */}
                <View style={[
                    styles.snakeCanvas,
                    {
                        width: canvasW,
                        height: canvasH,
                        transform: [{ scale: boardScale }],
                    }
                ]}>
                    {/* DOMINO TILES */}
                    {placedTiles.map((item, idx) => {
                        const logicalLeft = item.isReversed ? item.domino.right : item.domino.left;
                        const logicalRight = item.isReversed ? item.domino.left : item.domino.right;
                        return (
                            <View
                                key={item.domino.id}
                                style={[
                                    styles.tileAbsolute,
                                    {
                                        left: item.x + offsetX,
                                        top: item.y + offsetY,
                                        width: item.width,
                                        height: item.height,
                                        opacity: hiddenDominoId === item.domino.id ? 0 : 1,
                                    },
                                ]}
                            >
                                <View
                                    ref={(el) => (tileRefs.current[item.domino.id] = el as any)}
                                    style={StyleSheet.absoluteFill}
                                >
                                    <DominoTile
                                        left={item.visualFlip ? logicalRight : logicalLeft}
                                        right={item.visualFlip ? logicalLeft : logicalRight}
                                        orientation={item.orientation}
                                        size={T}
                                        disabled
                                        noMargin
                                        skinConfig={skinConfig}
                                        animateOnMount={false}
                                    />
                                </View>
                            </View>
                        );
                    })}
                </View>
            </View>

            {/* SIDE SELECTION ARROWS — Rendered OUTSIDE the scaled canvas at full size */}
            {showLeftArrow && (
                <TouchableOpacity
                    style={[styles.sideArrow, styles.sideArrowLeft]}
                    onPress={() => onSideSelect?.('left')}
                    activeOpacity={0.7}
                >
                    <Animated.View entering={ZoomIn.duration(300)} style={styles.sideArrowInner}>
                        <Animated.View style={[styles.sideArrowPulse, animatedPulseStyle]} />
                        <Ionicons name="arrow-back" size={30} color="#FFF" />
                        <Animated.Text style={styles.sideArrowLabel}>◀ GAUCHE</Animated.Text>
                    </Animated.View>
                </TouchableOpacity>
            )}
            {showRightArrow && (
                <TouchableOpacity
                    style={[styles.sideArrow, styles.sideArrowRight]}
                    onPress={() => onSideSelect?.('right')}
                    activeOpacity={0.7}
                >
                    <Animated.View entering={ZoomIn.duration(300)} style={styles.sideArrowInner}>
                        <Animated.View style={[styles.sideArrowPulse, animatedPulseStyle]} />
                        <Ionicons name="arrow-forward" size={30} color="#FFF" />
                        <Animated.Text style={styles.sideArrowLabel}>DROITE ▶</Animated.Text>
                    </Animated.View>
                </TouchableOpacity>
            )}
        </View>
    );
});

GameTable.displayName = 'GameTable';

// ═══════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingTop: 80,
        paddingBottom: 130,
    },
    containerLandscape: {
        paddingTop: 40,
        paddingBottom: 80,
    },
    scrollContent: {
        alignItems: 'center',
        justifyContent: 'center',
        flexGrow: 1,
        paddingVertical: 10,
    },
    snakeCanvas: {
        position: 'relative',
    },
    tileAbsolute: {
        position: 'absolute',
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 3,
        elevation: 5,
    },
    sideArrow: {
        position: 'absolute',
        zIndex: 600,
        top: '40%',
    },
    sideArrowLeft: {
        left: 4,
    },
    sideArrowRight: {
        right: 4,
    },
    sideArrowInner: {
        width: 64,
        height: 80,
        borderRadius: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.88)',
        borderWidth: 2.5,
        borderColor: '#FFD700',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 18,
        elevation: 20,
    },
    sideArrowPulse: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 16,
        borderWidth: 3,
        borderColor: '#FFD700',
    },
    sideArrowLabel: {
        color: '#FFD700',
        fontSize: 9,
        fontWeight: '800',
        marginTop: 4,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
});
