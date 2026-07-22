import { getValidMoves, calculateHandPoints, getBotMove, ValidMove } from '../DominoEngine';
import { Domino, DominoSide } from '../types';

describe('DominoEngine', () => {
    const d00: Domino = { id: 'd00', left: 0, right: 0, isDouble: true };
    const d01: Domino = { id: 'd01', left: 0, right: 1, isDouble: false };
    const d11: Domino = { id: 'd11', left: 1, right: 1, isDouble: true };
    const d12: Domino = { id: 'd12', left: 1, right: 2, isDouble: false };
    const d22: Domino = { id: 'd22', left: 2, right: 2, isDouble: true };

    describe('getValidMoves', () => {
        it('should allow all moves on empty table (ends is null)', () => {
            const hand = [d01, d12];
            const moves = getValidMoves(hand, null);
            expect(moves).toHaveLength(2);
            expect(moves[0].side).toBe('start');
            expect(moves[1].side).toBe('start');
        });

        it('should allow all moves on empty ends', () => {
            const hand = [d01, d12];
            const moves = getValidMoves(hand, { left: null, right: null });
            expect(moves).toHaveLength(2);
        });

        it('should match left end', () => {
            const d33: Domino = { id: 'd33', left: 3, right: 3, isDouble: true };
            const hand = [d01, d33]; // only d01 matches 0 (d33 matches neither 0 nor 2)
            const moves = getValidMoves(hand, { left: 0, right: 2 });
            expect(moves).toHaveLength(1);
            expect(moves[0].tile.id).toBe('d01');
            expect(moves[0].side).toBe('left');
            expect(moves[0].isReversed).toBe(true);
        });

        it('should match right end', () => {
            const hand = [d01, d12]; // d12 matches 2
            const moves = getValidMoves(hand, { left: 5, right: 2 });
            expect(moves).toHaveLength(1);
            expect(moves[0].tile.id).toBe('d12');
            expect(moves[0].side).toBe('right');
            expect(moves[0].isReversed).toBe(true); // 2 matches right, so right (2) becomes inside.
            // if (d.right === ends.right) moves.push({ tile: d, side: 'right', isReversed: true });
        });
    });

    describe('calculateHandPoints', () => {
        it('should sum up points correctly', () => {
            expect(calculateHandPoints([d01, d12])).toBe(1 + 3);
            expect(calculateHandPoints([d00, d11, d22])).toBe(0 + 2 + 4);
        });
    });

    describe('getBotMove strategies', () => {
        const hand = [d00, d01, d11, d12, d22];
        const ends = { left: 0, right: 2 };

        it('TI_MANMAY should pick a random move', () => {
            const move = getBotMove(hand, ends, 'TI_MANMAY');
            expect(move).not.toBeNull();
            // Valid moves: d00 (left), d01 (left), d12 (right), d22 (right)
            const validIds = ['d00', 'd01', 'd12', 'd22'];
            expect(validIds).toContain(move!.tile.id);
        });

        it('MAPIPI should pick a smart move', () => {
            const move = getBotMove(hand, ends, 'MAPIPI');
            expect(move).not.toBeNull();
            // MAPIPI favors doubles and points.
        });

        it('GRAN_MOUN should pick the best move', () => {
            const move = getBotMove(hand, ends, 'GRAN_MOUN');
            expect(move).not.toBeNull();
        });
    });
});
