/**
 * LigueCochons.test.ts
 *
 * Tests unitaires pour la logique de déblocage des paliers
 * de la Ligue des Cochons — système 8 paliers (22/04/2026).
 *
 * Grades : DEBUTANT(1) APPRENTI_1(10) APPRENTI_2(20) APPRENTI_3(30)
 *          MAITRE_1(60)   MAITRE_2(90)   MAITRE_3(120)
 *          ROI(250)       LEGENDE(500)
 */

// Mocks Firebase
import { leagueService } from '../services/league.service';

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  updateDoc: jest.fn(),
  arrayUnion: jest.fn(),
  increment: jest.fn(),
}));

jest.mock('../services/firebase', () => ({
  db: {},
}));

const NO_FRAMES: string[] = [];

describe('LeagueService — computeNewUnlocks (8 paliers)', () => {

    // ─── Cas 1 : Aucun déblocage (< 10 cochons) ─────────────────────────────

    it('retourne un tableau vide si on reste en dessous de 10 cochons', () => {
        expect(leagueService.computeNewUnlocks(0, 9, NO_FRAMES)).toHaveLength(0);
    });

    it('retourne un tableau vide si on était à 5 et on ajoute 4 (total=9)', () => {
        expect(leagueService.computeNewUnlocks(5, 4, NO_FRAMES)).toHaveLength(0);
    });

    // ─── Cas 2 : APPRENTI_1 (seuil = 10) ────────────────────────────────────

    it('débloque APPRENTI_1 (frame_apprenti_1) en franchissant 10', () => {
        const events = leagueService.computeNewUnlocks(8, 3, NO_FRAMES);
        expect(events).toHaveLength(1);
        expect(events[0].grade).toBe('APPRENTI_1');
        expect(events[0].frameId).toBe('frame_apprenti_1');
        expect(events[0].coinsBonus).toBe(200);
    });

    it('débloque APPRENTI_1 exactement sur 10', () => {
        const events = leagueService.computeNewUnlocks(9, 1, NO_FRAMES);
        expect(events).toHaveLength(1);
        expect(events[0].grade).toBe('APPRENTI_1');
    });

    // ─── Cas 3 : APPRENTI_2 (seuil = 20) ────────────────────────────────────

    it('débloque APPRENTI_2 (frame_apprenti_2) en franchissant 20', () => {
        const already = ['frame_apprenti_1'];
        const events = leagueService.computeNewUnlocks(18, 5, already);
        expect(events).toHaveLength(1);
        expect(events[0].grade).toBe('APPRENTI_2');
        expect(events[0].frameId).toBe('frame_apprenti_2');
        expect(events[0].coinsBonus).toBe(300);
    });

    // ─── Cas 4 : APPRENTI_3 (seuil = 30) ────────────────────────────────────

    it('débloque APPRENTI_3 (frame_apprenti_3) en franchissant 30', () => {
        const already = ['frame_apprenti_1', 'frame_apprenti_2'];
        const events = leagueService.computeNewUnlocks(28, 5, already);
        expect(events).toHaveLength(1);
        expect(events[0].grade).toBe('APPRENTI_3');
        expect(events[0].frameId).toBe('frame_apprenti_3');
        expect(events[0].coinsBonus).toBe(500);
    });

    // ─── Cas 5 : MAITRE_1 (seuil = 60) ──────────────────────────────────────

    it('débloque MAITRE_1 (frame_maitre_1) en franchissant 60', () => {
        const already = ['frame_apprenti_1', 'frame_apprenti_2', 'frame_apprenti_3'];
        const events = leagueService.computeNewUnlocks(55, 10, already);
        expect(events).toHaveLength(1);
        expect(events[0].grade).toBe('MAITRE_1');
        expect(events[0].frameId).toBe('frame_maitre_1');
        expect(events[0].coinsBonus).toBe(600);
    });

    // ─── Cas 6 : MAITRE_2 (seuil = 90) ──────────────────────────────────────

    it('débloque MAITRE_2 (frame_maitre_2) en franchissant 90', () => {
        const already = ['frame_apprenti_1', 'frame_apprenti_2', 'frame_apprenti_3', 'frame_maitre_1'];
        const events = leagueService.computeNewUnlocks(88, 5, already);
        expect(events).toHaveLength(1);
        expect(events[0].grade).toBe('MAITRE_2');
        expect(events[0].frameId).toBe('frame_maitre_2');
        expect(events[0].coinsBonus).toBe(800);
    });

    // ─── Cas 7 : MAITRE_3 (seuil = 120) ─────────────────────────────────────

    it('débloque MAITRE_3 (frame_maitre_3) en franchissant 120', () => {
        const already = ['frame_apprenti_1', 'frame_apprenti_2', 'frame_apprenti_3', 'frame_maitre_1', 'frame_maitre_2'];
        const events = leagueService.computeNewUnlocks(115, 10, already);
        expect(events).toHaveLength(1);
        expect(events[0].grade).toBe('MAITRE_3');
        expect(events[0].frameId).toBe('frame_maitre_3');
        expect(events[0].coinsBonus).toBe(1000);
    });

    // ─── Cas 8 : ROI (seuil = 250) ───────────────────────────────────────────

    it('débloque ROI (frame_roi) en franchissant 250', () => {
        const already = ['frame_apprenti_1', 'frame_apprenti_2', 'frame_apprenti_3',
                         'frame_maitre_1', 'frame_maitre_2', 'frame_maitre_3'];
        const events = leagueService.computeNewUnlocks(240, 15, already);
        expect(events).toHaveLength(1);
        expect(events[0].grade).toBe('ROI');
        expect(events[0].frameId).toBe('frame_roi');
        expect(events[0].coinsBonus).toBe(5000);
    });

    // ─── Cas 9 : LEGENDE (seuil = 500) ───────────────────────────────────────

    it('débloque LEGENDE (frame_legende) en franchissant 500', () => {
        const already = ['frame_apprenti_1', 'frame_apprenti_2', 'frame_apprenti_3',
                         'frame_maitre_1', 'frame_maitre_2', 'frame_maitre_3', 'frame_roi'];
        const events = leagueService.computeNewUnlocks(490, 15, already);
        expect(events).toHaveLength(1);
        expect(events[0].grade).toBe('LEGENDE');
        expect(events[0].frameId).toBe('frame_legende');
        expect(events[0].coinsBonus).toBe(10000);
    });

    // ─── Cas 10 : Multi-paliers en cascade ───────────────────────────────────

    it('débloque APPRENTI_1 + APPRENTI_2 en cascade si on passe de 0 à 25 cochons', () => {
        const events = leagueService.computeNewUnlocks(0, 25, NO_FRAMES);
        expect(events).toHaveLength(2);
        const grades = events.map(e => e.grade);
        expect(grades).toContain('APPRENTI_1');
        expect(grades).toContain('APPRENTI_2');
    });

    it('débloque les 3 paliers Apprenti + MAITRE_1 si on passe de 0 à 65 cochons', () => {
        const events = leagueService.computeNewUnlocks(0, 65, NO_FRAMES);
        expect(events).toHaveLength(4);
        const grades = events.map(e => e.grade);
        expect(grades).toContain('APPRENTI_1');
        expect(grades).toContain('APPRENTI_2');
        expect(grades).toContain('APPRENTI_3');
        expect(grades).toContain('MAITRE_1');
    });

    it('débloque les 8 paliers si on passe de 0 à 600 cochons (cascade complète)', () => {
        const events = leagueService.computeNewUnlocks(0, 600, NO_FRAMES);
        expect(events).toHaveLength(8);
        expect(events.map(e => e.grade)).toEqual([
            'APPRENTI_1', 'APPRENTI_2', 'APPRENTI_3',
            'MAITRE_1',   'MAITRE_2',   'MAITRE_3',
            'ROI',        'LEGENDE',
        ]);
    });

    // ─── Cas 11 : Idempotence ────────────────────────────────────────────────

    it("ne redonne pas APPRENTI_1 si frame_apprenti_1 est déjà dans unlockedFrames", () => {
        const already = ['frame_apprenti_1'];
        const events = leagueService.computeNewUnlocks(8, 5, already);
        expect(events.find(e => e.grade === 'APPRENTI_1')).toBeUndefined();
    });

    it("ne redonne aucun palier si tous sont déjà débloqués", () => {
        const already = [
            'frame_apprenti_1', 'frame_apprenti_2', 'frame_apprenti_3',
            'frame_maitre_1', 'frame_maitre_2', 'frame_maitre_3',
            'frame_roi', 'frame_legende',
        ];
        const events = leagueService.computeNewUnlocks(600, 100, already);
        expect(events).toHaveLength(0);
    });

    // ─── Cas 12 : getGradeFromCochons ────────────────────────────────────────

    describe('getGradeFromCochons', () => {
        it('retourne null pour 0 cochons (sans grade)', () => {
            expect(leagueService.getGradeFromCochons(0)).toBeNull();
        });

        it('retourne DEBUTANT pour 1 cochon', () => {
            expect(leagueService.getGradeFromCochons(1)).toBe('DEBUTANT');
        });

        it('retourne DEBUTANT pour 9 cochons', () => {
            expect(leagueService.getGradeFromCochons(9)).toBe('DEBUTANT');
        });

        it('retourne APPRENTI_1 pour 10 cochons', () => {
            expect(leagueService.getGradeFromCochons(10)).toBe('APPRENTI_1');
        });

        it('retourne APPRENTI_1 pour 19 cochons', () => {
            expect(leagueService.getGradeFromCochons(19)).toBe('APPRENTI_1');
        });

        it('retourne APPRENTI_2 pour 20 cochons', () => {
            expect(leagueService.getGradeFromCochons(20)).toBe('APPRENTI_2');
        });

        it('retourne APPRENTI_3 pour 30 cochons', () => {
            expect(leagueService.getGradeFromCochons(30)).toBe('APPRENTI_3');
        });

        it('retourne MAITRE_1 pour 60 cochons', () => {
            expect(leagueService.getGradeFromCochons(60)).toBe('MAITRE_1');
        });

        it('retourne MAITRE_1 pour 89 cochons', () => {
            expect(leagueService.getGradeFromCochons(89)).toBe('MAITRE_1');
        });

        it('retourne MAITRE_2 pour 90 cochons', () => {
            expect(leagueService.getGradeFromCochons(90)).toBe('MAITRE_2');
        });

        it('retourne MAITRE_3 pour 120 cochons', () => {
            expect(leagueService.getGradeFromCochons(120)).toBe('MAITRE_3');
        });

        it('retourne ROI pour 250 cochons', () => {
            expect(leagueService.getGradeFromCochons(250)).toBe('ROI');
        });

        it('retourne ROI pour 499 cochons', () => {
            expect(leagueService.getGradeFromCochons(499)).toBe('ROI');
        });

        it('retourne LEGENDE pour 500 cochons', () => {
            expect(leagueService.getGradeFromCochons(500)).toBe('LEGENDE');
        });

        it('retourne LEGENDE pour 1000 cochons', () => {
            expect(leagueService.getGradeFromCochons(1000)).toBe('LEGENDE');
        });

        it('retourne null pour 0 cochon (sans grade)', () => {
            expect(leagueService.getGradeFromCochons(0)).toBeNull();
        });
        it('retourne DEBUTANT pour 9 cochons (premier grade)', () => {
            expect(leagueService.getGradeFromCochons(9)).toBe('DEBUTANT');
        });
    });

    // ─── Cas 13 : getNextFrameThreshold ──────────────────────────────────────

    describe('getNextFrameThreshold', () => {
        it('retourne 10 pour 0 cochons', () => {
            expect(leagueService.getNextFrameThreshold(0)).toBe(10);
        });

        it('retourne 10 pour 1 cochon (grade sans cadre)', () => {
            expect(leagueService.getNextFrameThreshold(1)).toBe(10);
        });

        it('retourne 20 pour 10 cochons', () => {
            expect(leagueService.getNextFrameThreshold(10)).toBe(20);
        });

        it('retourne 30 pour 20 cochons', () => {
            expect(leagueService.getNextFrameThreshold(20)).toBe(30);
        });

        it('retourne 60 pour 30 cochons', () => {
            expect(leagueService.getNextFrameThreshold(30)).toBe(60);
        });

        it('retourne 90 pour 60 cochons', () => {
            expect(leagueService.getNextFrameThreshold(60)).toBe(90);
        });

        it('retourne 120 pour 90 cochons', () => {
            expect(leagueService.getNextFrameThreshold(90)).toBe(120);
        });

        it('retourne 250 pour 120 cochons', () => {
            expect(leagueService.getNextFrameThreshold(120)).toBe(250);
        });

        it('retourne 500 pour 250 cochons', () => {
            expect(leagueService.getNextFrameThreshold(250)).toBe(500);
        });

        it('retourne null au grade maximum (500+)', () => {
            expect(leagueService.getNextFrameThreshold(500)).toBeNull();
            expect(leagueService.getNextFrameThreshold(999)).toBeNull();
        });
    });

});
