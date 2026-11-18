import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

const MAX_SAMPLE_IDS = 20;

export type CoinAuthorityAudit = {
    ok: boolean;
    totalUsers: number;
    serverAuthority: number;
    missingAuthority: number;
    invalidBalances: number;
    missingAuthorityIds: string[];
    invalidBalanceIds: string[];
    invalidBalanceDetails: string[];
};

type UserDocument = {
    id: string;
    data: () => Record<string, unknown> | undefined;
};

export function summarizeCoinAuthority(users: UserDocument[]): CoinAuthorityAudit {
    let serverAuthority = 0;
    let missingAuthority = 0;
    let invalidBalances = 0;
    const missingAuthorityIds: string[] = [];
    const invalidBalanceIds: string[] = [];
    const invalidBalanceDetails: string[] = [];

    for (const user of users) {
        const data = user.data() ?? {};
        if (data.coinAuthority === 'server') serverAuthority++;
        else {
            missingAuthority++;
            if (missingAuthorityIds.length < MAX_SAMPLE_IDS) missingAuthorityIds.push(user.id);
        }

        const coins = (data.economy as { coins?: unknown } | undefined)?.coins;
        if (typeof coins !== 'number' || !Number.isSafeInteger(coins) || coins < 0) {
            invalidBalances++;
            if (invalidBalanceIds.length < MAX_SAMPLE_IDS) invalidBalanceIds.push(user.id);
            if (invalidBalanceDetails.length < MAX_SAMPLE_IDS) {
                const reason = coins === undefined ? 'missing' : typeof coins === 'number' ? `invalid:${coins}` : `type:${typeof coins}`;
                invalidBalanceDetails.push(`${user.id}=${reason}`);
            }
        }
    }

    return {
        ok: missingAuthority === 0 && invalidBalances === 0,
        totalUsers: users.length,
        serverAuthority,
        missingAuthority,
        invalidBalances,
        missingAuthorityIds,
        invalidBalanceIds,
        invalidBalanceDetails,
    };
}

export const createAuditCoinAuthority = (db: admin.firestore.Firestore) => functions.region('europe-west1').https.onCall(async (_data: unknown, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Connexion requise.');
    const adminSnap = await db.collection('admins').doc(context.auth.uid).get();
    if (!adminSnap.exists) throw new functions.https.HttpsError('permission-denied', 'Réservé aux administrateurs.');

    const users = await db.collection('users').get();
    return summarizeCoinAuthority(users.docs);
});
