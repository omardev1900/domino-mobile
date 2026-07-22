
import { getValidMoves, getBotMove } from './DominoEngine';
import { Domino, DominoSide } from './types';

/**
 * MOCK DATA GENERATOR
 */
const generateDeck = (): Domino[] => {
    const deck: Domino[] = [];
    let id = 0;
    for (let i = 0; i <= 6; i++) {
        for (let j = i; j <= 6; j++) {
            deck.push({
                id: `d-${id++}`,
                left: i as DominoSide,
                right: j as DominoSide,
                isDouble: i === j,
            });
        }
    }
    return deck.sort(() => Math.random() - 0.5);
};

describe('DominoEngine Migration (Phase 1.4)', () => {

    test('Premier coup : Autorise les 7 dominos de la main', () => {
        const fullDeck = generateDeck();
        const hand = fullDeck.slice(0, 7);
        const firstMoves = getValidMoves(hand, null);
        expect(firstMoves.length).toBe(7);
        expect(firstMoves[0].side).toBe('start');
    });

    test('Validation des correspondances standard (4 cas)', () => {
        const domino12: Domino = { id: '1-2', left: 1, right: 2, isDouble: false };
        const domino34: Domino = { id: '3-4', left: 3, right: 4, isDouble: false };

        // CAS 1 : Gauche, sans inversion [1|2] sur [2|...] -> 1 devient l'extrémité
        const m1 = getValidMoves([domino12], { left: 2 as DominoSide, right: 5 as DominoSide });
        expect(m1[0].isReversed).toBe(false);

        // CAS 2 : Gauche, avec inversion [2|1] sur [1|...] -> 2 devient l'extrémité
        const m2 = getValidMoves([domino12], { left: 1 as DominoSide, right: 5 as DominoSide });
        expect(m2[0].isReversed).toBe(true);

        // CAS 3 : Droite, sans inversion [...|3] sur [3|4] -> 4 devient l'extrémité
        const m3 = getValidMoves([domino34], { left: 6 as DominoSide, right: 3 as DominoSide });
        expect(m3[0].isReversed).toBe(false);

        // CAS 4 : Droite, avec inversion [...|4] sur [4|3] -> 3 devient l'extrémité
        const m4 = getValidMoves([domino34], { left: 6 as DominoSide, right: 4 as DominoSide });
        expect(m4[0].isReversed).toBe(true);
    });

    test('Stress Test : 100 simulations de tours de bots stratégiques', () => {
        let botErrors = 0;
        for (let i = 0; i < 100; i++) {
            const deck = generateDeck();
            const bHand = deck.slice(0, 7);
            const bEnds = {
                left: Math.floor(Math.random() * 7) as DominoSide,
                right: Math.floor(Math.random() * 7) as DominoSide
            };

            const possible = getValidMoves(bHand, bEnds);
            const decision = getBotMove(bHand, bEnds, 'MAPIPI');

            if (possible.length > 0 && !decision) {
                console.error(`Erreur simulation ${i} : Le bot n'a pas trouvé de coup alors qu'un coup était possible.`);
                botErrors++;
            }
            if (decision && !possible.find(p => p.tile.id === decision.tile.id)) {
                console.error(`Erreur simulation ${i} : Le bot a choisi un coup invalide.`);
                botErrors++;
            }
        }
        expect(botErrors).toBe(0);
    });

    test('Intelligence Valou : Priorité aux doubles pour commencer', () => {
        const hand: Domino[] = [
            { id: '1', left: 1, right: 3, isDouble: false },
            { id: '2', left: 2, right: 2, isDouble: true } // Double 2
        ];
        const decision = getBotMove(hand, null, 'MAPIPI');
        expect(decision?.tile.id).toBe('2');
    });

});
