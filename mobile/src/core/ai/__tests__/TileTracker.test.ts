import {
    allTiles,
    initTileTracker,
    onOpponentPassed,
    onOpponentPlayed,
    probabilityAt,
    likelyTilesFor,
    tileId,
} from '../TileTracker';
import { Domino, DominoSide } from '../../types';

const makeTile = (l: number, r: number): Domino => ({
    id: tileId(l, r),
    left: l as DominoSide,
    right: r as DominoSide,
    isDouble: l === r,
});

describe('TileTracker', () => {
    it('génère 28 tuiles pour un jeu double-six', () => {
        expect(allTiles()).toHaveLength(28);
    });

    it('initialise correctement les tuiles de ma main comme MINE', () => {
        const myHand = [makeTile(6, 6), makeTile(5, 3)];
        const tracker = initTileTracker(myHand, ['opp1', 'opp2']);

        expect(tracker.tileStates.get(tileId(6, 6))?.status).toBe('MINE');
        expect(tracker.tileStates.get(tileId(3, 5))?.status).toBe('MINE');
    });

    it('les tuiles inconnues ont des probabilités uniformes au départ', () => {
        const myHand = [makeTile(6, 6)];
        const tracker = initTileTracker(myHand, ['opp1', 'opp2']);

        const state = tracker.tileStates.get(tileId(0, 0));
        expect(state?.status).toBe('UNKNOWN');
        if (state?.status === 'UNKNOWN') {
            const p1 = state.probabilities.get('opp1') ?? 0;
            const p2 = state.probabilities.get('opp2') ?? 0;
            const talon = state.probabilities.get('talon') ?? 0;
            expect(p1 + p2 + talon).toBeCloseTo(1, 5);
            expect(p1).toBeCloseTo(p2, 5);
        }
    });

    it('exclut les tuiles contenant la valeur passée après un passage', () => {
        const myHand = [makeTile(6, 6)];
        const tracker = initTileTracker(myHand, ['opp1', 'opp2']);

        const updated = onOpponentPassed(tracker, 'opp1', 3, 5);

        // La tuile [3-5] ne peut plus être chez opp1
        const state = updated.tileStates.get(tileId(3, 5));
        if (state?.status === 'UNKNOWN') {
            expect(state.probabilities.get('opp1')).toBe(0);
        }
    });

    it('marque une tuile comme PLAYED après un coup adversaire', () => {
        const myHand = [makeTile(6, 6)];
        const tracker = initTileTracker(myHand, ['opp1']);
        const played = makeTile(3, 4);

        const updated = onOpponentPlayed(tracker, 'opp1', played);
        expect(updated.tileStates.get(tileId(3, 4))?.status).toBe('PLAYED');
    });

    it('décrémente la handSize après un coup adversaire', () => {
        const myHand = [makeTile(6, 6)];
        const tracker = initTileTracker(myHand, ['opp1']);

        expect(tracker.handSizes.get('opp1')).toBe(7);
        const updated = onOpponentPlayed(tracker, 'opp1', makeTile(0, 1));
        expect(updated.handSizes.get('opp1')).toBe(6);
    });

    it('probabilityAt retourne 0 pour une tuile MINE', () => {
        const myHand = [makeTile(6, 6)];
        const tracker = initTileTracker(myHand, ['opp1']);
        expect(probabilityAt(tracker, tileId(6, 6), 'opp1')).toBe(0);
    });

    it('likelyTilesFor retourne les tuiles avec prob >= seuil', () => {
        const myHand = [makeTile(6, 6)];
        // Avec 1 seul adversaire (+ talon), prob = 0.5 pour chaque tuile UNKNOWN
        const tracker = initTileTracker(myHand, ['opp1']);
        const likely = likelyTilesFor(tracker, 'opp1', 0.3);
        expect(likely.length).toBeGreaterThan(0);
    });
});
