import { DominoSide } from './types';

export const TOTAL_DOMINOS = 28;
export const HAND_SIZE = 7;
export const SOLO_HAND_SIZE = 7;
export const TALON_MORT_SIZE = 7; // This may need adjustment if hand sizes vary
export const MAX_PLAYERS = 3;
export const MIN_PLAYERS = 2; // Solo mode
export const WINS_TO_WIN_MATCH = 2;
export const MANCHE_WIN_THRESHOLD = 3;
export const TURN_DURATION_SECONDS = 15;

export const ALL_DOMINOS: { left: DominoSide; right: DominoSide }[] = [];
for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
        ALL_DOMINOS.push({ left: i as DominoSide, right: j as DominoSide });
    }
}
