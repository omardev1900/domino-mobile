import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { httpsCallable } from 'firebase/functions';
import { PaidReplayEntry } from '../PaidReplayEntry';
const charge = jest.fn();
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('../../../core/services/firebase', () => ({ auth: { currentUser: { uid: 'player' } }, gameFunctions: {} }));
jest.mock('../../../core/services/economy.service', () => ({ economyService: { applyConfirmedReplayBalance: jest.fn() } }));
jest.mock('../../../core/services/replayBalance', () => ({ readConfirmedReplayBalance: jest.fn().mockResolvedValue(1000) }));
beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(httpsCallable).mockReturnValue(charge as unknown as ReturnType<typeof httpsCallable>);
    charge.mockResolvedValue({ data: { remainingCoins: 1000 } });
});
const props = () => ({ enabled: true, solo: true, matchId: 'match', finalized: true, hasFrames: true, settle: jest.fn().mockResolvedValue(undefined), onOpened: jest.fn() });
it('demande confirmation puis attend la fin du match avant le débit', async () => {
    const p = props(); const view = render(<PaidReplayEntry {...p} />);
    fireEvent.press(view.getByLabelText('Ouvrir un replay pour 1 000 coins'));
    expect(charge).not.toHaveBeenCalled();
    fireEvent.press(view.getByLabelText('Confirmer l’ouverture à 1 000 coins'));
    await waitFor(() => expect(p.onOpened).toHaveBeenCalledTimes(1));
    expect(p.settle).toHaveBeenCalledTimes(1);
    expect(charge).toHaveBeenCalledTimes(1);
});
it('ne débite pas lorsque la finalisation échoue', async () => {
    const p = props(); p.settle.mockRejectedValue(new Error('Échec de finalisation'));
    const view = render(<PaidReplayEntry {...p} />);
    fireEvent.press(view.getByLabelText('Ouvrir un replay pour 1 000 coins'));
    fireEvent.press(view.getByLabelText('Confirmer l’ouverture à 1 000 coins'));
    await waitFor(() => expect(view.getByText('Échec de finalisation')).toBeTruthy());
    expect(charge).not.toHaveBeenCalled();
});
it('réutilise la même demande après une erreur réseau', async () => {
    charge.mockRejectedValueOnce(new Error('Réseau indisponible'));
    const p = props(); const view = render(<PaidReplayEntry {...p} />);
    fireEvent.press(view.getByLabelText('Ouvrir un replay pour 1 000 coins'));
    fireEvent.press(view.getByLabelText('Confirmer l’ouverture à 1 000 coins'));
    await waitFor(() => expect(view.getByText('Réseau indisponible')).toBeTruthy());
    fireEvent.press(view.getByLabelText('Confirmer l’ouverture à 1 000 coins'));
    await waitFor(() => expect(p.onOpened).toHaveBeenCalled());
    expect(charge.mock.calls[0][0].requestId).toBe(charge.mock.calls[1][0].requestId);
});
it('ne débite pas après annulation et facture une nouvelle ouverture séparément', async () => {
    const p = props(); const view = render(<PaidReplayEntry {...p} />);
    fireEvent.press(view.getByLabelText('Ouvrir un replay pour 1 000 coins'));
    fireEvent.press(view.getByText('Annuler'));
    expect(charge).not.toHaveBeenCalled();
    for (let index = 0; index < 2; index++) {
        fireEvent.press(view.getByLabelText('Ouvrir un replay pour 1 000 coins'));
        fireEvent.press(view.getByLabelText('Confirmer l’ouverture à 1 000 coins'));
        await waitFor(() => expect(p.onOpened).toHaveBeenCalledTimes(index + 1));
    }
    expect(charge.mock.calls[0][0].requestId).not.toBe(charge.mock.calls[1][0].requestId);
});
it('refuse le multijoueur avant sa finalisation et affiche un solde insuffisant sans ouvrir', async () => {
    const p = { ...props(), solo: false, finalized: false, sessionId: 'session' };
    const view = render(<PaidReplayEntry {...p} />);
    fireEvent.press(view.getByLabelText('Ouvrir un replay pour 1 000 coins'));
    fireEvent.press(view.getByLabelText('Confirmer l’ouverture à 1 000 coins'));
    await waitFor(() => expect(view.getByText('La finalisation du match est encore en cours.')).toBeTruthy());
    expect(charge).not.toHaveBeenCalled();
    view.rerender(<PaidReplayEntry {...p} finalized />);
    charge.mockRejectedValueOnce(new Error('Solde insuffisant'));
    fireEvent.press(view.getByLabelText('Confirmer l’ouverture à 1 000 coins'));
    await waitFor(() => expect(view.getByText('Solde insuffisant')).toBeTruthy());
    expect(p.onOpened).not.toHaveBeenCalled();
});
