import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DominoTile } from '../../components/DominoTile';
import { DominoSide } from '../../core/types';

type TrainingDomino = readonly [DominoSide, DominoSide];

export type TrainingBoardScenario = {
    table: readonly TrainingDomino[];
    hand: readonly TrainingDomino[];
    targetIndex: number;
    targetSide: 'left' | 'right';
};

export type TrainingExerciseResult = 'correct' | 'suboptimal' | 'invalid';

type TrainingExerciseBoardProps = {
    scenario: TrainingBoardScenario;
    result: TrainingExerciseResult | null;
    resetToken: number;
    onResult: (result: TrainingExerciseResult) => void;
};

type BoardBounds = { x: number; y: number; width: number; height: number };

function DraggableDomino({ tile, index, disabled, selected, onDrop, onSelect }: {
    tile: TrainingDomino;
    index: number;
    disabled: boolean;
    selected: boolean;
    onDrop: (index: number, pageX: number, pageY: number, dragX: number) => void;
    onSelect: (index: number) => void;
}) {
    const position = useRef(new Animated.ValueXY()).current;
    const responder = useMemo(() => PanResponder.create({
        // DominoTile contient son propre TouchableOpacity : on capture le geste ici
        // pour garantir que la sélection et le drag arrivent au plateau d'entraînement.
        onStartShouldSetPanResponderCapture: () => !disabled,
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: (_, gesture) => !disabled && (Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3),
        onPanResponderGrant: () => position.setOffset({ x: 0, y: 0 }),
        onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], { useNativeDriver: false }),
        onPanResponderRelease: (event, gesture) => {
            position.flattenOffset();
            if (Math.abs(gesture.dx) < 8 && Math.abs(gesture.dy) < 8) onSelect(index);
            else onDrop(index, event.nativeEvent.pageX, event.nativeEvent.pageY, gesture.dx);
            Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        },
        onPanResponderTerminate: () => Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start(),
    }), [disabled, index, onDrop, onSelect, position]);

    return (
        <Animated.View {...responder.panHandlers} style={[styles.handTile, selected && styles.handTileSelected, { transform: position.getTranslateTransform(), opacity: disabled ? 0.55 : 1 }]}>
            <DominoTile left={tile[0]} right={tile[1]} size={30} orientation="vertical" animateOnMount={false} disablePressScale />
        </Animated.View>
    );
}

export function TrainingExerciseBoard({ scenario, result, resetToken, onResult }: TrainingExerciseBoardProps) {
    const boardRef = useRef<View>(null);
    const [bounds, setBounds] = useState<BoardBounds | null>(null);
    const [placed, setPlaced] = useState<{ tile: TrainingDomino; side: 'left' | 'right' } | null>(null);
    const [selectedTile, setSelectedTile] = useState<number | null>(null);
    const leftValue = scenario.table[0][0];
    const rightValue = scenario.table[scenario.table.length - 1][1];

    useEffect(() => {
        setPlaced(null);
        setSelectedTile(null);
        setBounds(null);
    }, [scenario, resetToken]);

    const measureBoard = useCallback(() => {
        boardRef.current?.measureInWindow((x, y, width, height) => setBounds({ x, y, width, height }));
    }, []);

    const tryPlace = useCallback((index: number, side: 'left' | 'right') => {
        if (result === 'correct') return;
        setSelectedTile(null);
        const tile = scenario.hand[index];
        const requiredValue = side === 'left' ? leftValue : rightValue;
        const isPlayable = tile[0] === requiredValue || tile[1] === requiredValue;

        if (!isPlayable) {
            onResult('invalid');
            return;
        }

        setPlaced({ tile, side });
        if (index === scenario.targetIndex && side === scenario.targetSide) {
            onResult('correct');
            return;
        }
        onResult('suboptimal');
    }, [leftValue, onResult, result, rightValue, scenario]);

    const handleDrop = useCallback((index: number, pageX: number, pageY: number, dragX: number) => {
        if (result === 'correct') return;
        // Le sens du geste est plus fiable que les coordonnées absolues sur Android,
        // notamment quand la page est scrollée ou que la barre système est visible.
        if (Math.abs(dragX) >= 8) {
            tryPlace(index, dragX < 0 ? 'left' : 'right');
            return;
        }
        if (!bounds) return;
        // Une pose près d'un domino du plateau reste une pose valide : la moitié
        // gauche ou droite du plateau décide de l'extrémité, avec une marge tactile.
        const touchMargin = 52;
        const isInsideBoard = pageY >= bounds.y - touchMargin && pageY <= bounds.y + bounds.height + touchMargin;
        const side = pageX <= bounds.x + bounds.width / 2 ? 'left' : 'right';

        if (!isInsideBoard) {
            onResult('invalid');
            return;
        }
        tryPlace(index, side);
    }, [bounds, onResult, result, tryPlace]);

    return (
        <View style={styles.container}>
            <View ref={boardRef} onLayout={measureBoard} style={styles.board}>
                <View style={styles.tableArea}>
                    <TouchableOpacity disabled={selectedTile === null || result === 'correct'} onPress={() => selectedTile !== null && tryPlace(selectedTile, 'left')} style={[styles.dropZone, styles.leftZone, result !== null && result !== 'correct' && styles.dropZoneWrong, placed?.side === 'left' && styles.dropZoneCorrect]}>
                        {placed?.side === 'left' ? <DominoTile left={placed.tile[0]} right={placed.tile[1]} size={27} orientation="horizontal" animateOnMount={false} disablePressScale /> : <Text style={styles.dropLabel}>{leftValue} · GAUCHE</Text>}
                    </TouchableOpacity>
                    <View style={styles.tableLine}>
                        {scenario.table.map((tile, index) => <DominoTile key={`${tile[0]}-${tile[1]}-${index}`} left={tile[0]} right={tile[1]} size={27} orientation="horizontal" animateOnMount={false} disablePressScale />)}
                    </View>
                    <TouchableOpacity disabled={selectedTile === null || result === 'correct'} onPress={() => selectedTile !== null && tryPlace(selectedTile, 'right')} style={[styles.dropZone, styles.rightZone, result !== null && result !== 'correct' && styles.dropZoneWrong, placed?.side === 'right' && styles.dropZoneCorrect]}>
                        {placed?.side === 'right' ? <DominoTile left={placed.tile[0]} right={placed.tile[1]} size={27} orientation="horizontal" animateOnMount={false} disablePressScale /> : <Text style={styles.dropLabel}>DROITE · {rightValue}</Text>}
                    </TouchableOpacity>
                </View>
                <View style={styles.hand}>
                    <View style={styles.handTiles}>
                        {scenario.hand.map((tile, index) => <DraggableDomino key={`${tile[0]}-${tile[1]}-${index}`} tile={tile} index={index} disabled={result === 'correct'} selected={selectedTile === index} onDrop={handleDrop} onSelect={setSelectedTile} />)}
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, minHeight: 250, marginTop: 9 },
    board: { flex: 1, minHeight: 215, padding: 9, borderRadius: 18, backgroundColor: '#1B4332', borderWidth: 1, borderColor: 'rgba(126,224,129,0.4)' },
    tableArea: { flex: 1, minHeight: 126, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    tableLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 0 },
    dropZone: { width: 70, minHeight: 88, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,215,0,0.7)', backgroundColor: 'rgba(255,215,0,0.08)' },
    leftZone: { borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
    rightZone: { borderTopRightRadius: 16, borderBottomRightRadius: 16 },
    dropLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 9, fontWeight: '900', textAlign: 'center' },
    dropZoneCorrect: { borderColor: '#7EE081', backgroundColor: 'rgba(126,224,129,0.18)' },
    dropZoneWrong: { borderColor: '#FF8A80', backgroundColor: 'rgba(255,138,128,0.12)' },
    hand: { paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' },
    handTiles: { minHeight: 70, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 },
    handTile: { zIndex: 2, borderRadius: 8 },
    handTileSelected: { borderWidth: 2, borderColor: '#FFD700' },
});
