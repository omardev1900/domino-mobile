import { describeMultiplayerJoinError } from '../describeMultiplayerJoinError';

describe('describeMultiplayerJoinError', () => {
    it('explains that a full table cannot be joined', () => {
        expect(describeMultiplayerJoinError(new Error('Impossible de rejoindre : la table est complete.')))
            .toBe('Cette table est complète : elle accueille déjà 3 joueurs.');
    });

    it('does not expose a raw unknown Firebase error to the player', () => {
        expect(describeMultiplayerJoinError(new Error('internal')))
            .toBe('Impossible de rejoindre cette table pour le moment. Réessayez dans un instant.');
    });
});
