import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

export interface CallableRateLimit {
    perSecond: number;
    perMinute: number;
}

interface RateLimitState {
    secondWindowStartedAt: number;
    secondCount: number;
    minuteWindowStartedAt: number;
    minuteCount: number;
}

const SECOND_MS = 1_000;
const MINUTE_MS = 60_000;

export const SUBMIT_GAME_ACTION_LIMIT: CallableRateLimit = {
    perSecond: 6,
    perMinute: 90,
};

export const REQUEST_REMATCH_LIMIT: CallableRateLimit = {
    perSecond: 2,
    perMinute: 10,
};

export const advanceRateLimit = (
    previous: Partial<RateLimitState> | undefined,
    limit: CallableRateLimit,
    now: number
): RateLimitState => {
    const secondExpired = !previous
        || now - (previous.secondWindowStartedAt ?? 0) >= SECOND_MS;
    const minuteExpired = !previous
        || now - (previous.minuteWindowStartedAt ?? 0) >= MINUTE_MS;
    const secondCount = secondExpired ? 1 : (previous.secondCount ?? 0) + 1;
    const minuteCount = minuteExpired ? 1 : (previous.minuteCount ?? 0) + 1;

    if (secondCount > limit.perSecond || minuteCount > limit.perMinute) {
        throw new functions.https.HttpsError(
            'resource-exhausted',
            'Trop de requetes. Reessayez dans quelques instants.'
        );
    }

    return {
        secondWindowStartedAt: secondExpired
            ? now
            : previous?.secondWindowStartedAt ?? now,
        secondCount,
        minuteWindowStartedAt: minuteExpired
            ? now
            : previous?.minuteWindowStartedAt ?? now,
        minuteCount,
    };
};

export const enforceCallableRateLimit = async (
    db: admin.firestore.Firestore,
    uid: string,
    scope: string,
    limit: CallableRateLimit,
    now = Date.now()
): Promise<void> => {
    const rateLimitRef = db
        .collection('_callableRateLimits')
        .doc(`${scope}_${uid}`);

    await db.runTransaction(async transaction => {
        const snapshot = await transaction.get(rateLimitRef);
        const nextState = advanceRateLimit(
            snapshot.exists ? snapshot.data() as RateLimitState : undefined,
            limit,
            now
        );

        transaction.set(rateLimitRef, {
            ...nextState,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
};
