export type RtdbPresenceStatus = 'online' | 'offline';

export interface RtdbPresenceConnection {
    status?: string;
    t?: number;
}

export interface RtdbPlayerPresence {
    status?: string;
    t?: number;
    connections?: Record<string, RtdbPresenceConnection | null>;
}

export interface EffectivePlayerPresence {
    status: RtdbPresenceStatus;
    t: number;
}

const latestTimestamp = (records: RtdbPresenceConnection[]): number => records.reduce(
    (latest, record) => Math.max(latest, typeof record.t === 'number' ? record.t : 0),
    0
);

/**
 * Compatibilité de migration : l'ancienne présence directement sous l'UID reste
 * prise en compte tant qu'un ancien client peut encore l'écrire. Une seule
 * connexion active suffit à garder le joueur en ligne.
 */
export const getEffectivePlayerPresence = (
    presence: RtdbPlayerPresence | null | undefined
): EffectivePlayerPresence => {
    if (!presence) return { status: 'offline', t: 0 };

    const records: RtdbPresenceConnection[] = [];
    if (presence.status === 'online' || presence.status === 'offline') {
        records.push({ status: presence.status, t: presence.t });
    }
    Object.values(presence.connections ?? {}).forEach(connection => {
        if (connection?.status === 'online' || connection?.status === 'offline') {
            records.push(connection);
        }
    });

    const onlineConnections = records.filter(record => record.status === 'online');
    if (onlineConnections.length > 0) {
        return { status: 'online', t: latestTimestamp(onlineConnections) };
    }

    return { status: 'offline', t: latestTimestamp(records) };
};
