import { HAND_SIZE } from './constants';

export const DEV_STARTING_HAND_SIZES = [3, 5, 7] as const;
export type StartingHandSize = typeof DEV_STARTING_HAND_SIZES[number];

const IS_DEVELOPMENT = typeof __DEV__ !== 'undefined' && __DEV__;

export const resolveStartingHandSize = (
    requestedSize: number | undefined,
    isDevelopment = IS_DEVELOPMENT
): StartingHandSize => {
    if (!isDevelopment) return HAND_SIZE as StartingHandSize;

    return DEV_STARTING_HAND_SIZES.includes(requestedSize as StartingHandSize)
        ? requestedSize as StartingHandSize
        : DEV_STARTING_HAND_SIZES[0];
};

export const DEFAULT_STARTING_HAND_SIZE = resolveStartingHandSize(undefined);

/** Le réglage individuel concerne l’hôte, quel que soit son rang dans la table. */
export const resolveHostHandSizeIndex = (
    enabled: boolean | undefined,
    hostId: string,
    players: ReadonlyArray<{ uid: string }>,
    isDevelopment = IS_DEVELOPMENT,
): number | undefined => {
    if (!isDevelopment || !enabled) return undefined;
    const index = players.findIndex(player => player.uid === hostId);
    return index < 0 ? undefined : index;
};
