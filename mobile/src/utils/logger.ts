/**
 * Utility for filtered logging based on environment.
 * Prevents performance drag from excessive logging in production.
 */

// React Native global __DEV__ is true in development, false in production
declare const __DEV__: boolean;

export const logger = {
    log: (...args: any[]) => {
        if (__DEV__) {
            console.log("[DEBUG]", ...args);
        }
    },
    warn: (...args: any[]) => {
        if (__DEV__) {
            console.warn("[WARN]", ...args);
        }
    },
    error: (...args: any[]) => {
        // We might want to keep errors even in production, 
        // or send them to a crash reporting service.
        console.error("[ERROR]", ...args);
    },
    info: (...args: any[]) => {
        if (__DEV__) {
            console.info("[INFO]", ...args);
        }
    }
};
