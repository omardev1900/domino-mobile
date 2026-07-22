import { z } from 'zod';

/**
 * Schema for player names.
 * - Min 2 characters
 * - Max 20 characters
 * - Allows letters (incl. accents), numbers, spaces, and common name punctuation ( ' ’ - _ . )
 */
export const playerNameSchema = z
  .string()
  .min(2, "Le pseudo doit faire au moins 2 caractères")
  .max(20, "Le pseudo ne peut pas dépasser 20 caractères")
  .trim()
  .regex(/^[a-zA-Z0-9À-ÿ\s'’\-_.]+$/, "Seuls les lettres, chiffres, espaces et - _ . ' sont autorisés");

/**
 * Schema for room names.
 * - Min 3 characters
 * - Max 30 characters
 */
export const roomNameSchema = z
  .string()
  .trim()
  .superRefine((val, ctx) => {
    if (val.length > 0 && val.length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Le nom de la salle doit faire au moins 3 caractères",
      });
    }
    if (val.length > 30) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Le nom de la salle ne peut pas dépasser 30 caractères",
      });
    }
  });

/**
 * Schema for room creation/update
 */
export const roomConfigSchema = z.object({
  name: roomNameSchema,
});
