import { BOT_CATALOG, selectBots } from '../botCatalog';
import type { BotDifficulty, BotProfile } from '../botCatalog';

export { BOT_CATALOG };
export type { BotDifficulty, BotProfile };

class BotService {
    getBotsForLevel(level: BotDifficulty, count: number = 2): Promise<BotProfile[]> {
        return Promise.resolve(selectBots(level, count));
    }

    getLocalBotsForLevel(level: BotDifficulty, count: number = 2): BotProfile[] {
        return selectBots(level, count);
    }
}

export const botService = new BotService();

const DIFFICULTY_ORDER: BotDifficulty[] = ['TI_MANMAY', 'MAPIPI', 'GRAN_MOUN', 'METKAYALI'];

export const GRADE_FLOOR_BOTS: Record<string, BotDifficulty[]> = {
    null: ['TI_MANMAY', 'TI_MANMAY'],
    DEBUTANT: ['TI_MANMAY', 'TI_MANMAY'],
    APPRENTI_1: ['TI_MANMAY', 'TI_MANMAY'],
    APPRENTI_2: ['TI_MANMAY', 'MAPIPI'],
    APPRENTI_3: ['MAPIPI', 'MAPIPI'],
    MAITRE_1: ['MAPIPI', 'GRAN_MOUN'],
    MAITRE_2: ['MAPIPI', 'GRAN_MOUN'],
    MAITRE_3: ['GRAN_MOUN', 'GRAN_MOUN'],
    ROI: ['GRAN_MOUN', 'METKAYALI'],
    LEGENDE: ['METKAYALI', 'METKAYALI'],
};

export function getFloorLevel(grade: string | null): BotDifficulty {
    const floor = GRADE_FLOOR_BOTS[grade ?? 'null'] ?? ['TI_MANMAY', 'TI_MANMAY'];
    const idx = Math.max(DIFFICULTY_ORDER.indexOf(floor[0]), DIFFICULTY_ORDER.indexOf(floor[1]));
    return DIFFICULTY_ORDER[Math.max(0, idx)];
}

export function isLevelAllowed(grade: string | null, level: BotDifficulty): boolean {
    return DIFFICULTY_ORDER.indexOf(level) >= DIFFICULTY_ORDER.indexOf(getFloorLevel(grade));
}

export async function getBotsForGrade(grade: string | null, chosenLevel?: BotDifficulty): Promise<BotProfile[]> {
    const floor = getFloorLevel(grade);
    const level = chosenLevel && isLevelAllowed(grade, chosenLevel) ? chosenLevel : floor;
    return botService.getBotsForLevel(level, 2);
}
