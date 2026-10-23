import { getDoc } from 'firebase/firestore';

import { userDocumentService } from '../userDocument.service';

jest.mock('firebase/firestore', () => ({
    doc: jest.fn((_db, collection, uid) => `${collection}/${uid}`),
    getDoc: jest.fn(),
}));
jest.mock('../firebase', () => ({ db: {} }));

describe('UserDocumentService', () => {
    beforeEach(() => jest.clearAllMocks());

    it('mutualise deux lectures concurrentes du même utilisateur', async () => {
        let resolveRead: (value: unknown) => void = () => {};
        const pending = new Promise(resolve => { resolveRead = resolve; });
        (getDoc as jest.Mock).mockReturnValue(pending);

        const first = userDocumentService.get('user-1');
        const second = userDocumentService.get('user-1');

        expect(first).toBe(second);
        expect(getDoc).toHaveBeenCalledTimes(1);
        resolveRead({ exists: () => true });
        await Promise.all([first, second]);
    });

    it('relit Firestore après la résolution du cycle précédent', async () => {
        (getDoc as jest.Mock).mockResolvedValue({ exists: () => true });
        await userDocumentService.get('user-2');
        await userDocumentService.get('user-2');
        expect(getDoc).toHaveBeenCalledTimes(2);
    });
});
