import { useLayoutEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { GameState } from '../../core/types';
import { FlyingDominoData } from '../../core/animations/AnimationTypes';
import { GameTableRef } from '../GameTable';

export const getReplayPlay = (before: GameState, after: GameState) => {
    if (before.roundNumber !== after.roundNumber || before.mancheNumber !== after.mancheNumber) return null;
    if (after.history.length !== before.history.length + 1) return null;
    const action = after.history[after.history.length - 1];
    if (action.action !== 'PLAY' || !action.domino) return null;
    if (before.table.sequence.some(item => item.domino.id === action.domino?.id)) return null;
    if (!after.table.sequence.some(item => item.domino.id === action.domino?.id)) return null;
    return { playerId: action.playerId, domino: action.domino };
};

export const useReplayFlight = (frames: GameState[], index: number, visible: boolean) => {
    const boardRef = useRef<View>(null);
    const tableRef = useRef<GameTableRef>(null);
    const avatarRefs = useRef<Record<string, View | null>>({});
    const previousIndex = useRef<number | null>(null);
    const [flight, setFlight] = useState<FlyingDominoData | null>(null);
    const [hiddenDominoId, setHiddenDominoId] = useState<string | null>(null);

    useLayoutEffect(() => {
        let cancelled = false;
        let completed = false;
        let waitForLayout: ReturnType<typeof setTimeout> | undefined;
        let fallback: ReturnType<typeof setTimeout> | undefined;
        setFlight(null);
        setHiddenDominoId(null);
        if (!visible) { previousIndex.current = null; return; }
        const from = previousIndex.current;
        previousIndex.current = index;
        const play = from !== null && index === from + 1 && frames[from] && frames[index]
            ? getReplayPlay(frames[from], frames[index]) : null;
        if (!play) return;

        setHiddenDominoId(play.domino.id);
        // Layout needs a frame to position the newly placed (temporarily hidden) tile.
        waitForLayout = setTimeout(() => {
            const avatar = avatarRefs.current[play.playerId];
            const board = boardRef.current;
            const table = tableRef.current;
            if (!avatar || !board || !table) { setHiddenDominoId(null); return; }
            fallback = setTimeout(() => { if (!cancelled && !completed) setHiddenDominoId(null); completed = true; }, 300);
            board.measureInWindow((boardX, boardY) => {
                avatar.measureInWindow((x, y, width, height) => {
                    table.measureTile(play.domino.id, (endX, endY, tileWidth, tileHeight, meta) => {
                        if (cancelled || completed) return;
                        completed = true;
                        clearTimeout(fallback);
                        if (width <= 0 || height <= 0 || tileWidth <= 0 || tileHeight <= 0) { setHiddenDominoId(null); return; }
                        setFlight({
                            animationId: `${index}-${play.domino.id}`,
                            domino: play.domino,
                            startPoint: { x: x - boardX + width / 2 - 17, y: y - boardY + height / 2 - 34 },
                            endPoint: { x: endX - boardX, y: endY - boardY },
                            baseSize: 34,
                            width: tileWidth,
                            height: tileHeight,
                            orientation: meta?.orientation ?? (tileWidth > tileHeight ? 'horizontal' : 'vertical'),
                            isReversed: meta?.isReversed ?? false,
                            visualLeft: meta?.visualLeft,
                            visualRight: meta?.visualRight,
                        });
                    });
                });
            });
        }, 30);
        return () => { cancelled = true; clearTimeout(waitForLayout); clearTimeout(fallback); };
    }, [frames, index, visible]);

    return { boardRef, tableRef, avatarRefs, flight, hiddenDominoId, finishFlight: () => { setFlight(null); setHiddenDominoId(null); } };
};
