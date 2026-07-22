import React from 'react';
import { act, render } from '@testing-library/react-native';

import { GameState } from '../../../core/types';
import { MancheEndFlow } from './index';

jest.mock('../../../core/audio/SoundManager', () => ({
    playSound: jest.fn(),
}));
jest.mock('@expo/vector-icons', () => ({
    Ionicons: () => null,
}));

const createCochonState = (): GameState => ({
    gameId: 'game-1',
    players: [
        {
            id: 'host', name: 'Host', hand: [], handSize: 0,
            currentMancheStars: 3, wins: 0, mancheWins: 1, totalRoundWins: 3,
            totalPoints: 3, isCochon: false, totalCochons: 0,
            totalCochonsInfliges: 2, totalCochonsSubis: 0, status: 'HUMAN',
        },
        {
            id: 'guest', name: 'Guest', hand: [], handSize: 0,
            currentMancheStars: 0, wins: 0, mancheWins: 0, totalRoundWins: 0,
            totalPoints: 0, isCochon: true, totalCochons: 1,
            totalCochonsInfliges: 0, totalCochonsSubis: 1, status: 'HUMAN',
        },
    ],
    talonMort: [],
    table: { sequence: [], leftValue: null, rightValue: null },
    currentPlayerId: 'host',
    phase: 'MANCHE_END',
    firstPlayerOfRound: 'host',
    history: [],
    winningCondition: 3,
    gameMode: 'COCHON',
    mancheResult: 'COCHON',
    turnDuration: 15,
    lastActionTimestamp: 0,
    turnId: 5,
    mancheHistory: [],
    roundNumber: 3,
    mancheNumber: 1,
    startingHandSize: 7,
});

describe('MancheEndFlow', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('avance automatiquement la manche Cochon après 3 secondes côté hôte', () => {
        const onContinue = jest.fn();
        const view = render(
            <MancheEndFlow
                gameState={createCochonState()}
                visible
                localPlayerId="host"
                onContinue={onContinue}
                isHost
            />
        );

        expect(view.queryByText('CONTINUER')).toBeNull();
        expect(view.queryByText("Attente de l'hôte...")).toBeNull();
        expect(view.getByText('Suite automatique dans 3s')).toBeTruthy();

        act(() => jest.advanceTimersByTime(2999));
        expect(onContinue).not.toHaveBeenCalled();

        act(() => jest.advanceTimersByTime(1));
        expect(onContinue).toHaveBeenCalledTimes(1);
    });

    it("affiche le même compte à rebours sans publier la transition côté adversaire", () => {
        const onContinue = jest.fn();
        const view = render(
            <MancheEndFlow
                gameState={createCochonState()}
                visible
                localPlayerId="guest"
                onContinue={onContinue}
                isHost={false}
            />
        );

        expect(view.getByText('Suite automatique dans 3s')).toBeTruthy();
        expect(view.queryByText("Attente de l'hôte...")).toBeNull();

        act(() => jest.advanceTimersByTime(3000));
        expect(onContinue).not.toHaveBeenCalled();
    });
});
