import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ReplaySlotPurchase } from '../ReplaySlotPurchase';
import { buyReplaySlot } from '../../../core/services/replayLibrary.service';

jest.mock('../../../core/services/firebase', () => ({ auth: { currentUser: { uid: 'player' } } }));
jest.mock('../../../core/services/replayBalance', () => ({ readConfirmedReplayBalance: jest.fn().mockResolvedValue(4000) }));
jest.mock('../../../core/services/economy.service', () => ({ economyService: { applyConfirmedReplayBalance: jest.fn() } }));
jest.mock('../../../core/services/replayLibrary.service', () => ({ buyReplaySlot: jest.fn() }));

it('demande confirmation du prix avant de débiter et signale la réussite', async () => {
    const onPurchased = jest.fn();
    jest.mocked(buyReplaySlot).mockResolvedValue({ capacity: 2, remainingCoins: 1000, expiresAt: 1 });
    const view = render(<ReplaySlotPurchase onPurchased={onPurchased} />);
    fireEvent.press(view.getByText('Acheter un emplacement · 3 000 coins / 30 jours'));
    expect(view.getByText('Ajouter un emplacement pour 3 000 coins pendant 30 jours ?')).toBeTruthy();
    expect(buyReplaySlot).not.toHaveBeenCalled();
    fireEvent.press(view.getByText('Confirmer · 3 000 coins'));
    await waitFor(() => expect(onPurchased).toHaveBeenCalledTimes(1));
    expect(buyReplaySlot).toHaveBeenCalledTimes(1);
});
