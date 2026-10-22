import { hexToHsv, hsvToHex, normalizeHexColor } from '../color.utils';

describe('Premium workshop color utilities', () => {
    it('normalizes valid six-digit hex colors', () => {
        expect(normalizeHexColor(' 18391e ')).toBe('#18391E');
        expect(normalizeHexColor('#A6674C')).toBe('#A6674C');
    });

    it('rejects incomplete or invalid colors', () => {
        expect(normalizeHexColor('#123')).toBeNull();
        expect(normalizeHexColor('#GG0000')).toBeNull();
    });

    it.each(['#18391E', '#F8E9D2', '#1F2430', '#FFD700', '#FFFFFF', '#000000'])(
        'round-trips %s through HSV',
        color => {
            expect(hsvToHex(hexToHsv(color))).toBe(color);
        },
    );

    it('clamps saturation and value and wraps hue', () => {
        expect(hsvToHex({ hue: 360, saturation: 2, value: 2 })).toBe('#FF0000');
        expect(hsvToHex({ hue: -120, saturation: 1, value: 1 })).toBe('#0000FF');
    });
});
