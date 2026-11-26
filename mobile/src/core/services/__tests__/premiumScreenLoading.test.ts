import { getDoc } from 'firebase/firestore';
import { authService } from '../auth.service';
import { premiumService } from '../premium.service';

jest.mock('firebase/firestore', () => ({ doc: jest.fn(), getDoc: jest.fn() }));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('../auth.service', () => ({ authService: { getCurrentUser: jest.fn() } }));
jest.mock('../firebase', () => ({ db: {}, gameFunctions: {}, readFirestoreWithTimeout: (_: string, read: () => Promise<unknown>) => read() }));
jest.mock('../LogService', () => ({ LogService: { warn: jest.fn() } }));
jest.mock('../perf', () => ({ perfEnd: jest.fn(), perfError: jest.fn(), perfStart: jest.fn() }));

beforeEach(() => jest.clearAllMocks());
it('lit le statut Premium confirmé', async () => {
    jest.mocked(authService.getCurrentUser).mockResolvedValue({ uid: 'player' } as never);
    const expiresAt = new Date('2030-01-01');
    jest.mocked(getDoc).mockResolvedValue({ exists: () => true, data: () => ({ expiresAt: { toDate: () => expiresAt }, source: 'SUBSCRIPTION' }) } as never);
    await expect(premiumService.getEntitlementForScreen()).resolves.toEqual({ expiresAt, source: 'SUBSCRIPTION' });
});
it('conserve la date d’utilisation après l’expiration de l’essai Premium', async () => {
    jest.mocked(authService.getCurrentUser).mockResolvedValue({ uid: 'player' } as never);
    const trialUsedAt = new Date('2026-01-01');
    const expiresAt = new Date('2026-01-04');
    jest.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({
            expiresAt: { toDate: () => expiresAt },
            source: 'TRIAL',
            trialUsedAt: { toDate: () => trialUsedAt },
        }),
    } as never);
    await expect(premiumService.getEntitlementForScreen()).resolves.toEqual({ expiresAt, source: 'TRIAL', trialUsedAt });
});
it('ne présente pas un joueur comme gratuit si Firestore échoue', async () => {
    jest.mocked(authService.getCurrentUser).mockResolvedValue({ uid: 'player' } as never);
    jest.mocked(getDoc).mockRejectedValue(new Error('Réseau indisponible'));
    await expect(premiumService.getEntitlementForScreen()).rejects.toThrow('Réseau indisponible');
});
