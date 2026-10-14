import {
    hasAcknowledgedReleaseNotes,
    RELEASE_NOTES,
    RELEASE_VERSION,
} from '../releaseNotes';

describe('release notes', () => {
    it('are acknowledged only for the current version', () => {
        expect(hasAcknowledgedReleaseNotes(RELEASE_VERSION)).toBe(true);
        expect(hasAcknowledgedReleaseNotes('2.0.15')).toBe(false);
        expect(hasAcknowledgedReleaseNotes(null)).toBe(false);
    });

    it('contains player-facing changes', () => {
        expect(RELEASE_NOTES.length).toBeGreaterThan(0);
        expect(RELEASE_NOTES).toContain('Réorganisez librement vos dominos par glisser-déposer.');
    });
});
