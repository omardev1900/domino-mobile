import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Image, Linking } from 'react-native';
import { CampaignModal } from '../CampaignModal';
import { Campaign } from '../../core/campaigns/campaignPolicy';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: (...args: unknown[]) => mockPush(...args) }) }));
const campaign: Campaign = { id: '1', title: 'Promotion', message: 'Offre', imageUrl: 'https://example.com/a.png', buttonLabel: 'Voir', destination: { type: 'PREMIUM' }, active: true, startsAt: 1, endsAt: 2, audience: 'FREE', placements: ['HOME'], frequency: 'ONCE', priority: 1 };

describe('CampaignModal', () => {
    it('ferme la fenêtre et ouvre la destination interne', () => {
        const close = jest.fn();
        const screen = render(<CampaignModal campaign={campaign} onClose={close} />);
        fireEvent.press(screen.getByText('Voir'));
        expect(close).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith('/premium');
    });
    it('accepte les événements de chargement web sans dimensions natives', () => {
        const screen = render(<CampaignModal campaign={campaign} onClose={jest.fn()} />);
        const image = screen.UNSAFE_getByType(Image);
        fireEvent(image, 'load', { nativeEvent: {} });
        fireEvent(image, 'load', { nativeEvent: { target: { naturalWidth: 1200, naturalHeight: 800 } } });
        expect(screen.getByText('Promotion')).toBeTruthy();
    });
    it('garde les informations accessibles quand l’image échoue', () => {
        const screen = render(<CampaignModal campaign={campaign} onClose={jest.fn()} />);
        fireEvent(screen.UNSAFE_getByType(Image), 'error');
        expect(screen.getByText('Image indisponible')).toBeTruthy();
        expect(screen.getByText('Promotion')).toBeTruthy();
        expect(screen.getByText('Voir')).toBeTruthy();
    });
    it('ouvre un lien externe et permet de fermer la fenêtre', () => {
        const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
        const close = jest.fn();
        const screen = render(<CampaignModal campaign={{ ...campaign, destination: { type: 'EXTERNAL', url: 'https://example.com/' } }} onClose={close} />);
        fireEvent.press(screen.getByText('Voir'));
        expect(open).toHaveBeenCalledWith('https://example.com/');
        fireEvent.press(screen.getByLabelText('Fermer'));
        expect(close).toHaveBeenCalledTimes(2);
        open.mockRestore();
    });
});
