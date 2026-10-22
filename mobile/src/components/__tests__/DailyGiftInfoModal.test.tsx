import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { DailyGiftInfoModal } from '../DailyGiftInfoModal';

describe('DailyGiftInfoModal', () => {
    it('confirme le crédit automatique et annonce le prochain cadeau', () => {
        const onClose = jest.fn();
        const screen = render(
            <DailyGiftInfoModal visible amount={200} onClose={onClose} />
        );

        expect(screen.getByText('CADEAU DU JOUR')).toBeTruthy();
        expect(screen.getByText('200 coins')).toBeTruthy();
        expect(screen.getByText('Ils ont été ajoutés à votre solde.')).toBeTruthy();
        expect(screen.getByText('Prochain cadeau dans 24 heures')).toBeTruthy();
        expect(screen.queryByText(/RÉCUPÉRER/)).toBeNull();

        fireEvent.press(screen.getByLabelText('Fermer le cadeau du jour'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('ne rend pas le contenu quand la modale est masquée', () => {
        const screen = render(
            <DailyGiftInfoModal visible={false} amount={200} onClose={jest.fn()} />
        );

        expect(screen.queryByText('CADEAU DU JOUR')).toBeNull();
    });
});
