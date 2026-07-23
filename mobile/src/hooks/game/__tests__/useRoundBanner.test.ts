import { act, renderHook } from '@testing-library/react-native';

import { GamePhase } from '../../../core/types';
import { useRoundBanner } from '../useRoundBanner';

interface BannerStateInput {
    phase: GamePhase;
    mancheNumber: number;
    roundNumber: number;
}

describe('useRoundBanner', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('affiche la manche puis le round avant de disparaitre', () => {
        const { result, rerender } = renderHook(
            (state: BannerStateInput) => useRoundBanner(state),
            { initialProps: { phase: 'MANCHE_END', mancheNumber: 4, roundNumber: 3 } }
        );

        rerender({ phase: 'PLAYING', mancheNumber: 5, roundNumber: 1 });
        expect(result.current).toBe('MANCHE');

        act(() => jest.advanceTimersByTime(1000));
        expect(result.current).toBe('ROUND');

        act(() => jest.advanceTimersByTime(1000));
        expect(result.current).toBe('NONE');
    });

    it('ne redemarre pas le timer pour un snapshot identique', () => {
        const { result, rerender } = renderHook(
            (state: BannerStateInput) => useRoundBanner(state),
            { initialProps: { phase: 'MANCHE_END', mancheNumber: 4, roundNumber: 3 } }
        );

        rerender({ phase: 'PLAYING', mancheNumber: 5, roundNumber: 1 });
        act(() => jest.advanceTimersByTime(500));
        rerender({ phase: 'PLAYING', mancheNumber: 5, roundNumber: 1 });
        act(() => jest.advanceTimersByTime(500));

        expect(result.current).toBe('ROUND');
    });

    it('efface immediatement le bandeau si la phase est interrompue', () => {
        const { result, rerender } = renderHook(
            (state: BannerStateInput) => useRoundBanner(state),
            { initialProps: { phase: 'MANCHE_END', mancheNumber: 4, roundNumber: 3 } }
        );

        rerender({ phase: 'PLAYING', mancheNumber: 5, roundNumber: 1 });
        act(() => jest.advanceTimersByTime(500));
        rerender({ phase: 'PARTIE_END', mancheNumber: 5, roundNumber: 1 });

        expect(result.current).toBe('NONE');
        act(() => jest.advanceTimersByTime(3000));
        expect(result.current).toBe('NONE');
    });

    it("annule les timers de l'ancienne manche", () => {
        const { result, rerender } = renderHook(
            (state: BannerStateInput) => useRoundBanner(state),
            { initialProps: { phase: 'PLAYING', mancheNumber: 5, roundNumber: 1 } }
        );

        act(() => jest.advanceTimersByTime(500));
        rerender({ phase: 'PLAYING', mancheNumber: 6, roundNumber: 1 });
        expect(result.current).toBe('MANCHE');

        act(() => jest.advanceTimersByTime(1000));
        expect(result.current).toBe('ROUND');
        act(() => jest.advanceTimersByTime(1000));
        expect(result.current).toBe('NONE');
    });
});
