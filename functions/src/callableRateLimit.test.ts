import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as functions from 'firebase-functions';

import { advanceRateLimit } from './callableRateLimit';

const limit = { perSecond: 2, perMinute: 3 };

describe('callableRateLimit', () => {
    it('compte les appels dans les deux fenetres', () => {
        const first = advanceRateLimit(undefined, limit, 1_000);
        const second = advanceRateLimit(first, limit, 1_100);

        assert.equal(second.secondCount, 2);
        assert.equal(second.minuteCount, 2);
    });

    it('rejette le depassement par seconde', () => {
        const first = advanceRateLimit(undefined, limit, 1_000);
        const second = advanceRateLimit(first, limit, 1_100);

        assert.throws(
            () => advanceRateLimit(second, limit, 1_200),
            (error: unknown) =>
                error instanceof functions.https.HttpsError
                && error.code === 'resource-exhausted'
        );
    });

    it('conserve la minute quand la fenetre seconde redemarre', () => {
        const first = advanceRateLimit(undefined, limit, 1_000);
        const second = advanceRateLimit(first, limit, 2_000);

        assert.equal(second.secondCount, 1);
        assert.equal(second.minuteCount, 2);
    });

    it('rejette le depassement par minute puis repart apres une minute', () => {
        const first = advanceRateLimit(undefined, limit, 1_000);
        const second = advanceRateLimit(first, limit, 2_000);
        const third = advanceRateLimit(second, limit, 3_000);

        assert.throws(
            () => advanceRateLimit(third, limit, 4_000),
            (error: unknown) =>
                error instanceof functions.https.HttpsError
                && error.code === 'resource-exhausted'
        );

        const reset = advanceRateLimit(third, limit, 61_000);
        assert.equal(reset.secondCount, 1);
        assert.equal(reset.minuteCount, 1);
    });
});
