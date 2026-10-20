import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { createHash, randomBytes } from 'node:crypto';
import { z, ZodError } from 'zod';
import { enforceCallableRateLimit } from './callableRateLimit';

export const PREMIUM_TRIAL_DURATION_MS = 3 * 24 * 60 * 60 * 1_000;
export const PREMIUM_ACTIVATION_COINS = 1_000;

export type PremiumSource = 'TRIAL' | 'ADMIN_GRANT' | 'PROMO_CODE';

interface PremiumEntitlementData {
    source?: PremiumSource;
    expiresAt?: admin.firestore.Timestamp;
    trialUsedAt?: admin.firestore.Timestamp;
}

interface PremiumCodeData {
    active?: boolean;
    durationDays?: number;
    expiresAt?: admin.firestore.Timestamp;
    maxRedemptions?: number;
    redemptionCount?: number;
}

type EconomyData = { coins?: number };

const grantInputSchema = z.object({
    userId: z.string().min(1).max(128),
    durationDays: z.number().int().min(1).max(3650),
});

const createCodesInputSchema = z.object({
    count: z.number().int().min(1).max(100).default(1),
    durationDays: z.union([z.literal(3), z.literal(7), z.literal(14), z.literal(30)]).default(30),
    redeemBy: z.number().int().positive(),
});

const redeemCodeInputSchema = z.object({
    code: z.string().trim().min(6).max(64),
});

const PREMIUM_CODE_REDEMPTION_LIMIT = { perSecond: 1, perMinute: 5 };

const toMillis = (timestamp: admin.firestore.Timestamp | undefined): number | null =>
    timestamp ? timestamp.toMillis() : null;

export const normalizePremiumCode = (code: string): string =>
    code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

export const hashPremiumCode = (code: string): string =>
    createHash('sha256').update(normalizePremiumCode(code)).digest('hex');

const createPremiumCodeValue = (): string => {
    const value = randomBytes(8).toString('hex').toUpperCase();
    return `DM-${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8, 12)}`;
};

export function isActivePremiumEntitlement(data: PremiumEntitlementData | undefined, now: number): boolean {
    const expiresAt = toMillis(data?.expiresAt);
    return expiresAt !== null && expiresAt > now;
}

export function canActivatePremiumTrial(data: PremiumEntitlementData | undefined, now: number): boolean {
    return !data?.trialUsedAt && !isActivePremiumEntitlement(data, now);
}

export async function activatePremiumTrial(
    db: admin.firestore.Firestore,
    uid: string,
    now = Date.now()
): Promise<{ expiresAt: number }> {
    const entitlementRef = db.collection('premium_entitlements').doc(uid);
    const expiresAt = now + PREMIUM_TRIAL_DURATION_MS;

    await db.runTransaction(async transaction => {
        const snapshot = await transaction.get(entitlementRef);
        const existing = snapshot.exists ? snapshot.data() as PremiumEntitlementData : undefined;
        if (!canActivatePremiumTrial(existing, now)) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                existing?.trialUsedAt
                    ? 'L’essai Premium a déjà été utilisé pour ce compte.'
                    : 'Votre accès Premium est déjà actif.'
            );
        }

        transaction.set(entitlementRef, {
            source: 'TRIAL' satisfies PremiumSource,
            startsAt: admin.firestore.Timestamp.fromMillis(now),
            expiresAt: admin.firestore.Timestamp.fromMillis(expiresAt),
            trialUsedAt: admin.firestore.Timestamp.fromMillis(now),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    });

    return { expiresAt };
}

export async function grantPremiumAccess(
    db: admin.firestore.Firestore,
    grantedBy: string,
    input: z.infer<typeof grantInputSchema>,
    now = Date.now()
): Promise<{ expiresAt: number }> {
    const adminRef = db.collection('admins').doc(grantedBy);
    const adminSnapshot = await adminRef.get();
    if (!adminSnapshot.exists) {
        throw new functions.https.HttpsError('permission-denied', 'Réservé aux administrateurs.');
    }

    const expiresAt = now + input.durationDays * 24 * 60 * 60 * 1_000;
    await db.collection('premium_entitlements').doc(input.userId).set({
        source: 'ADMIN_GRANT' satisfies PremiumSource,
        startsAt: admin.firestore.Timestamp.fromMillis(now),
        expiresAt: admin.firestore.Timestamp.fromMillis(expiresAt),
        grantedBy,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return { expiresAt };
}

export async function createPremiumCodes(
    db: admin.firestore.Firestore,
    createdBy: string,
    input: z.infer<typeof createCodesInputSchema>,
): Promise<{ codes: string[]; durationDays: number }> {
    const adminSnapshot = await db.collection('admins').doc(createdBy).get();
    if (!adminSnapshot.exists) {
        throw new functions.https.HttpsError('permission-denied', 'Réservé aux administrateurs.');
    }
    if (input.redeemBy <= Date.now()) {
        throw new functions.https.HttpsError('invalid-argument', 'La date limite doit être dans le futur.');
    }

    const codes = Array.from({ length: input.count }, createPremiumCodeValue);
    const batch = db.batch();
    codes.forEach(code => {
        batch.set(db.collection('premium_codes').doc(hashPremiumCode(code)), {
            active: true,
            durationDays: input.durationDays,
            expiresAt: admin.firestore.Timestamp.fromMillis(input.redeemBy),
            maxRedemptions: 1,
            redemptionCount: 0,
            createdBy,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
    await batch.commit();

    // Les valeurs ne sont retournées qu'une fois à l'administrateur créateur.
    return { codes, durationDays: input.durationDays };
}

export async function redeemPremiumCode(
    db: admin.firestore.Firestore,
    uid: string,
    rawCode: string,
    now = Date.now(),
): Promise<{ expiresAt: number; bonusCoins: number }> {
    const codeHash = hashPremiumCode(rawCode);
    const codeRef = db.collection('premium_codes').doc(codeHash);
    const entitlementRef = db.collection('premium_entitlements').doc(uid);
    const redemptionRef = db.collection('premium_code_redemptions').doc(`${uid}_${codeHash}`);
    const userRef = db.collection('users').doc(uid);

    return db.runTransaction(async transaction => {
        const [codeSnapshot, entitlementSnapshot, redemptionSnapshot, userSnapshot] = await Promise.all([
            transaction.get(codeRef),
            transaction.get(entitlementRef),
            transaction.get(redemptionRef),
            transaction.get(userRef),
        ]);
        const code = codeSnapshot.exists ? codeSnapshot.data() as PremiumCodeData : undefined;
        if (!code || code.active !== true || !code.durationDays || !code.maxRedemptions) {
            throw new functions.https.HttpsError('not-found', 'Code Premium invalide ou désactivé.');
        }
        if (code.expiresAt && code.expiresAt.toMillis() <= now) {
            throw new functions.https.HttpsError('failed-precondition', 'Ce code Premium a expiré.');
        }
        if ((code.redemptionCount ?? 0) >= code.maxRedemptions || redemptionSnapshot.exists) {
            throw new functions.https.HttpsError('already-exists', 'Ce code Premium a déjà été utilisé.');
        }

        const existing = entitlementSnapshot.exists
            ? entitlementSnapshot.data() as PremiumEntitlementData
            : undefined;
        const startsAt = Math.max(now, toMillis(existing?.expiresAt) ?? 0);
        const expiresAt = startsAt + code.durationDays * 24 * 60 * 60 * 1_000;
        transaction.set(entitlementRef, {
            source: 'PROMO_CODE' satisfies PremiumSource,
            startsAt: admin.firestore.Timestamp.fromMillis(startsAt),
            expiresAt: admin.firestore.Timestamp.fromMillis(expiresAt),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        transaction.update(codeRef, {
            redemptionCount: admin.firestore.FieldValue.increment(1),
            redeemedAt: admin.firestore.FieldValue.serverTimestamp(),
            redeemedBy: uid,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        transaction.set(redemptionRef, {
            codeHash,
            redeemedAt: admin.firestore.FieldValue.serverTimestamp(),
            userId: uid,
            bonusCoins: PREMIUM_ACTIVATION_COINS,
        });
        const currentEconomy = (userSnapshot.data()?.economy ?? {}) as EconomyData;
        transaction.set(userRef, {
            economy: {
                ...currentEconomy,
                coins: (typeof currentEconomy.coins === 'number' ? currentEconomy.coins : 0) + PREMIUM_ACTIVATION_COINS,
            },
        }, { merge: true });
        return { expiresAt, bonusCoins: PREMIUM_ACTIVATION_COINS };
    });
}

export const createActivatePremiumTrial = (db: admin.firestore.Firestore) =>
    functions
        .region('europe-west1')
        .runWith({ timeoutSeconds: 30 })
        .https.onCall(async (_data: unknown, context) => {
            if (!context.auth) {
                throw new functions.https.HttpsError('unauthenticated', 'Connexion requise.');
            }
            return activatePremiumTrial(db, context.auth.uid);
        });

export const createGrantPremiumAccess = (db: admin.firestore.Firestore) =>
    functions
        .region('europe-west1')
        .runWith({ timeoutSeconds: 30 })
        .https.onCall(async (rawInput: unknown, context) => {
            if (!context.auth) {
                throw new functions.https.HttpsError('unauthenticated', 'Connexion requise.');
            }
            try {
                return await grantPremiumAccess(db, context.auth.uid, grantInputSchema.parse(rawInput));
            } catch (error) {
                if (error instanceof ZodError) {
                    throw new functions.https.HttpsError('invalid-argument', 'Attribution Premium invalide.');
                }
                throw error;
            }
        });

export const createPremiumCodesCallable = (db: admin.firestore.Firestore) =>
    functions
        .region('europe-west1')
        .runWith({ timeoutSeconds: 30 })
        .https.onCall(async (rawInput: unknown, context) => {
            if (!context.auth) {
                throw new functions.https.HttpsError('unauthenticated', 'Connexion requise.');
            }
            try {
                return await createPremiumCodes(db, context.auth.uid, createCodesInputSchema.parse(rawInput));
            } catch (error) {
                if (error instanceof ZodError) {
                    throw new functions.https.HttpsError('invalid-argument', 'Création de codes Premium invalide.');
                }
                throw error;
            }
        });

export const createRedeemPremiumCode = (db: admin.firestore.Firestore) =>
    functions
        .region('europe-west1')
        .runWith({ timeoutSeconds: 30 })
        .https.onCall(async (rawInput: unknown, context) => {
            if (!context.auth) {
                throw new functions.https.HttpsError('unauthenticated', 'Connexion requise.');
            }
            try {
                const input = redeemCodeInputSchema.parse(rawInput);
                await enforceCallableRateLimit(db, context.auth.uid, 'redeemPremiumCode', PREMIUM_CODE_REDEMPTION_LIMIT);
                return await redeemPremiumCode(db, context.auth.uid, input.code);
            } catch (error) {
                if (error instanceof ZodError) {
                    throw new functions.https.HttpsError('invalid-argument', 'Code Premium invalide.');
                }
                throw error;
            }
        });
