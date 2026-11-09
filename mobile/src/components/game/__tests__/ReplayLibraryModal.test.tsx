import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ReplayLibraryModal } from '../ReplayLibraryModal';
import { deleteSavedReplay, listSavedReplays, openSavedReplay } from '../../../core/services/replayLibrary.service';

jest.mock('../../../core/services/firebase', () => ({ auth: { currentUser: { uid: 'player' } } }));
jest.mock('../../../core/services/economy.service', () => ({ economyService: { applyConfirmedReplayBalance: jest.fn() } }));
jest.mock('../../../core/services/replayBalance', () => ({ readConfirmedReplayBalance: jest.fn().mockResolvedValue(1000) }));
jest.mock('../../../core/services/replayLibrary.service', () => ({ listSavedReplays: jest.fn(), deleteSavedReplay: jest.fn(), openSavedReplay: jest.fn() }));
jest.mock('../SoloReplay', () => ({ SoloReplay: () => { const { Text } = require('react-native'); return <Text>Lecteur ouvert</Text>; } }));
const item = { id: 'id', metadata: { endedAt: 1700000000000, mode: 'SOLO' as const, gameMode: 'SCORE', winningCondition: 10, opponents: ['Dédé'] } };
beforeEach(() => { jest.clearAllMocks(); jest.mocked(listSavedReplays).mockResolvedValue([item]); });
it('montre les informations et permet la réouverture gratuite', async () => {
    jest.mocked(openSavedReplay).mockResolvedValue({ replay: { frames: [], localPlayerId: 'player', metadata: item.metadata } });
    const view = render(<ReplayLibraryModal visible onClose={jest.fn()} />);
    await waitFor(() => expect(view.getByText('Score 10 · Dédé')).toBeTruthy());
    expect(view.getByText('Mes replays · 1 / 2')).toBeTruthy();
    fireEvent.press(view.getByText('Score 10 · Dédé'));
    expect(view.getByText('Ouvrir ce replay gratuitement ?')).toBeTruthy();
    expect(openSavedReplay).not.toHaveBeenCalled();
    fireEvent.press(view.getByText('Ouvrir'));
    await waitFor(() => expect(view.getByText('Lecteur ouvert')).toBeTruthy());
});
it('demande confirmation avant suppression', async () => {
    jest.mocked(deleteSavedReplay).mockResolvedValue({ savedCount: 0 });
    const view = render(<ReplayLibraryModal visible onClose={jest.fn()} />);
    await waitFor(() => expect(view.getByText('Score 10 · Dédé')).toBeTruthy());
    fireEvent.press(view.getByLabelText('Supprimer ce replay'));
    expect(deleteSavedReplay).not.toHaveBeenCalled();
    fireEvent.press(view.getByText('Supprimer'));
    await waitFor(() => expect(deleteSavedReplay).toHaveBeenCalledWith('id'));
});
