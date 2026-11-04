import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ReplayPremiumOffer } from '../ReplayPremiumOffer';

it.each([true, false])('présente le coût et le bon accès Premium : essai disponible %s', trialEligible => {
    const onClose = jest.fn();
    const onDiscover = jest.fn();
    const view = render(<ReplayPremiumOffer visible trialEligible={trialEligible} onClose={onClose} onDiscover={onDiscover} />);
    expect(view.getByText(/2 000 coins/)).toBeTruthy();
    expect(view.getByText(/gratuitement tant que Premium est actif/)).toBeTruthy();
    fireEvent.press(view.getByText(trialEligible ? 'Essayer Premium gratuitement' : 'Découvrir Premium'));
    expect(onDiscover).toHaveBeenCalledTimes(1);
    fireEvent.press(view.getByText('Plus tard'));
    expect(onClose).toHaveBeenCalledTimes(1);
});
