import { ALL_DOMINOS } from '../constants';
import { Domino, DominoSide } from '../types';

export type TileStatus =
    | { status: 'PLAYED' }
    | { status: 'MINE' }
    | { status: 'UNKNOWN'; probabilities: Map<string, number> };

export interface TileTracker {
    tileStates: Map<string, TileStatus>;
    excludedValues: Map<string, Set<number>>; // playerId → valeurs qu'il ne peut PAS jouer
    handSizes: Map<string, number>;           // playerId → nb de tuiles restantes
}

/** Génère l'ID canonique d'une tuile pour le jeu (ex: "d-12") */
export function tileId(left: number, right: number): string {
    const lo = Math.min(left, right);
    const hi = Math.max(left, right);
    const index = ALL_DOMINOS.findIndex(d => d.left === lo && d.right === hi);
    return `d-${index}`;
}

/** Génère les 28 tuiles du jeu double-six */
export function allTiles(): Domino[] {
    const tiles: Domino[] = [];
    for (let l = 0; l <= 6; l++) {
        for (let r = l; r <= 6; r++) {
            tiles.push({
                id: tileId(l, r),
                left: l as DominoSide,
                right: r as DominoSide,
                isDouble: l === r,
            });
        }
    }
    return tiles;
}

/**
 * Initialise le tracker pour une nouvelle partie.
 * @param myHand    Main du bot MÈTKAYALI
 * @param opponents IDs des adversaires
 */
export function initTileTracker(myHand: Domino[], opponents: string[], initialHandSize = 7): TileTracker {
    const tileStates = new Map<string, TileStatus>();
    const myIds = new Set(myHand.map(t => t.id));

    const players = [...opponents, 'talon'];

    for (const tile of allTiles()) {
        if (myIds.has(tile.id)) {
            tileStates.set(tile.id, { status: 'MINE' });
        } else {
            // Distribution uniforme entre adversaires + talon
            const probs = new Map<string, number>();
            const p = 1 / players.length;
            for (const pid of players) probs.set(pid, p);
            tileStates.set(tile.id, { status: 'UNKNOWN', probabilities: probs });
        }
    }

    const excludedValues = new Map<string, Set<number>>();
    const handSizes = new Map<string, number>();
    for (const pid of opponents) {
        excludedValues.set(pid, new Set());
        handSizes.set(pid, initialHandSize);
    }

    return { tileStates, excludedValues, handSizes };
}

/**
 * Un adversaire vient de jouer une tuile : on la marque PLAYED et on recalcule.
 */
export function onOpponentPlayed(tracker: TileTracker, playerId: string, tile: Domino): TileTracker {
    const next = cloneTracker(tracker);
    next.tileStates.set(tile.id, { status: 'PLAYED' });
    const prev = next.handSizes.get(playerId) ?? 1;
    next.handSizes.set(playerId, Math.max(0, prev - 1));
    redistributeUnknowns(next);
    return next;
}

/**
 * Un adversaire passe son tour : il ne peut pas jouer leftValue ni rightValue.
 * On exclut ces valeurs de son pool et on recalcule les probabilités.
 */
export function onOpponentPassed(
    tracker: TileTracker,
    playerId: string,
    leftValue: DominoSide | null,
    rightValue: DominoSide | null
): TileTracker {
    const next = cloneTracker(tracker);
    const excluded = next.excludedValues.get(playerId) ?? new Set<number>();

    if (leftValue !== null) excluded.add(leftValue);
    if (rightValue !== null) excluded.add(rightValue);
    next.excludedValues.set(playerId, excluded);

    // Les tuiles contenant ces valeurs ne peuvent pas être chez cet adversaire
    for (const [id, state] of next.tileStates.entries()) {
        if (state.status !== 'UNKNOWN') continue;
        const idx = parseInt(id.replace('d-', ''), 10);
        if (isNaN(idx)) continue;
        const { left: lo, right: hi } = ALL_DOMINOS[idx];
        if (excluded.has(lo) || excluded.has(hi)) {
            const probs = new Map(state.probabilities);
            probs.set(playerId, 0);
            // Renormaliser
            const total = [...probs.values()].reduce((s, v) => s + v, 0);
            if (total > 0) {
                for (const [k, v] of probs) probs.set(k, v / total);
            }
            next.tileStates.set(id, { status: 'UNKNOWN', probabilities: probs });
        }
    }

    return next;
}

/**
 * Une tuile a été jouée sur la table (par n'importe qui, visible de tous).
 */
export function onTilePlayed(tracker: TileTracker, tile: Domino): TileTracker {
    const next = cloneTracker(tracker);
    next.tileStates.set(tile.id, { status: 'PLAYED' });
    redistributeUnknowns(next);
    return next;
}

/**
 * Retourne la probabilité qu'une tuile soit chez un joueur donné.
 * 0 si la tuile est PLAYED ou MINE.
 */
export function probabilityAt(tracker: TileTracker, tileIdStr: string, playerId: string): number {
    const state = tracker.tileStates.get(tileIdStr);
    if (!state || state.status !== 'UNKNOWN') return 0;
    return state.probabilities.get(playerId) ?? 0;
}

/**
 * Retourne les tuiles les plus probablement en main d'un adversaire (prob > seuil).
 */
export function likelyTilesFor(tracker: TileTracker, playerId: string, threshold = 0.3): string[] {
    const result: string[] = [];
    for (const [id, state] of tracker.tileStates.entries()) {
        if (state.status !== 'UNKNOWN') continue;
        if ((state.probabilities.get(playerId) ?? 0) >= threshold) {
            result.push(id);
        }
    }
    return result;
}

// ─── Interne ─────────────────────────────────────────────────────────────────

function cloneTracker(tracker: TileTracker): TileTracker {
    const tileStates = new Map<string, TileStatus>();
    for (const [k, v] of tracker.tileStates) {
        if (v.status === 'UNKNOWN') {
            tileStates.set(k, { status: 'UNKNOWN', probabilities: new Map(v.probabilities) });
        } else {
            tileStates.set(k, { ...v });
        }
    }
    return {
        tileStates,
        excludedValues: new Map([...tracker.excludedValues].map(([k, v]) => [k, new Set(v)])),
        handSizes: new Map(tracker.handSizes),
    };
}

function redistributeUnknowns(tracker: TileTracker): void {
    // Après qu'une tuile est jouée, renormaliser les probabilités des tuiles restantes UNKNOWN
    for (const [id, state] of tracker.tileStates.entries()) {
        if (state.status !== 'UNKNOWN') continue;
        const probs = state.probabilities;
        const total = [...probs.values()].reduce((s, v) => s + v, 0);
        if (total > 0 && Math.abs(total - 1) > 0.001) {
            for (const [k, v] of probs) probs.set(k, v / total);
        }
    }
}
