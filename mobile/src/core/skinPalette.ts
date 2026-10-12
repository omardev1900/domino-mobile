import { DominoSide } from './types';
import { SkinConfig } from './store.types';

const DEFAULT_BACKGROUND = '#f0e68c';
const DEFAULT_DOT = '#615e53ff';

export interface DominoSidePalette {
    backgroundColor: string;
    dotColor: string;
}

/**
 * Resolves a half's colors without changing legacy skins that only define one
 * domino background and dot color.
 */
export function resolveDominoSidePalette(
    value: DominoSide,
    skinConfig?: SkinConfig,
): DominoSidePalette {
    const configuredDotColor = skinConfig?.dominoValueDotColors?.[value]
        ?? skinConfig?.dominoDotColor;
    const normalizedDotColor = configuredDotColor?.toLowerCase?.() ?? '';

    return {
        backgroundColor: skinConfig?.dominoValueBackgroundColors?.[value]
            ?? skinConfig?.dominoBackgroundColor
            ?? DEFAULT_BACKGROUND,
        dotColor: normalizedDotColor === '#000000' || normalizedDotColor === '#000'
            ? DEFAULT_DOT
            : configuredDotColor ?? DEFAULT_DOT,
    };
}
