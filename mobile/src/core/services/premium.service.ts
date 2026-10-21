import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { authService } from './auth.service';
import { db, gameFunctions } from './firebase';
import { LogService } from './LogService';

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
    async isCurrentUserAdmin(): Promise<boolean> {
        const userId = (await authService.getCurrentUser())?.uid;
        if (!userId || userId.startsWith('guest_')) return false;
        try {
            return (await getDoc(doc(db, 'admins', userId))).exists();
        } catch (error) {
            LogService.warn('Premium', 'Impossible de vérifier le rôle administrateur.', error);
            return false;
        }
    }

    async getEntitlement(uid?: string): Promise<PremiumEntitlement | null> {
        const userId = uid ?? (await authService.getCurrentUser())?.uid;
        if (!userId || userId.startsWith('guest_')) return null;

        try {
            const snapshot = await getDoc(doc(db, 'premium_entitlements', userId));
            return snapshot.exists()
                ? toPremiumEntitlement(snapshot.data() as PremiumEntitlementDocument)
                : null;
        } catch (error) {
            LogService.warn('Premium', 'Impossible de lire le statut Premium.', error);
            return null;
        }
    }

    async hasActiveAccess(uid?: string): Promise<boolean> {
        return isPremiumActive(await this.getEntitlement(uid));
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
