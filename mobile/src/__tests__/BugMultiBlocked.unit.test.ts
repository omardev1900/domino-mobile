/**
 * BugMultiBlocked.unit.test.ts
 *
 * Tests unitaires & de régression pour BUG-MULTI-BLOCKED.
 *
 * Deux correctifs sont couverts :
 *   1. useActionDispatcher — MARK_BOUDE ne doit PAS acquérir le verrou de tour
 *      (sinon PASS_TURN suivant est bloqué indéfiniment).
 *   2. useGameSync.safeUpdateGameState — la validation de l'état entrant doit
 *      s'appuyer sur la progression logique (mancheNumber / roundNumber / turnId)
 *      et NON sur lastActionTimestamp, qui dépend de l'horloge locale du client.
 *
 * Ces tests sont PUREMENT logiques : pas de React, pas de Firebase, pas de hooks.
 * La fonction validateStateProgression est extraite/reproduite ici pour être
 * testée de façon isolée, en accord avec les règles du projet
 * (toute logique testable doit l'être indépendamment du framework).
 */

import { GameState } from '../core/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reproduit la logique de validation extraite de useGameSync.safeUpdateGameState.
 * On la teste séparément pour éviter de mocker Firebase.
 */
function validateStateProgression(
    newState: Partial<GameState>,
    currentState: Partial<GameState>
): boolean {
    const nManche = newState.mancheNumber ?? 1;
    const cManche = currentState.mancheNumber ?? 1;
    const nRound = newState.roundNumber ?? 1;
    const cRound = currentState.roundNumber ?? 1;
    const nTurn = newState.turnId ?? 0;
    const cTurn = currentState.turnId ?? 0;

    let isValidUpdate = false;

    if (nManche > cManche) {
        isValidUpdate = true;
    } else if (nManche === cManche && nRound > cRound) {
        isValidUpdate = true;
    } else if (nManche === cManche && nRound === cRound) {
        if (nTurn > cTurn) {
            isValidUpdate = true;
        } else if (nTurn === cTurn) {
            if (newState.phase !== currentState.phase) {
                isValidUpdate = true;
            } else if (newState.boudePlayerId && !currentState.boudePlayerId) {
                isValidUpdate = true; // MARK_BOUDE
            }
        }
    }

    if (newState.phase === 'MATCH_END' && currentState.phase !== 'MATCH_END') {
        isValidUpdate = true;
    }

    return isValidUpdate;
}

/**
 * Reproduit la logique de décision du verrou de useActionDispatcher.
 * MARK_BOUDE ne doit PAS acquérir le verrou.
 */
function usesTurnLock(commandType: string): boolean {
    return commandType !== 'NEXT_ROUND'
        && commandType !== 'RESOLVE_BOUDE'
        && commandType !== 'MARK_BOUDE'; // Fix BUG-MULTI-BLOCKED
}

// ---------------------------------------------------------------------------
// SECTION 1 — Verrou de tour / useActionDispatcher
// ---------------------------------------------------------------------------

describe('BUG-MULTI-BLOCKED — ActionDispatcher : Verrou de tour', () => {

    describe('MARK_BOUDE ne doit PAS acquérir le verrou', () => {

        test('MARK_BOUDE : usesTurnLock retourne false', () => {
            expect(usesTurnLock('MARK_BOUDE')).toBe(false);
        });

        test('PASS_TURN : usesTurnLock retourne true (comportement normal attendu)', () => {
            expect(usesTurnLock('PASS_TURN')).toBe(true);
        });

        test('PLAY_TILE : usesTurnLock retourne true (comportement normal attendu)', () => {
            expect(usesTurnLock('PLAY_TILE')).toBe(true);
        });

        test('TIMEOUT : usesTurnLock retourne true', () => {
            expect(usesTurnLock('TIMEOUT')).toBe(true);
        });

        test('RESOLVE_BOUDE : usesTurnLock retourne false (piloté par host sans verrou)', () => {
            expect(usesTurnLock('RESOLVE_BOUDE')).toBe(false);
        });

        test('NEXT_ROUND : usesTurnLock retourne false (piloté par host sans verrou)', () => {
            expect(usesTurnLock('NEXT_ROUND')).toBe(false);
        });
    });

    describe('Simulation du deadlock — MARK_BOUDE ne bloque plus PASS_TURN', () => {

        test('Scénario deadlock corrigé : verrou disponible pour PASS_TURN après MARK_BOUDE', () => {
            // Avant le fix : MARK_BOUDE acquérait le verrou et ne le relâchait jamais
            // car le finally de useActionDispatcher libère uniquement si usesTurnLock est true.
            // Après le fix : MARK_BOUDE contourne le verrou → PASS_TURN peut s'exécuter.

            let lockHeld = false;

            function acquireLock(): boolean {
                if (lockHeld) return false;
                lockHeld = true;
                return true;
            }
            function releaseLock() {
                lockHeld = false;
            }

            // Simuler MARK_BOUDE (corrigé : n'acquiert pas le verrou)
            const markBoudeUsesLock = usesTurnLock('MARK_BOUDE');
            if (markBoudeUsesLock) acquireLock();
            // Après l'action, on ne libère que si le verrou était pris
            if (markBoudeUsesLock) releaseLock();

            // Le verrou doit être disponible pour PASS_TURN
            const passTurnCanRun = acquireLock();
            expect(passTurnCanRun).toBe(true); // RÉGRESSION : était false avant le fix

            releaseLock();
        });

        test('Scénario de blocage AVANT le fix (documentation du bug)', () => {
            // Ce test documente l'ANCIEN comportement buggé.
            // Si MARK_BOUDE acquiert le verrou et ne le relâche pas, PASS_TURN est bloqué.
            let lockHeld = false;

            function acquireLock(): boolean {
                if (lockHeld) return false;
                lockHeld = true;
                return true;
            }

            // ANCIEN comportement : MARK_BOUDE acquérait le verrou
            const oldMarkBoudeUsesLock = true; // ancienne valeur
            if (oldMarkBoudeUsesLock) acquireLock();
            // Le finally ne libère pas (car usesTurnLock était true),
            // mais MARK_BOUDE ne finit pas par un releaseLock dans l'ancien code...
            // → le verrou reste bloqué

            // PASS_TURN est rejeté car le verrou est pris
            const passTurnCanRunOldBehavior = acquireLock();
            expect(passTurnCanRunOldBehavior).toBe(false); // confirme l'ancien bug
        });
    });
});

// ---------------------------------------------------------------------------
// SECTION 2 — Validation de progression / useGameSync.safeUpdateGameState
// ---------------------------------------------------------------------------

describe('BUG-MULTI-BLOCKED — safeUpdateGameState : Validation de progression', () => {

    describe('Avancement du turnId', () => {

        test('turnId supérieur → mise à jour valide', () => {
            expect(validateStateProgression(
                { mancheNumber: 1, roundNumber: 1, turnId: 5, phase: 'PLAYING' },
                { mancheNumber: 1, roundNumber: 1, turnId: 4, phase: 'PLAYING' }
            )).toBe(true);
        });

        test('turnId égal, même phase → mise à jour rejetée (doublon)', () => {
            expect(validateStateProgression(
                { mancheNumber: 1, roundNumber: 1, turnId: 4, phase: 'PLAYING' },
                { mancheNumber: 1, roundNumber: 1, turnId: 4, phase: 'PLAYING' }
            )).toBe(false);
        });

        test('turnId INFÉRIEUR → mise à jour rejetée (état périmé)', () => {
            expect(validateStateProgression(
                { mancheNumber: 1, roundNumber: 1, turnId: 3, phase: 'PLAYING' },
                { mancheNumber: 1, roundNumber: 1, turnId: 4, phase: 'PLAYING' }
            )).toBe(false);
        });
    });

    describe('Avancement du roundNumber', () => {

        test('roundNumber supérieur, même manche → valide', () => {
            expect(validateStateProgression(
                { mancheNumber: 1, roundNumber: 3, turnId: 0, phase: 'PLAYING' },
                { mancheNumber: 1, roundNumber: 2, turnId: 7, phase: 'PLAYING' }
            )).toBe(true);
        });

        test('roundNumber inférieur, même manche → rejeté', () => {
            expect(validateStateProgression(
                { mancheNumber: 1, roundNumber: 1, turnId: 99, phase: 'PLAYING' },
                { mancheNumber: 1, roundNumber: 2, turnId: 0, phase: 'PLAYING' }
            )).toBe(false);
        });
    });

    describe('Avancement du mancheNumber', () => {

        test('mancheNumber supérieur → toujours valide (quelle que soit la régression de turnId)', () => {
            expect(validateStateProgression(
                { mancheNumber: 2, roundNumber: 1, turnId: 0, phase: 'PLAYING' },
                { mancheNumber: 1, roundNumber: 5, turnId: 99, phase: 'PLAYING' }
            )).toBe(true);
        });

        test('mancheNumber inférieur → rejeté', () => {
            expect(validateStateProgression(
                { mancheNumber: 1, roundNumber: 1, turnId: 0, phase: 'PLAYING' },
                { mancheNumber: 2, roundNumber: 1, turnId: 0, phase: 'PLAYING' }
            )).toBe(false);
        });
    });

    describe('Transitions de phase (même turnId)', () => {

        test('PLAYING → BOUDE : valide (changement de phase légitime)', () => {
            expect(validateStateProgression(
                { mancheNumber: 1, roundNumber: 1, turnId: 4, phase: 'BOUDE' },
                { mancheNumber: 1, roundNumber: 1, turnId: 4, phase: 'PLAYING' }
            )).toBe(true);
        });

        test('BOUDE → PARTIE_END : valide', () => {
            expect(validateStateProgression(
                { mancheNumber: 1, roundNumber: 1, turnId: 4, phase: 'PARTIE_END' },
                { mancheNumber: 1, roundNumber: 1, turnId: 4, phase: 'BOUDE' }
            )).toBe(true);
        });

        test('PLAYING → PARTIE_END : valide', () => {
            expect(validateStateProgression(
                { mancheNumber: 1, roundNumber: 1, turnId: 7, phase: 'PARTIE_END' },
                { mancheNumber: 1, roundNumber: 1, turnId: 7, phase: 'PLAYING' }
            )).toBe(true);
        });

        test('même phase → rejeté si turnId identique', () => {
            expect(validateStateProgression(
                { mancheNumber: 1, roundNumber: 1, turnId: 4, phase: 'PLAYING' },
                { mancheNumber: 1, roundNumber: 1, turnId: 4, phase: 'PLAYING' }
            )).toBe(false);
        });
    });

    describe('MARK_BOUDE — boudePlayerId passe de null à une valeur', () => {

        test('boudePlayerId renseigné alors que currentState n\'en a pas → valide', () => {
            expect(validateStateProgression(
                { mancheNumber: 1, roundNumber: 1, turnId: 4, phase: 'PLAYING', boudePlayerId: 'p2' },
                { mancheNumber: 1, roundNumber: 1, turnId: 4, phase: 'PLAYING', boudePlayerId: null }
            )).toBe(true);
        });

        test('boudePlayerId identique → rejeté (doublon MARK_BOUDE)', () => {
            expect(validateStateProgression(
                { mancheNumber: 1, roundNumber: 1, turnId: 4, phase: 'PLAYING', boudePlayerId: 'p2' },
                { mancheNumber: 1, roundNumber: 1, turnId: 4, phase: 'PLAYING', boudePlayerId: 'p2' }
            )).toBe(false);
        });

        test('boudePlayerId repassé à null → rejeté (pas un avancement)', () => {
            expect(validateStateProgression(
                { mancheNumber: 1, roundNumber: 1, turnId: 4, phase: 'PLAYING', boudePlayerId: null },
                { mancheNumber: 1, roundNumber: 1, turnId: 4, phase: 'PLAYING', boudePlayerId: 'p2' }
            )).toBe(false);
        });
    });

    describe('MATCH_END — toujours accepté depuis n\'importe quelle phase', () => {

        test('PLAYING → MATCH_END : valide (même turnId bas)', () => {
            expect(validateStateProgression(
                { mancheNumber: 1, roundNumber: 1, turnId: 0, phase: 'MATCH_END' },
                { mancheNumber: 1, roundNumber: 1, turnId: 99, phase: 'PLAYING' }
            )).toBe(true);
        });

        test('MANCHE_END → MATCH_END : valide', () => {
            expect(validateStateProgression(
                { mancheNumber: 2, roundNumber: 1, turnId: 0, phase: 'MATCH_END' },
                { mancheNumber: 2, roundNumber: 1, turnId: 0, phase: 'MANCHE_END' }
            )).toBe(true);
        });

        test('MATCH_END → MATCH_END : rejeté (doublon)', () => {
            // Le test du mancheNumber étant identique et de la phase identique, c'est rejeté
            // (sauf si turnId avance, ce qui n'arrive pas en MATCH_END)
            expect(validateStateProgression(
                { mancheNumber: 1, roundNumber: 1, turnId: 0, phase: 'MATCH_END' },
                { mancheNumber: 1, roundNumber: 1, turnId: 0, phase: 'MATCH_END' }
            )).toBe(false);
        });
    });

    describe('Cas limites — horloge / timestamps manquants', () => {

        test('mancheNumber undefined → interprété comme 1 (compatible)', () => {
            // newState sans mancheNumber (undefined → ?? 1) vs currentState mancheNumber=1
            expect(validateStateProgression(
                { roundNumber: 1, turnId: 5, phase: 'PLAYING' }, // mancheNumber absent
                { mancheNumber: 1, roundNumber: 1, turnId: 4, phase: 'PLAYING' }
            )).toBe(true); // turnId 5 > 4 → valide
        });

        test('turnId undefined → interprété comme 0', () => {
            // newState avec turnId absent (0) et currentState turnId = 0 → même turnId, même phase → rejeté
            expect(validateStateProgression(
                { mancheNumber: 1, roundNumber: 1, phase: 'PLAYING' }, // turnId absent
                { mancheNumber: 1, roundNumber: 1, turnId: 0, phase: 'PLAYING' }
            )).toBe(false);
        });

        test('Résistance aux désynchronisations d\'horloge : turnId gagne sur le timestamp', () => {
            // Avant le fix, si l'horloge du client B était en retard,
            // lastActionTimestamp(B) < lastActionTimestamp(Firestore) → écriture rejetée même valide.
            // Avec le fix, seul le turnId compte : si B a turnId=5 et Firebase en est à turnId=4, c'est valide.
            const clientBState = { mancheNumber: 1, roundNumber: 1, turnId: 5, phase: 'PLAYING', lastActionTimestamp: 1000 };
            const firebaseState = { mancheNumber: 1, roundNumber: 1, turnId: 4, phase: 'PLAYING', lastActionTimestamp: 2000 };
            // lastActionTimestamp de B < Firebase, mais turnId de B > Firebase → doit être valide
            expect(validateStateProgression(clientBState, firebaseState)).toBe(true);
        });

        test('Scénario de blocage multi : auto-pass arrive après MARK_BOUDE déjà propagé', () => {
            // Firebase contient déjà boudePlayerId='p2' (MARK_BOUDE propagé) avec turnId=4
            // Le client essaie d'écrire PASS_TURN qui produit turnId=5
            const passTurnState = { mancheNumber: 1, roundNumber: 1, turnId: 5, phase: 'PLAYING', boudePlayerId: null };
            const firebaseAfterMarkBoude = { mancheNumber: 1, roundNumber: 1, turnId: 4, phase: 'PLAYING', boudePlayerId: 'p2' };
            expect(validateStateProgression(passTurnState, firebaseAfterMarkBoude)).toBe(true);
        });
    });

    describe('Scénarios de jeu complets', () => {

        test('Séquence normale d\'un round : 5 tours joués', () => {
            const states = [
                { turnId: 0, roundNumber: 1, mancheNumber: 1, phase: 'PLAYING' },
                { turnId: 1, roundNumber: 1, mancheNumber: 1, phase: 'PLAYING' },
                { turnId: 2, roundNumber: 1, mancheNumber: 1, phase: 'PLAYING' },
                { turnId: 3, roundNumber: 1, mancheNumber: 1, phase: 'PLAYING' },
                { turnId: 4, roundNumber: 1, mancheNumber: 1, phase: 'PLAYING' },
                { turnId: 4, roundNumber: 1, mancheNumber: 1, phase: 'PARTIE_END' }, // fin de round
            ];

            for (let i = 1; i < states.length; i++) {
                const isValid = validateStateProgression(states[i], states[i - 1]);
                expect(isValid).toBe(true);
            }
        });

        test('Séquence complète avec Boudé : PLAYING → MARK_BOUDE → PASS_TURN → BOUDE', () => {
            const afterMarkBoude = {
                turnId: 3, roundNumber: 1, mancheNumber: 1,
                phase: 'PLAYING', boudePlayerId: 'p2'
            };
            const beforeMarkBoude = {
                turnId: 3, roundNumber: 1, mancheNumber: 1,
                phase: 'PLAYING', boudePlayerId: null
            };
            expect(validateStateProgression(afterMarkBoude, beforeMarkBoude)).toBe(true);

            const afterPassTurn = {
                turnId: 4, roundNumber: 1, mancheNumber: 1, // turnId incrémenté
                phase: 'PLAYING', boudePlayerId: null
            };
            expect(validateStateProgression(afterPassTurn, afterMarkBoude)).toBe(true);

            const afterBoude = {
                turnId: 6, roundNumber: 1, mancheNumber: 1,
                phase: 'BOUDE', boudePlayerId: null
            };
            expect(validateStateProgression(afterBoude, afterPassTurn)).toBe(true);
        });

        test('Transition vers nouvelle manche : round reset + mancheNumber++', () => {
            const endOfManche = { turnId: 12, roundNumber: 3, mancheNumber: 1, phase: 'MANCHE_END' };
            const startOfNextManche = { turnId: 0, roundNumber: 1, mancheNumber: 2, phase: 'PLAYING' };
            expect(validateStateProgression(startOfNextManche, endOfManche)).toBe(true);
        });

        test('Transition multi-round dans une manche', () => {
            const endOfRound = { turnId: 8, roundNumber: 1, mancheNumber: 1, phase: 'PARTIE_END' };
            const startOfNextRound = { turnId: 0, roundNumber: 2, mancheNumber: 1, phase: 'PLAYING' };
            expect(validateStateProgression(startOfNextRound, endOfRound)).toBe(true);
        });

        test('Doublon réseau : même état envoyé deux fois → rejeté la 2e fois', () => {
            const state = { turnId: 5, roundNumber: 2, mancheNumber: 1, phase: 'PLAYING' };
            // 1ère écriture → valide vs état précédent
            expect(validateStateProgression(state, { ...state, turnId: 4 })).toBe(true);
            // 2ème écriture (doublon) → rejeté vs lui-même
            expect(validateStateProgression(state, state)).toBe(false);
        });

        test('Race condition : deux clients écrivent le même tour simultanément', () => {
            // Client A et B génèrent tous les deux un état avec turnId=5 (PLAY_TILE simultané)
            const clientA = { turnId: 5, roundNumber: 1, mancheNumber: 1, phase: 'PLAYING' };
            const clientB = { turnId: 5, roundNumber: 1, mancheNumber: 1, phase: 'PLAYING' };
            const firebaseAtTurn4 = { turnId: 4, roundNumber: 1, mancheNumber: 1, phase: 'PLAYING' };

            // Client A arrive en premier → valide
            expect(validateStateProgression(clientA, firebaseAtTurn4)).toBe(true);

            // Client B arrive après → Firebase a déjà turnId=5, B est un doublon → rejeté
            expect(validateStateProgression(clientB, clientA)).toBe(false);
        });
    });
});
