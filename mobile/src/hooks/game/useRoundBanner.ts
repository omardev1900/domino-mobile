import { useEffect, useRef, useState } from 'react';

import { GamePhase } from '../../core/types';

export type RoundBannerState = 'NONE' | 'MANCHE' | 'ROUND';

const BANNER_STEP_MS = 1000;

interface UseRoundBannerOptions {
    phase: GamePhase | undefined;
    mancheNumber: number | undefined;
    roundNumber: number | undefined;
}

export const useRoundBanner = ({
    phase,
    mancheNumber,
    roundNumber,
}: UseRoundBannerOptions): RoundBannerState => {
    const [bannerState, setBannerState] = useState<RoundBannerState>('NONE');
    const previousMancheRef = useRef(1);

    useEffect(() => {
        if (phase !== 'PLAYING') {
            setBannerState('NONE');
            return;
        }

        const currentManche = mancheNumber ?? 1;
        const currentRound = roundNumber ?? 1;
        const isNewManche = currentRound === 1 && currentManche > previousMancheRef.current;
        previousMancheRef.current = currentManche;

        if (isNewManche) {
            setBannerState('MANCHE');
            const showRoundTimer = setTimeout(() => setBannerState('ROUND'), BANNER_STEP_MS);
            const hideTimer = setTimeout(() => setBannerState('NONE'), BANNER_STEP_MS * 2);

            return () => {
                clearTimeout(showRoundTimer);
                clearTimeout(hideTimer);
            };
        }

        if (currentRound > 1) {
            setBannerState('ROUND');
            const hideTimer = setTimeout(() => setBannerState('NONE'), BANNER_STEP_MS);
            return () => clearTimeout(hideTimer);
        }

        setBannerState('NONE');
    }, [phase, mancheNumber, roundNumber]);

    return bannerState;
};
