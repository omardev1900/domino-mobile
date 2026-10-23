import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { authService } from './auth.service';
import { db, gameFunctions } from './firebase';
import { LogService } from './LogService';
import { perfEnd, perfError, perfStart } from './perf';

export interface PremiumEntitlement {
    expiresAt: Date;
    source: 'TRIAL' | 'ADMIN_GRANT' | 'PROMO_CODE' | 'PURCHASE_CODE' | 'SUBSCRIPTION';
    trialUsedAt?: Date;
}

export interface CreatedPremiumCodes {
    codes: string[];
    durationDays: number;
}

interface PremiumEntitlementDocument {
    expiresAt?: { toDate: () => Date };
    source?: PremiumEntitlement['source'];
    trialUsedAt?: { toDate: () => Date };
}

interface PremiumActivationResult {
    expiresAt: number;
    bonusCoins?: number;
}

const toPremiumEntitlement = (data: PremiumEntitlementDocument | undefined): PremiumEntitlement | null => {
    if (!data?.expiresAt || !data.source) return null;
    return {
        expiresAt: data.expiresAt.toDate(),
        source: data.source,
        ...(data.trialUsedAt ? { trialUsedAt: data.trialUsedAt.toDate() } : {}),
    };
};

export const isPremiumActive = (entitlement: PremiumEntitlement | null, now = Date.now()): boolean =>
    Boolean(entitlement && entitlement.expiresAt.getTime() > now);

class PremiumService {
    // Mutualise les lectures concurrentes du même document sans conserver de
    // cache après résolution : les activations restent visibles immédiatement.
    private readonly entitlementRequests = new Map<string, Promise<PremiumEntitlement | null>>();

    async isCurrentUserAdmin(): Promise<boolean> {
        const startedAt = perfStart();
        const userId = (await authService.getCurrentUser())?.uid;
        if (!userId || userId.startsWith('guest_')) {
            perfEnd('premium.isAdmin', startedAt, { path: 'no-user' });
            return false;
        }
        try {
            const adminSnap = await getDoc(doc(db, 'admins', userId));
            const isAdmin = adminSnap.exists();
            perfEnd('premium.isAdmin', startedAt, {
                path: 'firestore',
                fromCache: adminSnap.metadata.fromCache,
                isAdmin,
            });
            return isAdmin;
        } catch (error) {
            perfError('premium.isAdmin.error', error);
            LogService.warn('Premium', 'Impossible de vérifier le rôle administrateur.', error);
            return false;
        }
    }

    async getEntitlement(uid?: string): Promise<PremiumEntitlement | null> {
        const startedAt = perfStart();
        const userId = uid ?? (await authService.getCurrentUser())?.uid;
        if (!userId || userId.startsWith('guest_')) {
            perfEnd('premium.entitlement', startedAt, { path: 'no-user' });
            return null;
        }

        const existing = this.entitlementRequests.get(userId);
        if (existing) return existing;

        const request = this.readEntitlement(userId, startedAt);
        this.entitlementRequests.set(userId, request);
        const cleanup = () => {
            if (this.entitlementRequests.get(userId) === request) this.entitlementRequests.delete(userId);
        };
        void request.then(cleanup, cleanup);
        return request;
    }

    private async readEntitlement(userId: string, startedAt: number): Promise<PremiumEntitlement | null> {
        try {
            const snapshot = await getDoc(doc(db, 'premium_entitlements', userId));
            const entitlement = snapshot.exists()
                ? toPremiumEntitlement(snapshot.data() as PremiumEntitlementDocument)
                : null;
            perfEnd('premium.entitlement', startedAt, {
                path: 'firestore',
                fromCache: snapshot.metadata.fromCache,
                found: Boolean(entitlement),
            });
            return entitlement;
        } catch (error) {
            perfError('premium.entitlement.error', error);
            LogService.warn('Premium', 'Impossible de lire le statut Premium.', error);
            return null;
        }
    }

    async hasActiveAccess(uid?: string): Promise<boolean> {
        const startedAt = perfStart();
        const active = isPremiumActive(await this.getEntitlement(uid));
        perfEnd('premium.hasActiveAccess', startedAt, { active });
        return active;
    }

    async activateTrial(): Promise<PremiumActivationResult> {
        const activate = httpsCallable<undefined, PremiumActivationResult>(gameFunctions, 'activatePremiumTrial');
        const result = await activate();
        return result.data;
    }

    async redeemCode(code: string): Promise<PremiumActivationResult> {
        const redeem = httpsCallable<{ code: string }, PremiumActivationResult>(gameFunctions, 'redeemPremiumCode');
        const result = await redeem({ code });
        return result.data;
    }

    async createCodes(count: number, durationDays: 3 | 7 | 14 | 30, redeemBy: number): Promise<CreatedPremiumCodes> {
        const create = httpsCallable<{ count: number; durationDays: number; redeemBy: number }, CreatedPremiumCodes>(gameFunctions, 'createPremiumCodes');
        const result = await create({ count, durationDays, redeemBy });
        return result.data;
    }

    async createCustomerPortal(): Promise<string> {
        const createPortal = httpsCallable<undefined, { url: string }>(gameFunctions, 'createPremiumCustomerPortal');
        const result = await createPortal();
        return result.data.url;
    }
}

export const premiumService = new PremiumService();
