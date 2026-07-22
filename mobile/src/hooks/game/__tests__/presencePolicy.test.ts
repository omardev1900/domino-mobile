import { isHeartbeatSuspendedPhase } from '../presencePolicy';

describe('presencePolicy', () => {
    it.each(['PARTIE_END', 'MANCHE_END', 'MATCH_END'])(
        'suspend la vigilance heartbeat pendant %s',
        phase => {
            expect(isHeartbeatSuspendedPhase(phase)).toBe(true);
        }
    );

    it.each(['PLAYING', 'BOUDE', undefined])(
        'conserve la vigilance heartbeat pendant %s',
        phase => {
            expect(isHeartbeatSuspendedPhase(phase)).toBe(false);
        }
    );
});
