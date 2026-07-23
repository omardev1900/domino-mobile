import { httpsCallable } from 'firebase/functions';
import { z } from 'zod';

import { gameFunctions } from './firebase';

const submitGameActionRequestSchema = z.object({
    roomId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
    expectedStateVersion: z.number().int().nonnegative(),
    expectedTurnId: z.number().int().nonnegative(),
    action: z.discriminatedUnion('type', [
        z.object({
            type: z.literal('PLAY_TILE'),
            dominoId: z.string().min(1).max(80),
            side: z.enum(['start', 'left', 'right']).optional(),
        }).strict(),
        z.object({ type: z.literal('PASS_TURN') }).strict(),
        z.object({ type: z.literal('SURRENDER') }).strict(),
    ]),
}).strict();

export type SubmitGameActionRequest = z.infer<typeof submitGameActionRequestSchema>;

export interface SubmitGameActionResponse {
    applied: boolean;
    reason?: 'ALREADY_APPLIED' | 'STALE';
    stateVersion: number;
    turnId: number;
    phase: string;
}

const submitGameActionCallable = httpsCallable<SubmitGameActionRequest, SubmitGameActionResponse>(
    gameFunctions,
    'submitGameAction'
);

export const submitGameAction = async (
    request: SubmitGameActionRequest
): Promise<SubmitGameActionResponse> => {
    const validated = submitGameActionRequestSchema.parse(request);
    const response = await submitGameActionCallable(validated);
    return response.data;
};
