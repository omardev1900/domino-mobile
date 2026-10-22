export interface HsvColor {
    hue: number;
    saturation: number;
    value: number;
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export function normalizeHexColor(value: string): string | null {
    const normalized = value.trim().replace(/^#/, '');
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
    return `#${normalized.toUpperCase()}`;
}

export function hsvToHex({ hue, saturation, value }: HsvColor): string {
    const h = ((hue % 360) + 360) % 360;
    const s = clamp(saturation);
    const v = clamp(value);
    const chroma = v * s;
    const segment = h / 60;
    const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
    const match = v - chroma;
    let red = 0;
    let green = 0;
    let blue = 0;

    if (segment < 1) [red, green, blue] = [chroma, secondary, 0];
    else if (segment < 2) [red, green, blue] = [secondary, chroma, 0];
    else if (segment < 3) [red, green, blue] = [0, chroma, secondary];
    else if (segment < 4) [red, green, blue] = [0, secondary, chroma];
    else if (segment < 5) [red, green, blue] = [secondary, 0, chroma];
    else [red, green, blue] = [chroma, 0, secondary];

    return `#${[red, green, blue]
        .map(channel => Math.round((channel + match) * 255).toString(16).padStart(2, '0'))
        .join('')}`.toUpperCase();
}

export function hexToHsv(value: string): HsvColor {
    const normalized = normalizeHexColor(value) ?? '#000000';
    const red = parseInt(normalized.slice(1, 3), 16) / 255;
    const green = parseInt(normalized.slice(3, 5), 16) / 255;
    const blue = parseInt(normalized.slice(5, 7), 16) / 255;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const delta = max - min;
    let hue = 0;

    if (delta !== 0) {
        if (max === red) hue = 60 * (((green - blue) / delta) % 6);
        else if (max === green) hue = 60 * ((blue - red) / delta + 2);
        else hue = 60 * ((red - green) / delta + 4);
    }

    return {
        hue: hue < 0 ? hue + 360 : hue,
        saturation: max === 0 ? 0 : delta / max,
        value: max,
    };
}
