import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

import { enforceCallableRateLimit } from './callableRateLimit';

describe('callableRateLimit avec Firestore Emulator', () => {
    let app: admin.app.App;
    let db: admin.firestore.Firestore;

    before(() => {
        app = admin.initializeApp({ projectId: 'demo-domino' }, 'rate-limit-integration');
        db = app.firestore();
    });

    after(async () => app.delete());

    it('partage le compteur Firestore et isole les UID', async () => {
        const limit = { perSecond: 2, perMinute: 10 };

        await enforceCallableRateLimit(db, 'p1', 'submit', limit, 1_000);
        await enforceCallableRateLimit(db, 'p1', 'submit', limit, 1_100);
        await enforceCallableRateLimit(db, 'p2', 'submit', limit, 1_100);

        await assert.rejects(
            enforceCallableRateLimit(db, 'p1', 'submit', limit, 1_200),
            (error: unknown) =>
                error instanceof functions.https.HttpsError
                && error.code === 'resource-exhausted'
        );
    });
});
