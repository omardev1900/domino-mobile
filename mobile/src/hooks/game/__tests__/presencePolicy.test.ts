import { isHeartbeatSuspendedPhase, shouldRestoreHumanStatus } from '../presencePolicy';

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

    it('restaure uniquement une deconnexion temporaire', () => {
        expect(shouldRestoreHumanStatus('DISCONNECTED')).toBe(true);
        expect(shouldRestoreHumanStatus('SURRENDERED')).toBe(false);
        expect(shouldRestoreHumanStatus('HUMAN')).toBe(false);
        expect(shouldRestoreHumanStatus('BOT')).toBe(false);
    });
});
