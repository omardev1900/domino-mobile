import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyAvailabilityForUser } from './matchmakingPresence';

describe('matchmakingPresence', () => {
    it('compte un joueur une seule fois malgré plusieurs connexions', () => {
        const first = applyAvailabilityForUser({
            connections: { player: { phone: { t: 1 } } },
            public: { availableCount: 0 },
        }, 'player');
        const second = applyAvailabilityForUser({
            ...first,
            connections: { player: { phone: { t: 1 }, tablet: { t: 2 } } },
        }, 'player');

        assert.equal(first?.public?.availableCount, 1);
        assert.equal(second?.public?.availableCount, 1);
    });

    it('retire le joueur seulement après sa dernière connexion', () => {
        const root = {
            connections: { player: { phone: { t: 1 } } },
            availableUsers: { player: true as const },
            public: { availableCount: 1 },
        };

        const result = applyAvailabilityForUser({
            ...root,
            connections: { player: {} },
        }, 'player');

        assert.equal(result?.public?.availableCount, 0);
        assert.equal(result?.availableUsers?.player, undefined);
    });

    it('ne produit jamais de compteur négatif', () => {
        const result = applyAvailabilityForUser({
            connections: { player: {} },
            public: { availableCount: 0 },
        }, 'player');

        assert.equal(result?.public?.availableCount, 0);
    });
});
