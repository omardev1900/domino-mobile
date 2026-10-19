import React from 'react';
import { render } from '@testing-library/react-native';

import { GameState, Player } from '../../../core/types';
import { MancheOutcomeAnnouncement } from './MancheOutcomeAnnouncement';

jest.mock('../../../core/audio/SoundManager', () => ({ playSound: jest.fn() }));
jest.mock('expo-image', () => ({ Image: () => null }));

const player = (id: string, name: string, isCochon = false): Player => ({
    id, name, avatarId: 'avatar_default', hand: [], handSize: 0,
    currentMancheStars: 1, wins: 0, mancheWins: 0, totalRoundWins: 1, totalPoints: 1,
    isCochon, totalCochons: 0, totalCochonsInfliges: 0, totalCochonsSubis: isCochon ? 1 : 0,
    status: id === 'giver' ? 'BOT' : 'HUMAN',
});

const state = (result: 'NORMAL' | 'CHIRE' | 'COCHON', cochonCount = 0): GameState => ({
    gameId: 'preview',
    players: [player('local', 'Vous', cochonCount > 0), player('giver', 'Mickaël'), player('other', 'Lina', cochonCount > 1)],
    talonMort: [], table: { sequence: [], leftValue: null, rightValue: null },
    currentPlayerId: 'giver', phase: 'MANCHE_END', firstPlayerOfRound: 'giver', history: [],
    winningCondition: 3, gameMode: 'COCHON', mancheResult: result, turnDuration: 15,
    lastActionTimestamp: 0, turnId: 1, roundNumber: 3, mancheNumber: 1, startingHandSize: 7,
    mancheHistory: [{ mancheNumber: 1, points: {}, winnerId: result === 'CHIRE' ? 'TIE' : 'giver', resultType: result, cochonCount }],
});

describe('MancheOutcomeAnnouncement', () => {
    it('annonce explicitement une manche chirée sans vainqueur', () => {
        const view = render(<MancheOutcomeAnnouncement gameState={state('CHIRE')} winner={null} isTie visible localPlayerId="local" onContinue={jest.fn()} autoAdvanceDelay={0} />);
        expect(view.getByText('CHIRÉ !')).toBeTruthy();
        expect(view.getByText('Personne ne remporte cette manche.')).toBeTruthy();
    });

    it('identifie le donneur et le receveur pour un cochon simple', () => {
        const view = render(<MancheOutcomeAnnouncement gameState={state('COCHON', 1)} winner={null} isTie={false} visible localPlayerId="local" onContinue={jest.fn()} autoAdvanceDelay={0} />);
        expect(view.getByText('COCHON !')).toBeTruthy();
        expect(view.getByText('Mickaël donne un cochon')).toBeTruthy();
        expect(view.getByText('à vous.')).toBeTruthy();
    });

    it('annonce un double cochon et les deux joueurs touchés', () => {
        const view = render(<MancheOutcomeAnnouncement gameState={state('COCHON', 2)} winner={null} isTie={false} visible localPlayerId="local" onContinue={jest.fn()} autoAdvanceDelay={0} />);
        expect(view.getByText('DOUBLE COCHON !')).toBeTruthy();
        expect(view.getByText('à vous et Lina.')).toBeTruthy();
    });

    it('utilise la même carte de victoire pour une manche gagnée', () => {
        const gameState = state('NORMAL');
        const view = render(<MancheOutcomeAnnouncement gameState={gameState} winner={gameState.players[1]} isTie={false} visible localPlayerId="local" onContinue={jest.fn()} autoAdvanceDelay={0} />);
        expect(view.getByText('MANCHE GAGNÉE !')).toBeTruthy();
        expect(view.getByText('Mickaël remporte la manche')).toBeTruthy();
    });

    it('annonce la fin de match avec le vainqueur', () => {
        const gameState = { ...state('NORMAL'), phase: 'MATCH_END' as const };
        const view = render(<MancheOutcomeAnnouncement gameState={gameState} winner={gameState.players[1]} isTie={false} visible localPlayerId="local" onContinue={jest.fn()} autoAdvanceDelay={0} />);
        expect(view.getByText('MATCH TERMINÉ !')).toBeTruthy();
        expect(view.getByText('Mickaël remporte le match')).toBeTruthy();
    });

    it('affiche une fin de round historique sans mancheHistory', () => {
        const gameState = { ...state('NORMAL'), phase: 'PARTIE_END' as const, mancheHistory: undefined } as unknown as GameState;
        const view = render(<MancheOutcomeAnnouncement gameState={gameState} winner={gameState.players[1]} isTie={false} visible localPlayerId="local" onContinue={jest.fn()} autoAdvanceDelay={0} />);
        expect(view.getByText('FIN DU ROUND')).toBeTruthy();
    });

    it('annonce le vainqueur d une partie bloquée', () => {
        const gameState = { ...state('NORMAL'), phase: 'BOUDE' as const };
        const view = render(<MancheOutcomeAnnouncement gameState={gameState} winner={gameState.players[1]} isTie={false} visible localPlayerId="local" onContinue={jest.fn()} autoAdvanceDelay={0} />);
        expect(view.getByText('PARTIE BLOQUÉE')).toBeTruthy();
        expect(view.getByText('Mickaël gagne ce round')).toBeTruthy();
    });
});
