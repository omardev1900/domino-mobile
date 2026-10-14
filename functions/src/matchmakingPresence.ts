import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

export const MATCHMAKING_DISCONNECT_GRACE_MS = 5_000;

type MatchmakingRoot = {
    connections?: Record<string, Record<string, unknown> | null>;
    availableUsers?: Record<string, true | null>;
    public?: { availableCount?: number };
};

const hasConnection = (value: Record<string, unknown> | null | undefined): boolean =>
    Object.values(value ?? {}).some(connection => connection !== null);

export const applyAvailabilityForUser = (
    current: MatchmakingRoot | null,
    userId: string,
): MatchmakingRoot | null => {
    if (!current) return current;
    const userIsConnected = hasConnection(current.connections?.[userId]);
    const userWasAvailable = current.availableUsers?.[userId] === true;
    if (userIsConnected === userWasAvailable) return current;

    const availableUsers = { ...(current.availableUsers ?? {}) };
    if (userIsConnected) availableUsers[userId] = true;
    else delete availableUsers[userId];

    const currentCount = Math.max(0, current.public?.availableCount ?? 0);
    const availableCount = userIsConnected ? currentCount + 1 : Math.max(0, currentCount - 1);
    return {
        ...current,
        availableUsers,
        public: { ...(current.public ?? {}), availableCount },
    };
};

export const syncMatchmakingAvailability = async (
    database: admin.database.Database,
    userId: string,
): Promise<void> => {
    await database.ref('matchmakingAvailability').transaction(current =>
        applyAvailabilityForUser(current as MatchmakingRoot | null, userId),
    );
};

export const createMatchmakingPresenceCoordinator = (database: admin.database.Database) =>
    functions.database
        .ref('matchmakingAvailability/connections/{userId}/{connectionId}')
        .onWrite(async (change, context) => {
            const connectionsRef = database.ref(`matchmakingAvailability/connections/${context.params.userId}`);
            const connectionsSnapshot = await connectionsRef.once('value');
            if (!hasConnection(connectionsSnapshot.val())) {
                await new Promise(resolve => setTimeout(resolve, MATCHMAKING_DISCONNECT_GRACE_MS));
            }
            await syncMatchmakingAvailability(database, context.params.userId);
        });
