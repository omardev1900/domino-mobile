import assert from 'node:assert/strict';
import test from 'node:test';

import { buildGlobalLeaderboardProjection } from './globalLeaderboard';

test('buildGlobalLeaderboardProjection excludes match history', () => {
    const projection = buildGlobalLeaderboardProjection('u1', {
        displayName: 'Aziz',
        avatarId: 'avatar_1',
        economy: { coins: 50, xp: 20, cochonsGiven: 7 },
        stats: {
            gamesPlayed: 3,
            totalCochonsInflicted: 7,
            totalCochonsSubis: 2,
            totalPointsAccumulated: 120,
            matchHistory: [{ id: 'heavy-history-entry' }],
        },
    });

    assert.equal(projection.userId, 'u1');
    assert.equal(projection.cochonsGiven, 7);
    assert.equal(projection.cochonsSubis, 2);
    assert.equal(projection.pointsAccumulated, 120);
    assert.equal('matchHistory' in projection, false);
});
