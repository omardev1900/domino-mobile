/* eslint-disable import/first, @typescript-eslint/no-require-imports */
import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('expo-image', () => ({
    Image: jest.fn(() => null),
}));

const { Image: ExpoImage } = require('expo-image');
const PREMIUM_AVATAR_ASSET = require('../../../assets/images/avatars/premium/avatar_premium_cochon_dore.jpg');
const SKIN_WORKSHOP_ASSET = require('../../../assets/images/store/atelier-des-skins.jpg');

import { StoreItemPreview } from '../StoreItemPreview';
import { STORE_CATALOG } from '../../../core/store.constants';

const lastImageSource = () => {
    const calls = (ExpoImage as jest.Mock).mock.calls;
    return calls[calls.length - 1]?.[0]?.source;
};

describe('StoreItemPreview — images embarquées', () => {
    beforeEach(() => {
        (ExpoImage as jest.Mock).mockClear();
    });

    it('rend un avatar Premium avec son asset embarqué', () => {
        const item = STORE_CATALOG.find(entry => entry.id === 'avatar_premium_cochon_dore');

        expect(item).toBeDefined();
        render(<StoreItemPreview item={item!} height={100} />);

        expect(ExpoImage).toHaveBeenCalled();
        expect(lastImageSource()).toEqual(PREMIUM_AVATAR_ASSET);
    });

    it('rend la bannière du Skin Creator avec son asset embarqué', () => {
        const item = STORE_CATALOG.find(entry => entry.id === 'skin_premium_atelier');

        expect(item).toBeDefined();
        render(<StoreItemPreview item={item!} height={100} />);

        expect(ExpoImage).toHaveBeenCalledTimes(1);
        expect(lastImageSource()).toEqual(SKIN_WORKSHOP_ASSET);
    });

    it('garde l’URL distante pour un avatar de boutique non embarqué', () => {
        const source = 'https://firebasestorage.googleapis.com/v0/b/demo/o/avatar.jpg';
        render(
            <StoreItemPreview
                item={{
                    id: 'avatar_remote',
                    name: 'Avatar distant',
                    description: '',
                    type: 'AVATAR',
                    rarity: 'COMMON',
                    priceCoins: 0,
                    assetId: '',
                    imageUrl: source,
                }}
                height={100}
            />,
        );

        expect(lastImageSource()).toEqual({ uri: source });
    });
});
