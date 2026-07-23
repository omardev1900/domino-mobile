import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as admin from 'firebase-admin';

import { createActiveTurnCoordinator } from './activeTurnCoordinator';
import { createTerminalGameCoordinator } from './terminalGameCoordinator';

const fakeDb = {} as admin.firestore.Firestore;

describe('coordinator deployment', () => {
    it('deploie les deux coordinateurs en Gen2 dans la region attendue', () => {
        const activeTurn = createActiveTurnCoordinator(fakeDb);
        const terminal = createTerminalGameCoordinator(fakeDb);

        for (const coordinator of [activeTurn, terminal]) {
            assert.equal(coordinator.__endpoint.platform, 'gcfv2');
            assert.deepEqual(coordinator.__endpoint.region, ['europe-west1']);
            assert.equal(
                coordinator.__endpoint.eventTrigger?.eventType,
                'google.cloud.firestore.document.v1.updated'
            );
            assert.equal(coordinator.__endpoint.eventTrigger?.retry, true);
        }
        assert.equal(activeTurn.__endpoint.timeoutSeconds, 120);
        assert.equal(terminal.__endpoint.timeoutSeconds, 60);
    });
});
