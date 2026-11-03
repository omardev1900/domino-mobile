import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { PremiumHomeFeatures } from '../PremiumHomeFeatures';

it.each([true, false])('dirige les cartes selon le statut Premium : %s', active => {
    const onReplays = jest.fn();
    const onWorkshop = jest.fn();
    const onTraining = jest.fn();
    const onPremium = jest.fn();
    const onShop = jest.fn();
    const view = render(<PremiumHomeFeatures active={active} onReplays={onReplays} onWorkshop={onWorkshop} onTraining={onTraining} onPremium={onPremium} onShop={onShop} />);
    ['Mes replays', 'Atelier des skins', 'Entraînement avancé'].forEach(label => fireEvent.press(view.getByLabelText(label)));
    expect(onReplays).toHaveBeenCalledTimes(active ? 1 : 0);
    expect(onWorkshop).toHaveBeenCalledTimes(active ? 1 : 0);
    expect(onTraining).toHaveBeenCalledTimes(active ? 1 : 0);
    expect(onPremium).toHaveBeenCalledTimes(active ? 0 : 3);
    if (active) { fireEvent.press(view.getByLabelText('Boutique Premium')); expect(onShop).toHaveBeenCalledTimes(1); }
    else expect(view.queryByLabelText('Boutique Premium')).toBeNull();
});
