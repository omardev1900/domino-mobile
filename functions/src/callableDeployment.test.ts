import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as admin from 'firebase-admin';

import { createRequestRematch } from './roomLifecycle';
import { createSubmitGameAction } from './submitGameAction';

const fakeDb = {} as admin.firestore.Firestore;
describe('callable deployment', () => {
    it('conserve la region et le timeout attendus pour les callables critiques', () => {
        const submit = createSubmitGameAction(fakeDb);
        const rematch = createRequestRematch(fakeDb);

        assert.deepEqual(submit.__endpoint.region, ['europe-west1']);
        assert.deepEqual(rematch.__endpoint.region, ['europe-west1']);
        assert.equal(submit.__endpoint.timeoutSeconds, 60);
        assert.equal(rematch.__endpoint.timeoutSeconds, 60);
        assert.ok('callableTrigger' in submit.__endpoint);
        assert.ok('callableTrigger' in rematch.__endpoint);
    });
});
