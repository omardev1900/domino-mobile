import { httpsCallable } from 'firebase/functions';
import { auth, gameFunctions } from './firebase';
import { GameState } from '../types';

const ensureReplayAuth = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error('Connexion requise.');
    await user.getIdToken(true);
    return user;
};

export interface ReplaySummary {
    id: string;
    metadata: { endedAt: number; mode: 'SOLO' | 'MULTIPLAYER'; sourceId?: string; gameMode: string; winningCondition: number; opponents: string[] };
}
export interface SavedReplay { frames: GameState[]; localPlayerId: string; metadata: ReplaySummary['metadata'] }

export const savePurchasedReplay = async (requestId: string, localPlayerId: string, frames: GameState[], solo: boolean) => {
    await ensureReplayAuth();
    return (await httpsCallable<unknown, { replayId: string; savedCount: number }>(gameFunctions, 'savePurchasedReplay')({ requestId, localPlayerId, ...(solo ? { frames } : {}) })).data;
};
export const listSavedReplays = async () => {
    await ensureReplayAuth();
    return (await httpsCallable<undefined, { replays: ReplaySummary[] }>(gameFunctions, 'listSavedReplays')()).data.replays;
};
export const deleteSavedReplay = async (replayId: string) => {
    await ensureReplayAuth();
    return (await httpsCallable<{ replayId: string }, { savedCount: number }>(gameFunctions, 'deleteSavedReplay')({ replayId })).data;
};
export const openSavedReplay = async (replayId: string, requestId: string) =>
    (await httpsCallable<unknown, { replay: SavedReplay }>(gameFunctions, 'readSavedReplay')({ replayId })).data;
/** Relit un replay déjà acheté, sans créer une nouvelle ouverture facturée. */
export const readSavedReplay = async (replayId: string) =>
    (await ensureReplayAuth(), await httpsCallable<{ replayId: string }, { replay: SavedReplay }>(gameFunctions, 'readSavedReplay')({ replayId })).data;

export const getReplayCapacity = async () =>
    (await ensureReplayAuth(), await httpsCallable<undefined, { capacity: number; expiresAt: number[] }>(gameFunctions, 'getReplayCapacity')()).data;
export const buyReplaySlot = async (requestId: string) =>
    (await ensureReplayAuth(), await httpsCallable<unknown, { capacity: number; remainingCoins: number; expiresAt: number }>(gameFunctions, 'buyReplaySlot')({ requestId, acceptedCost: 3000 })).data;
