import { collection, getDocs, query, where, addDoc, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export type BotDifficulty = 'TI_MANMAY' | 'MAPIPI' | 'GRAN_MOUN' | 'METKAYALI';

export interface BotProfile {
    id: string;
    name: string;
    avatarId: string;
    imageUrl?: string;
    difficulty: BotDifficulty;
}

export const LOCAL_BOTS_FALLBACK: Record<BotDifficulty, BotProfile[]> = {
    'TI_MANMAY': [
        { id: 'bot_ti_1', name: 'Ti-Sonson', avatarId: 'avatar_ti_sonson', difficulty: 'TI_MANMAY' }
    ],
    'MAPIPI': [
        { id: 'bot_mapipi_1', name: 'Dédé', avatarId: 'avatar_dede', difficulty: 'MAPIPI' }
    ],
    'GRAN_MOUN': [
        { id: 'bot_gran_1', name: 'Tonton-Léon', avatarId: 'avatar_tonton_leon', difficulty: 'GRAN_MOUN' }
    ],
    'METKAYALI': [
        { id: 'bot_mk_1', name: 'Man-Diab', avatarId: 'avatar_bot_07', difficulty: 'METKAYALI' },
        { id: 'bot_mk_2', name: 'Papa-Zombi', avatarId: 'avatar_bot_08', difficulty: 'METKAYALI' },
    ],
};

class BotService {
    async getBotsForLevel(level: BotDifficulty, count: number = 2): Promise<BotProfile[]> {
        // Fallback de sécurité immédiat si le niveau n'existe pas localement (prévention crash absolu)
        const localPool = LOCAL_BOTS_FALLBACK[level];
        if (!localPool || !Array.isArray(localPool)) {
            console.error(`[BotService] Niveau invalide ou pool local corrompu pour: ${level}`);
            return [];
        }

        try {
            const botsRef = collection(db, 'bots');
            const q = query(botsRef, where('difficulty', '==', level));
            const querySnapshot = await getDocs(q);

            const botsFromDb: BotProfile[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                botsFromDb.push({
                    id: doc.id,
                    name: data.name,
                    avatarId: data.avatarId,
                    imageUrl: data.imageUrl,
                    difficulty: data.difficulty
                } as BotProfile);
            });

            // 1. Dédoublonnage et surchage : Les bots Remote écrasent les Locaux ayant le même ID
            const localBots = [...LOCAL_BOTS_FALLBACK[level]];
            const mergedBotsMap = new Map<string, BotProfile>();

            // On met les locaux en premier
            localBots.forEach(bot => mergedBotsMap.set(bot.id, bot));
            // On surcharge par les distants (remplace ou ajoute)
            botsFromDb.forEach(bot => mergedBotsMap.set(bot.id, bot));

            const allAvailableBots = Array.from(mergedBotsMap.values());

            // Vérification de sécurité supplémentaire sur la liste finale
            if (!allAvailableBots || allAvailableBots.length === 0) {
                console.warn(`[BotService] Pas de bots fusionnés trouvés pour ${level}. Utilisation du fallback strict.`);
                return this.getRandomBots(LOCAL_BOTS_FALLBACK[level] || [], count);
            }

            return this.getRandomBots(allAvailableBots, count);

        } catch (error) {
            console.error('[BotService] Error fetching bots from Firestore:', error);
            // Fallback ultime en cas d'erreur réseau
            console.warn(`[BotService] Réseau défaillant. Utilisation exclusive du pool local pour ${level}`);
            return this.getRandomBots(LOCAL_BOTS_FALLBACK[level], count);
        }
    }

    private getRandomBots(bots: BotProfile[], count: number): BotProfile[] {
        // Sécurité absolue : si le tableau est invalide, on retourne un tableau vide pour ne pas crasher
        if (!bots || !Array.isArray(bots) || bots.length === 0) {
            console.error('[BotService] Erreur critique : bots manquant ou invalide. Fallback vide retourné.');
            return [];
        }

        const shuffled = [...bots].sort(() => 0.5 - Math.random());
        // Sécurité si count est plus grand que le pool disponible
        return shuffled.slice(0, Math.min(count, bots.length));
    }

    /**
     * Bouton Magique : Injecte les bots locaux dans Firestore s'ils n'existent pas.
     */
    async seedDatabase(): Promise<number> {
        let addedCount = 0;
        try {
            console.log('[BotService] Début de l\'injection (Seeding) vers Firestore...');
            const botsRef = collection(db, 'bots');

            for (const [level, bots] of Object.entries(LOCAL_BOTS_FALLBACK)) {
                for (const bot of bots) {
                    // Vérifier si le bot existe déjà par ID
                    const q = query(botsRef, where('id', '==', bot.id));
                    const snapshot = await getDocs(q);

                    if (snapshot.empty) {
                        // On force le document à avoir le même ID que le bot local (optionnel, mais propre)
                        // ou on le laisse générer un ID, mais pour surcharge on préfère setDoc avec l'ID du bot
                        // Pour l'interface existante, on l'ajoute avec l'ID natif
                        await addDoc(botsRef, bot);
                        console.log(`[BotService] Bot ajouté : ${bot.name} (${level})`);
                        addedCount++;
                    } else {
                        console.log(`[BotService] Bot existant, ignoré : ${bot.name}`);
                    }
                }
            }
            console.log(`[BotService] Seeding terminé. ${addedCount} bots insérés.`);
        } catch (error) {
            console.error('[BotService] Erreur lors du seeding :', error);
        }
        return addedCount;
    }
}

export const botService = new BotService();

// ─── Logique adaptative — Grade → Niveau plancher ────────────────────────────

/**
 * Retourne le niveau plancher (difficulté minimale) pour un grade donné.
 * Le joueur peut choisir un niveau supérieur, jamais inférieur.
 */
export const GRADE_FLOOR_BOTS: Record<string, BotDifficulty[]> = {
    'null':      ['TI_MANMAY', 'TI_MANMAY'],
    'DEBUTANT':  ['TI_MANMAY', 'TI_MANMAY'],
    'APPRENTI_1': ['TI_MANMAY', 'TI_MANMAY'],
    'APPRENTI_2': ['TI_MANMAY', 'MAPIPI'],
    'APPRENTI_3': ['MAPIPI',    'MAPIPI'],
    'MAITRE_1':   ['MAPIPI',    'GRAN_MOUN'],
    'MAITRE_2':   ['MAPIPI',    'GRAN_MOUN'],
    'MAITRE_3':   ['GRAN_MOUN', 'GRAN_MOUN'],
    'ROI':        ['GRAN_MOUN', 'METKAYALI'],
    'LEGENDE':    ['METKAYALI', 'METKAYALI'],
};

const DIFFICULTY_ORDER: BotDifficulty[] = ['TI_MANMAY', 'MAPIPI', 'GRAN_MOUN', 'METKAYALI'];

/**
 * Retourne le niveau plancher pour un grade donné.
 */
export function getFloorLevel(grade: string | null): BotDifficulty {
    const key = grade ?? 'null';
    const floor = GRADE_FLOOR_BOTS[key] ?? ['TI_MANMAY', 'TI_MANMAY'];
    // Le plancher = le niveau le plus élevé des deux bots par défaut
    const idx = Math.max(
        DIFFICULTY_ORDER.indexOf(floor[0]),
        DIFFICULTY_ORDER.indexOf(floor[1])
    );
    return DIFFICULTY_ORDER[Math.max(0, idx)];
}

/**
 * Vérifie si un niveau est jouable pour un grade donné (>= plancher).
 */
export function isLevelAllowed(grade: string | null, level: BotDifficulty): boolean {
    const floorIdx = DIFFICULTY_ORDER.indexOf(getFloorLevel(grade));
    const levelIdx = DIFFICULTY_ORDER.indexOf(level);
    return levelIdx >= floorIdx;
}

/**
 * Charge les 2 bots adaptés au niveau choisi par le joueur.
 * Si aucun niveau n'est fourni, utilise le plancher du grade.
 */
export async function getBotsForGrade(
    grade: string | null,
    chosenLevel?: BotDifficulty
): Promise<BotProfile[]> {
    const floor = getFloorLevel(grade);
    const level = chosenLevel ?? floor;

    // Sécurité : jamais en dessous du plancher
    const floorIdx = DIFFICULTY_ORDER.indexOf(floor);
    const levelIdx = DIFFICULTY_ORDER.indexOf(level);
    const safeLevel = levelIdx >= floorIdx ? level : floor;

    return botService.getBotsForLevel(safeLevel, 2);
}
