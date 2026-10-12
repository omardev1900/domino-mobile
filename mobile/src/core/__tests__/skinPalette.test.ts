import { resolveDominoSidePalette } from '../skinPalette';
import { STORE_CATALOG } from '../store.constants';

describe('resolveDominoSidePalette', () => {
    it('keeps a legacy skin on its single background and dot colors', () => {
        const palette = resolveDominoSidePalette(4, {
            tableBackgroundColor: '#123456',
            dominoBackgroundColor: '#f8f4e8',
            dominoDotColor: '#1a1a1a',
            dominoLineColor: '#111111',
        });

        expect(palette).toEqual({
            backgroundColor: '#f8f4e8',
            dotColor: '#1a1a1a',
        });
    });

    it('uses the Premium palette for each value and preserves white dots on six', () => {
        const skin = STORE_CATALOG.find(item => item.id === 'skin_premium_spectrum');
        expect(skin?.skinConfig).toBeDefined();

        expect(resolveDominoSidePalette(2, skin?.skinConfig)).toEqual({
            backgroundColor: '#118AB2',
            dotColor: '#1E1E1E',
        });
        expect(resolveDominoSidePalette(6, skin?.skinConfig)).toEqual({
            backgroundColor: '#732C7B',
            dotColor: '#FFFFFF',
        });
    });
});
