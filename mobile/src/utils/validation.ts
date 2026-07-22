import { z } from 'zod';

/**
 * Validation schemas for the application using Zod
 * (Sprint 3-12)
 */

export const PlayerProfileSchema = z.object({
    displayName: z.string()
        .min(2, "Le nom doit contenir au moins 2 caractères")
        .max(20, "Le nom ne doit pas dépasser 20 caractères")
        .regex(/^[a-zA-Z0-9_\- ]+$/, "Le nom contient des caractères non autorisés"),
    email: z.string().email().optional().or(z.literal('')),
    avatarId: z.string().optional(),
});

export const RoomCreationSchema = z.object({
    roomName: z.string()
        .min(3, "Le nom de la salle doit contenir au moins 3 caractères")
        .max(30, "Le nom de la salle ne doit pas dépasser 30 caractères"),
    passcode: z.string().length(4, "Le code doit faire 4 chiffres").regex(/^\d+$/, "Le code doit être numérique").optional(),
    winningCondition: z.number().int().min(1).max(500),
    turnDuration: z.number().int().min(5).max(120),
    startingHandSize: z.number().int().min(6).max(9),
    buyIn: z.number().int().min(0).max(1000).optional(),
});

export type ValidatedPlayerProfile = z.infer<typeof PlayerProfileSchema>;
export type ValidatedRoomCreation = z.infer<typeof RoomCreationSchema>;
