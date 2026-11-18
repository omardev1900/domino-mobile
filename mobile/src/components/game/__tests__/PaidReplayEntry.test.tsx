import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { httpsCallable } from 'firebase/functions';
import { PaidReplayEntry } from '../PaidReplayEntry';
import { listSavedReplays, readSavedReplay } from '../../../core/services/replayLibrary.service';
const charge = jest.fn();
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('../../../core/services/firebase', () => ({ auth: { currentUser: { uid: 'player', getIdToken: jest.fn().mockResolvedValue('token') } }, gameFunctions: {} }));
jest.mock('../../../core/services/economy.service', () => ({ economyService: { applyConfirmedReplayBalance: jest.fn() } }));
jest.mock('../../../core/services/replayBalance', () => ({ readConfirmedReplayBalance: jest.fn().mockResolvedValue(1000) }));
jest.mock('../../../core/services/replayLibrary.service', () => ({ listSavedReplays: jest.fn(), readSavedReplay: jest.fn() }));
beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(httpsCallable).mockReturnValue(charge as unknown as ReturnType<typeof httpsCallable>);
    charge.mockResolvedValue({ data: { remainingCoins: 1000, replayId: 'replay', replay: { frames: [] } } });
    jest.mocked(listSavedReplays).mockResolvedValue([]);
});
const props = () => ({ enabled: true, solo: true, matchId: 'match', finalized: true, hasFrames: true, frames: [], localPlayerId: 'player', settle: jest.fn().mockResolvedValue(undefined), onOpened: jest.fn() });
it('demande confirmation puis attend la fin du match avant le débit', async () => {
    const p = props(); const view = render(<PaidReplayEntry {...p} />);
    fireEvent.press(view.getByLabelText('Ouvrir un replay pour 2 000 coins'));
    await waitFor(() => expect(view.getByLabelText('Confirmer l’ouverture à 2 000 coins')).toBeTruthy());
    expect(charge).not.toHaveBeenCalled();
    fireEvent.press(view.getByLabelText('Confirmer l’ouverture à 2 000 coins'));
    await waitFor(() => expect(p.onOpened).toHaveBeenCalledTimes(1));
    expect(p.settle).toHaveBeenCalledTimes(1);
    expect(charge).toHaveBeenCalledTimes(2);
});
it('ne débite pas lorsque la finalisation échoue', async () => {
    const p = props(); p.settle.mockRejectedValue(new Error('Échec de finalisation'));
    const view = render(<PaidReplayEntry {...p} />);
    fireEvent.press(view.getByLabelText('Ouvrir un replay pour 2 000 coins'));
    await waitFor(() => expect(view.getByLabelText('Confirmer l’ouverture à 2 000 coins')).toBeTruthy());
    fireEvent.press(view.getByLabelText('Confirmer l’ouverture à 2 000 coins'));
    await waitFor(() => expect(view.getByText('Échec de finalisation')).toBeTruthy());
    expect(charge).not.toHaveBeenCalled();
});
it('réutilise la même demande après une erreur réseau', async () => {
    charge.mockRejectedValueOnce(new Error('Réseau indisponible'));
    const p = props(); const view = render(<PaidReplayEntry {...p} />);
    fireEvent.press(view.getByLabelText('Ouvrir un replay pour 2 000 coins'));
    await waitFor(() => expect(view.getByLabelText('Confirmer l’ouverture à 2 000 coins')).toBeTruthy());
    fireEvent.press(view.getByLabelText('Confirmer l’ouverture à 2 000 coins'));
    await waitFor(() => expect(view.getByText('Réseau indisponible')).toBeTruthy());
    fireEvent.press(view.getByLabelText('Confirmer l’ouverture à 2 000 coins'));
    await waitFor(() => expect(p.onOpened).toHaveBeenCalled());
    expect(charge.mock.calls[0][0].requestId).toBe(charge.mock.calls[1][0].requestId);
});
it('ne lance pas de demande après annulation et renouvelle son identifiant après succès', async () => {
    const p = props(); const view = render(<PaidReplayEntry {...p} />);
    fireEvent.press(view.getByLabelText('Ouvrir un replay pour 2 000 coins'));
    await waitFor(() => expect(view.getByLabelText('Confirmer l’ouverture à 2 000 coins')).toBeTruthy());
    fireEvent.press(view.getByText('Annuler'));
    expect(charge).not.toHaveBeenCalled();
    for (let index = 0; index < 2; index++) {
        fireEvent.press(view.getByLabelText('Ouvrir un replay pour 2 000 coins'));
        await waitFor(() => expect(view.getByLabelText('Confirmer l’ouverture à 2 000 coins')).toBeTruthy());
        fireEvent.press(view.getByLabelText('Confirmer l’ouverture à 2 000 coins'));
        await waitFor(() => expect(p.onOpened).toHaveBeenCalledTimes(index + 1));
    }
    expect(charge.mock.calls[0][0].requestId).not.toBe(charge.mock.calls[2][0].requestId);
});
it('refuse le multijoueur avant sa finalisation et affiche un solde insuffisant sans ouvrir', async () => {
    const p = { ...props(), solo: false, finalized: false, sessionId: 'session' };
    const view = render(<PaidReplayEntry {...p} />);
    fireEvent.press(view.getByLabelText('Ouvrir un replay pour 2 000 coins'));
    await waitFor(() => expect(view.getByLabelText('Confirmer l’ouverture à 2 000 coins')).toBeTruthy());
    fireEvent.press(view.getByLabelText('Confirmer l’ouverture à 2 000 coins'));
    await waitFor(() => expect(view.getByText('La finalisation du match est encore en cours.')).toBeTruthy());
    expect(charge).not.toHaveBeenCalled();
    view.rerender(<PaidReplayEntry {...p} finalized />);
    charge.mockRejectedValueOnce(new Error('Solde insuffisant'));
    fireEvent.press(view.getByLabelText('Confirmer l’ouverture à 2 000 coins'));
    await waitFor(() => expect(view.getByText('Solde insuffisant')).toBeTruthy());
    expect(p.onOpened).not.toHaveBeenCalled();
});
it('permet un deuxième replay sans remplacer le premier', async () => {
    const item = { id: 'old', metadata: { endedAt: 1700000000000, mode: 'SOLO' as const, gameMode: 'SCORE', winningCondition: 10, opponents: ['Dédé'] } };
    jest.mocked(listSavedReplays).mockResolvedValue([item]);
    const view = render(<PaidReplayEntry {...props()} />);
    fireEvent.press(view.getByLabelText('Ouvrir un replay pour 2 000 coins'));
    await waitFor(() => expect(view.getByLabelText('Confirmer l’ouverture à 2 000 coins')).toBeTruthy());
    fireEvent.press(view.getByLabelText('Confirmer l’ouverture à 2 000 coins'));
    await waitFor(() => expect(charge).toHaveBeenCalled());
    expect(charge.mock.calls[0][0].replaceReplayId).toBeUndefined();
});
it('propose de remplacer un replay et envoie le choix après confirmation', async () => {
    const item = { id: 'old', metadata: { endedAt: 1700000000000, mode: 'SOLO' as const, gameMode: 'SCORE', winningCondition: 10, opponents: ['Dédé'] } };
    jest.mocked(listSavedReplays).mockResolvedValue([item, { ...item, id: 'old2' }]);
    const view = render(<PaidReplayEntry {...props()} />);
    fireEvent.press(view.getByLabelText('Ouvrir un replay pour 2 000 coins'));
    await waitFor(() => expect(view.getByText('Emplacements de replay complets')).toBeTruthy());
    fireEvent.press(view.getAllByLabelText(/Remplacer le replay du/)[0]);
    expect(charge).not.toHaveBeenCalled();
    fireEvent.press(view.getByText('Remplacer · 2 000 coins'));
    await waitFor(() => expect(charge.mock.calls[0][0].replaceReplayId).toBe('old'));
});
it('rouvre gratuitement un replay déjà sauvegardé pour cette partie', async () => {
    const item = { id: 'saved', metadata: { endedAt: 1700000000000, mode: 'SOLO' as const, sourceId: 'match', gameMode: 'SCORE', winningCondition: 10, opponents: ['Dédé'] } };
    jest.mocked(listSavedReplays).mockResolvedValue([item]);
    jest.mocked(readSavedReplay).mockResolvedValue({ replay: { frames: [], localPlayerId: 'player', metadata: item.metadata } });
    const p = props(); const view = render(<PaidReplayEntry {...p} />);
    fireEvent.press(view.getByLabelText('Ouvrir un replay pour 2 000 coins'));
    await waitFor(() => expect(p.onOpened).toHaveBeenCalledTimes(1));
    expect(readSavedReplay).toHaveBeenCalledWith('saved');
    expect(charge).not.toHaveBeenCalled();
});
