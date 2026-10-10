import { getEffectivePlayerPresence } from '../presenceConnections';

describe('getEffectivePlayerPresence', () => {
    it('préserve la nouvelle connexion quand le onDisconnect de l’ancienne supprime seulement son nœud', () => {
        const beforeOldDisconnect = {
            connections: {
                oldConnection: { status: 'online', t: 100 },
                newConnection: { status: 'online', t: 200 },
            },
        };
        const afterOldDisconnect = {
            connections: {
                newConnection: { status: 'online', t: 200 },
            },
        };

        expect(getEffectivePlayerPresence(beforeOldDisconnect)).toEqual({ status: 'online', t: 200 });
        expect(getEffectivePlayerPresence(afterOldDisconnect)).toEqual({ status: 'online', t: 200 });
    });

    it('considère le joueur en ligne tant qu’une connexion parallèle est active', () => {
        expect(getEffectivePlayerPresence({
            connections: {
                phone: { status: 'offline', t: 100 },
                tablet: { status: 'online', t: 200 },
            },
        })).toEqual({ status: 'online', t: 200 });
    });

    it('déclare le joueur hors ligne quand la dernière connexion a disparu', () => {
        expect(getEffectivePlayerPresence({ connections: {} })).toEqual({ status: 'offline', t: 0 });
        expect(getEffectivePlayerPresence(null)).toEqual({ status: 'offline', t: 0 });
    });

    it('lit encore le format historique durant la migration', () => {
        expect(getEffectivePlayerPresence({ status: 'online', t: 42 })).toEqual({ status: 'online', t: 42 });
        expect(getEffectivePlayerPresence({ status: 'offline', t: 43 })).toEqual({ status: 'offline', t: 43 });
    });
});
