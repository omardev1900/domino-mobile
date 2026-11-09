export const LEAGUE_TIME_ZONE = 'America/Martinique';

const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: LEAGUE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
});

const dateParts = (date: Date): Record<string, number> => {
    const parts = formatter.formatToParts(date);
    return Object.fromEntries(
        parts
            .filter(part => part.type !== 'literal')
            .map(part => [part.type, Number(part.value)])
    );
};

export const getLeagueMonthKey = (timestamp: number | Date): string => {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const parts = dateParts(date);
    return `${parts.year}-${String(parts.month).padStart(2, '0')}`;
};

export const getStartOfLeagueMonth = (now: number): number => {
    const current = dateParts(new Date(now));
    const utcNoonOnFirst = Date.UTC(current.year, current.month - 1, 1, 12);
    const noonParts = dateParts(new Date(utcNoonOnFirst));
    const localNoonAsUtc = Date.UTC(
        noonParts.year,
        noonParts.month - 1,
        noonParts.day,
        noonParts.hour,
    );
    const offset = localNoonAsUtc - utcNoonOnFirst;
    return Date.UTC(current.year, current.month - 1, 1) - offset;
};

export const getPreviousLeagueMonthKey = (now: number): string => {
    const current = dateParts(new Date(now));
    const previous = new Date(Date.UTC(current.year, current.month - 2, 1));
    return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, '0')}`;
};
