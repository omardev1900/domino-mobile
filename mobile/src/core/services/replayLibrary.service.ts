import { httpsCallable } from 'firebase/functions';
import { gameFunctions } from './firebase';
import { GameState } from '../types';

export interface ReplaySummary {
    id: string;
    metadata: { endedAt: number; mode: 'SOLO' | 'MULTIPLAYER'; sourceId?: string; gameMode: string; winningCondition: number; opponents: string[] };
}
export interface SavedReplay { frames: GameState[]; localPlayerId: string; metadata: ReplaySummary['metadata'] }

export const savePurchasedReplay = async (requestId: string, localPlayerId: string, frames: GameState[], solo: boolean) =>
    (await httpsCallable<unknown, { replayId: string; savedCount: number }>(gameFunctions, 'savePurchasedReplay')({ requestId, localPlayerId, ...(solo ? { frames } : {}) })).data;
export const listSavedReplays = async () =>
    (await httpsCallable<undefined, { replays: ReplaySummary[] }>(gameFunctions, 'listSavedReplays')()).data.replays;
export const deleteSavedReplay = async (replayId: string) =>
    (await httpsCallable<{ replayId: string }, { savedCount: number }>(gameFunctions, 'deleteSavedReplay')({ replayId })).data;
export const openSavedReplay = async (replayId: string, requestId: string) =>
    (await httpsCallable<unknown, { replay: SavedReplay }>(gameFunctions, 'readSavedReplay')({ replayId })).data;
