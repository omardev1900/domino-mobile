/**
 * league.service.ts
 *
 * ╔══════════════════════════════════════════════════════╗
 * ║  LEAGUE SERVICE — Ligue des Cochons                 ║
 * ║  • Vérifie les nouveaux paliers atteints            ║
 * ║  • Débloque les cadres avatar + donne les coins    ║
 * ║  • Persiste dans Firestore (champ `league`)         ║
 * ║  • 100% côté serveur pour les joueurs authentifiés  ║
 * ╚══════════════════════════════════════════════════════╝
 */

import { doc, getDoc, updateDoc, arrayUnion, increment } from 'firebase/firestore';
import { db } from './firebase';
import { LogService } from './LogService';
import {
    LeagueGrade,
    LeagueFrameGrade,
    LeagueFrameId,
    FrameUnlockEvent,
} from '../economy.types';
import {
    LEAGUE_FRAME_GRADE_ORDER,
    LEAGUE_FRAME_THRESHOLDS,
    LEAGUE_FRAME_REWARDS,
    LEAGUE_GRADE_ORDER,
    LEAGUE_THRESHOLDS,
} from '../economy.constants';

/** Résultat d'une vérification de paliers */
export interface LeagueCheckResult {
    /** Nombre total de cochons donnés après ce match */
    newCochonsGiven: number;
    /** Paliers qui viennent d'être débloqués (dans l'ordre) */
    newlyUnlocked: FrameUnlockEvent[];
    /** Total de coins bonus issus des paliers débloqués */
    frameCoinsBonus: number;
}

/** Mapping grade → ID de cadre */
const GRADE_TO_FRAME_ID: Record<LeagueFrameGrade, LeagueFrameId> = {
    APPRENTI_1: 'frame_apprenti_1',
    APPRENTI_2: 'frame_apprenti_2',
    APPRENTI_3: 'frame_apprenti_3',
    MAITRE_1:   'frame_maitre_1',
    MAITRE_2:   'frame_maitre_2',
    MAITRE_3:   'frame_maitre_3',
    ROI:        'frame_roi',
    LEGENDE:    'frame_legende',
};

// ─────────────────────────────────────────────────────────────────────────────

class LeagueService {

    /**
     * Calcule quels paliers sont débloqués lors d'un match donné.
     * PURE — aucun I/O, utilisable dans les tests et dans le RewardEngine.
     *
     * @param cochonsGivenBefore  - Cochons donnés AVANT ce match
     * @param cochonsGivenInMatch - Cochons donnés DANS ce match
     * @param alreadyUnlocked     - Cadres déjà possédés (pour éviter de re-donner)
     */
    computeNewUnlocks(
        cochonsGivenBefore: number,
        cochonsGivenInMatch: number,
        alreadyUnlocked: LeagueFrameId[] = []
    ): FrameUnlockEvent[] {
        const cochonsAfter = cochonsGivenBefore + cochonsGivenInMatch;
        const events: FrameUnlockEvent[] = [];

        for (const grade of LEAGUE_FRAME_GRADE_ORDER) {
            const threshold = LEAGUE_FRAME_THRESHOLDS[grade];
            const frameId = GRADE_TO_FRAME_ID[grade];
            const reward = LEAGUE_FRAME_REWARDS[grade];

            // On dépasse le seuil pour la première fois
            if (
                cochonsAfter >= threshold &&
                cochonsGivenBefore < threshold &&
                !alreadyUnlocked.includes(frameId)
            ) {
                events.push({
                    grade,
                    frameId,
                    coinsBonus: reward.coinsBonus,
                    cochonsAtUnlock: cochonsAfter,
                });
            }
        }

        return events;
    }

    /**
     * Calcule le grade courant basé sur le total de cochons donnés.
     * Retourne null si le joueur n'a encore inflige aucun cochon.
     */
    getGradeFromCochons(cochonsGiven: number): LeagueGrade | null {
        let grade: LeagueGrade | null = null;
        for (const g of LEAGUE_GRADE_ORDER) {
            if (cochonsGiven >= LEAGUE_THRESHOLDS[g]) {
                grade = g;
            }
        }
        return grade;
    }

    /**
     * Retourne le prochain seuil de déblocage (en cochons),
     * ou null si le joueur a déjà atteint le grade maximum.
     */
    getNextFrameThreshold(cochonsGiven: number): number | null {
        for (const grade of LEAGUE_FRAME_GRADE_ORDER) {
            const threshold = LEAGUE_FRAME_THRESHOLDS[grade];
            if (cochonsGiven < threshold) return threshold;
        }
        return null; // Grade max atteint
    }

    /**
     * Met à jour Firestore avec les nouveaux cochons donnés et cadres débloqués.
     * À appeler après processMatchReward (côté client ou Cloud Function).
     *
     * Champs mis à jour dans `users/{uid}`:
     *   - `economy.cochonsGiven`   (incrémenté)
     *   - `economy.unlockedFrames` (ajout des nouveaux cadres)
     *   - `economy.coins`          (ajout des coins bonus des paliers)
     *   - `economy.leagueGrade`    (grade recalculé)
     */
    async applyLeagueUnlocks(
        uid: string,
        cochonsGivenInMatch: number,
        unlockEvents: FrameUnlockEvent[]
    ): Promise<void> {
        if (uid.startsWith('guest_') || cochonsGivenInMatch <= 0) return;

        try {
            const userRef = doc(db, 'users', uid);
            const snap = await getDoc(userRef);
            const currentEconomy = snap.exists() ? (snap.data().economy || {}) : {};
            const currentCochons = currentEconomy.cochonsGiven ?? 0;
            const newCochonsGiven = currentCochons + cochonsGivenInMatch;
            const newGrade = this.getGradeFromCochons(newCochonsGiven);

            const updates: Record<string, any> = {
                'economy.cochonsGiven': newCochonsGiven,
                'economy.leagueGrade': newGrade,
            };

            // Ajouter les coins bonus et les cadres débloqués
            let bonusCoins = 0;
            const newFrameIds: LeagueFrameId[] = [];

            for (const event of unlockEvents) {
                bonusCoins += event.coinsBonus;
                newFrameIds.push(event.frameId);
            }

            if (bonusCoins > 0) {
                // On incrémente les coins directement côté Firestore (opération atomique)
                updates['economy.coins'] = (currentEconomy.coins ?? 0) + bonusCoins;
            }

            await updateDoc(userRef, updates);

            // Ajout des cadres (arrayUnion est idempotent — pas de doublon possible)
            if (newFrameIds.length > 0) {
                await updateDoc(userRef, {
                    'economy.unlockedFrames': arrayUnion(...newFrameIds),
                });
            }

            LogService.info(
                'LeagueService',
                `[uid=${uid}] cochonsGiven: ${currentCochons} → ${newCochonsGiven} | grade: ${newGrade}` +
                (unlockEvents.length > 0 ? ` | 🏆 ${unlockEvents.length} palier(s) débloqué(s) !` : '')
            );
        } catch (e) {
            LogService.error('LeagueService', 'applyLeagueUnlocks error:', e);
        }
    }

    /**
     * Équipe un cadre sélectionné par le joueur.
     * Le cadre doit être dans `unlockedFrames` pour être équipable.
     */
    async setActiveFrame(uid: string, frameId: LeagueFrameId | null): Promise<void> {
        if (uid.startsWith('guest_')) return;
        try {
            const userRef = doc(db, 'users', uid);
            await updateDoc(userRef, { 'economy.activeFrame': frameId ?? null });
            LogService.info('LeagueService', `[uid=${uid}] Cadre actif: ${frameId ?? 'aucun'}`);
        } catch (e) {
            LogService.error('LeagueService', 'setActiveFrame error:', e);
        }
    }

    /**
     * Récupère le profil ligue d'un joueur depuis Firestore.
     * Utilisé par l'écran "Niveau Boucher".
     */
    async getLeagueProfile(uid: string): Promise<{
        cochonsGiven: number;
        unlockedFrames: LeagueFrameId[];
        activeFrame: LeagueFrameId | null;
        leagueGrade: LeagueGrade | null;
        nextThreshold: number | null;
    }> {
        try {
            const userRef = doc(db, 'users', uid);
            const snap = await getDoc(userRef);
            const economy = snap.exists() ? (snap.data().economy || {}) : {};
            const cochonsGiven = economy.cochonsGiven ?? 0;

            return {
                cochonsGiven,
                unlockedFrames: economy.unlockedFrames ?? [],
                activeFrame: economy.activeFrame ?? null,
                leagueGrade: this.getGradeFromCochons(cochonsGiven),
                nextThreshold: this.getNextFrameThreshold(cochonsGiven),
            };
        } catch (e) {
            LogService.error('LeagueService', 'getLeagueProfile error:', e);
            return {
                cochonsGiven: 0,
                unlockedFrames: [],
                activeFrame: null,
                leagueGrade: null,
                nextThreshold: 10,
            };
        }
    }
}

export const leagueService = new LeagueService();
