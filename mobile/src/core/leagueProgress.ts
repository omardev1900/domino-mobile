import { LEAGUE_GRADE_ORDER, LEAGUE_LABELS, LEAGUE_THRESHOLDS } from './economy.constants';
import { LeagueGrade } from './economy.types';
import { getStartOfCurrentMonthUtc } from './services/leaderboard.time';

type MatchHistoryEntry = {
    timestamp?: number;
    cochons?: number;
};

export interface LeagueProgressSnapshot {
    points: number;
    grade: LeagueGrade | null;
    previousThreshold: number;
    currentThreshold: number;
    nextThreshold: number | null;
    nextGrade: LeagueGrade | null;
    progressPercent: number;
    remainingToNext: number;
    isMaxGrade: boolean;
}

export function getMonthlyCochonsFromHistory(
    matchHistory: MatchHistoryEntry[] = [],
    now: Date = new Date()
): number {
    const startOfMonth = getStartOfCurrentMonthUtc(now);
    return matchHistory
        .filter((record) => (record.timestamp ?? 0) >= startOfMonth)
        .reduce((sum, record) => sum + (record.cochons ?? 0), 0);
}

export function getLeagueGradeFromPoints(points: number): LeagueGrade | null {
    let grade: LeagueGrade | null = null;
    for (const candidate of LEAGUE_GRADE_ORDER) {
        if (points >= LEAGUE_THRESHOLDS[candidate]) {
            grade = candidate;
        }
    }
    return grade;
}

export function getLeagueProgress(points: number): LeagueProgressSnapshot {
    const safePoints = Math.max(0, points);
    const grade = getLeagueGradeFromPoints(safePoints);

    if (grade === null) {
        const nextGrade = LEAGUE_GRADE_ORDER[0];
        const nextThreshold = LEAGUE_THRESHOLDS[nextGrade];
        return {
            points: safePoints,
            grade: null,
            previousThreshold: 0,
            currentThreshold: 0,
            nextThreshold,
            nextGrade,
            progressPercent: Math.min(1, safePoints / Math.max(nextThreshold, 1)),
            remainingToNext: Math.max(0, nextThreshold - safePoints),
            isMaxGrade: false,
        };
    }

    const gradeIndex = LEAGUE_GRADE_ORDER.indexOf(grade);
    const previousThreshold = gradeIndex > 0 ? LEAGUE_THRESHOLDS[LEAGUE_GRADE_ORDER[gradeIndex - 1]] : 0;
    const currentThreshold = LEAGUE_THRESHOLDS[grade];
    const nextGrade = gradeIndex < LEAGUE_GRADE_ORDER.length - 1 ? LEAGUE_GRADE_ORDER[gradeIndex + 1] : null;
    const nextThreshold = nextGrade ? LEAGUE_THRESHOLDS[nextGrade] : null;

    if (nextThreshold === null) {
        return {
            points: safePoints,
            grade,
            previousThreshold,
            currentThreshold,
            nextThreshold: null,
            nextGrade: null,
            progressPercent: 1,
            remainingToNext: 0,
            isMaxGrade: true,
        };
    }

    return {
        points: safePoints,
        grade,
        previousThreshold,
        currentThreshold,
        nextThreshold,
        nextGrade,
        progressPercent: Math.min(
            1,
            Math.max(0, (safePoints - previousThreshold) / Math.max(nextThreshold - previousThreshold, 1))
        ),
        remainingToNext: Math.max(0, nextThreshold - safePoints),
        isMaxGrade: false,
    };
}

export function getLeagueGradeLabel(grade: LeagueGrade | null): string {
    return grade ? LEAGUE_LABELS[grade] : 'Sans grade';
}
