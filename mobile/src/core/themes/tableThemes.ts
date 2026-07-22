export type TableTheme = 'classic' | 'modern' | 'luxury' | 'tropical';

export interface TableThemeColors {
    background: string;
    border: string;
    felt: string;
}

export const TABLE_THEMES: Record<TableTheme, TableThemeColors> = {
    classic: {
        background: '#1a2e1a', // Dark green background
        border: '#8B4513', // Brown wood border
        felt: '#35654d', // Classic green felt
    },
    modern: {
        background: '#1a1a2e', // Dark blue background
        border: '#16213e', // Navy border
        felt: '#0f3460', // Modern blue felt
    },
    luxury: {
        background: '#1a0f0f', // Dark burgundy background
        border: '#8B0000', // Dark red border
        felt: '#4a1a1a', // Luxury burgundy felt
    },
    tropical: {
        background: '#0a1a0f', // Very dark green background
        border: '#5d4037', // Exotic wood border (Sapele)
        felt: '#2e7d32', // Vibrant tropical green
    },
};
