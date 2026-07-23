import { computeNextRoundState, resolveBoude } from './gameCore/LogicEngine';
import { GameState } from './gameCore/types';

export const TERMINAL_GAME_PHASES = ['BOUDE', 'PARTIE_END', 'MANCHE_END', 'MATCH_END'] as const;

export type TerminalGamePhase = typeof TERMINAL_GAME_PHASES[number];

export interface TransitionFingerprint {
    gameId: string;
    phase: TerminalGamePhase;
    stateVersion: number;
    mancheNumber: number;
    roundNumber: number;
    turnId: number;
}

export type CoordinatorDecision =
    | { kind: 'ADVANCE'; transitionId: string; nextState: GameState }
    | { kind: 'FINALIZE_MATCH'; transitionId: string };

export const isTerminalGamePhase = (phase: string): phase is TerminalGamePhase =>
    TERMINAL_GAME_PHASES.includes(phase as TerminalGamePhase);

export const getTransitionFingerprint = (state: GameState): TransitionFingerprint | null => {
    if (!isTerminalGamePhase(state.phase)) return null;

    return {
        gameId: state.gameId,
        phase: state.phase,
        stateVersion: state.stateVersion ?? 0,
        mancheNumber: state.mancheNumber ?? 1,
        roundNumber: state.roundNumber ?? 1,
        turnId: state.turnId ?? 0,
    };
};

export const serializeTransitionFingerprint = (fingerprint: TransitionFingerprint): string =>
    [
        fingerprint.gameId,
        fingerprint.phase,
        fingerprint.stateVersion,
        fingerprint.mancheNumber,
        fingerprint.roundNumber,
        fingerprint.turnId,
    ].join(':');

export const hasTransitionFingerprint = (
    state: GameState,
    expected: TransitionFingerprint
): boolean => {
    const current = getTransitionFingerprint(state);
    return current !== null
        && serializeTransitionFingerprint(current) === serializeTransitionFingerprint(expected);
};

const computeBoudeTransition = (state: GameState): GameState => {
    const { newState: resolvedState, isTie, tiedPlayerIds } = resolveBoude(state);

    if (isTie) {
        const stateForRedeal: GameState = {
            ...resolvedState,
            phase: 'PARTIE_END',
            reDealCount: (state.reDealCount ?? 0) + 1,
            tiedPlayerIds,
        };
        return { ...computeNextRoundState(stateForRedeal), tiedPlayerIds };
    }

    // Le parcours mobile saute deja PARTIE_END apres l'affichage BOUDE.
    if (resolvedState.phase === 'PARTIE_END') {
        return computeNextRoundState(resolvedState);
    }

    return resolvedState;
};

export const computeCoordinatorDecision = (state: GameState): CoordinatorDecision | null => {
    const fingerprint = getTransitionFingerprint(state);
    if (!fingerprint) return null;

    const transitionId = serializeTransitionFingerprint(fingerprint);

    if (state.phase === 'MATCH_END') {
        return { kind: 'FINALIZE_MATCH', transitionId };
    }

    const nextState = state.phase === 'BOUDE'
        ? computeBoudeTransition(state)
        : computeNextRoundState(state);

    return { kind: 'ADVANCE', transitionId, nextState };
};
