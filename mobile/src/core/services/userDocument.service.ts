import { doc, DocumentSnapshot, getDoc } from 'firebase/firestore';

import { db } from './firebase';

/**
 * Mutualise les lectures concurrentes de `users/{uid}` sans conserver de cache
 * après leur résolution. Firestore reste donc la source de vérité à chaque
 * nouveau cycle de synchronisation.
 */
class UserDocumentService {
    private readonly inFlight = new Map<string, Promise<DocumentSnapshot>>();

    get(uid: string): Promise<DocumentSnapshot> {
        const existing = this.inFlight.get(uid);
        if (existing) return existing;

        const request = getDoc(doc(db, 'users', uid));
        this.inFlight.set(uid, request);
        const cleanup = () => {
            if (this.inFlight.get(uid) === request) this.inFlight.delete(uid);
        };
        void request.then(cleanup, cleanup);
        return request;
    }
}

export const userDocumentService = new UserDocumentService();
