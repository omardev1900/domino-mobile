/**
 * Recursively removes undefined values before sending a plain object to
 * Firestore. Firestore rejects an entire write when a single nested property
 * is undefined.
 */
export function withoutUndefined<T>(value: T): T {
    if (Array.isArray(value)) {
        return value
            .filter((item) => item !== undefined)
            .map((item) => withoutUndefined(item)) as T;
    }

    if (
        value !== null &&
        typeof value === 'object' &&
        Object.getPrototypeOf(value) === Object.prototype
    ) {
        const cleanedEntries = Object.entries(value as Record<string, unknown>)
            .filter(([, nestedValue]) => nestedValue !== undefined)
            .map(([key, nestedValue]) => [key, withoutUndefined(nestedValue)]);

        return Object.fromEntries(cleanedEntries) as T;
    }

    return value;
}
