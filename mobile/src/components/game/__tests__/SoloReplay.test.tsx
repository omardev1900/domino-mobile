import React from 'react';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import { SoloReplay } from '../SoloReplay';
import { createBaseGameState } from '../../../hooks/game/__tests__/testUtils';
import { handleTurn } from '../../../core/LogicEngine';

jest.mock('../../GameTable', () => ({
    GameTable: ({ gameState }: { gameState: { table: { sequence: { domino: { id: string } }[] } } }) => {
        const { Text } = require('react-native');
        return <Text>{gameState.table.sequence.map(item => item.domino.id).join(',')}</Text>;
    },
}));
jest.mock('../../PlayerAvatar', () => ({
    PlayerAvatar: ({ player, isBoude, isActive }: { player: { name: string }; isBoude: boolean; isActive: boolean }) => {
        const { Text } = require('react-native');
        return <Text testID={`active-${player.name}`} accessibilityState={{ selected: isActive }}>{player.name}{isBoude ? ' — BOUDÉ' : ''}</Text>;
    },
}));
jest.mock('../../DominoTile', () => ({
    DominoTile: ({ left, right }: { left: number; right: number }) => {
        const { Text } = require('react-native');
        return <Text>{`main ${left}-${right}`}</Text>;
    },
}));

it('affiche les coups de la partie et navigue dans les deux sens', () => {
    const tile = { id: '6-6', left: 6 as const, right: 6 as const, isDouble: true };
    const base = createBaseGameState();
    const spare = { id: '1-1', left: 1 as const, right: 1 as const, isDouble: true };
    const initial = { ...base, players: [{ ...base.players[0], hand: [tile, spare], handSize: 2 }, base.players[1]] };
    const after = handleTurn(initial, 'player1', tile);
    const close = jest.fn();
    const view = render(<SoloReplay visible frames={[initial, after]} localPlayerId="player1" onClose={close} />);
    expect(view.getByText('Plateau vide')).toBeTruthy();
    expect(within(view.getByTestId('replay-local-hand')).getByText('main 6-6')).toBeTruthy();
    expect(within(view.getByTestId('replay-local-hand')).getByText('main 1-1')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Suivant'));
    expect(view.getByText('6-6')).toBeTruthy();
    expect(view.getByText('Tester joue')).toBeTruthy();
    expect(view.getByTestId('active-Tester').props.accessibilityState.selected).toBe(true);
    expect(view.getByLabelText('Progression du replay').props.accessibilityValue).toEqual({ min: 1, max: 2, now: 2 });
    expect(within(view.getByTestId('replay-local-hand')).queryByText('main 6-6')).toBeNull();
    fireEvent.press(view.getByLabelText('Précédent'));
    expect(view.getByText('Plateau vide')).toBeTruthy();
    expect(within(view.getByTestId('replay-local-hand')).getByText('main 6-6')).toBeTruthy();
    expect(view.queryByLabelText('Fermer le replay')).toBeNull();
    fireEvent.press(view.getByLabelText('Quitter le replay'));
    expect(close).toHaveBeenCalledTimes(1);
});

it('affiche le boudé sur le profil concerné, puis le retire au passage', () => {
    const initial = createBaseGameState();
    const blocked = { ...initial, currentPlayerId: 'bot1', boudePlayerId: 'bot1' };
    const passed = { ...blocked, currentPlayerId: 'player1', boudePlayerId: null };
    const view = render(<SoloReplay visible frames={[initial, blocked, passed]} localPlayerId="player1" onClose={jest.fn()} />);
    fireEvent.press(view.getByLabelText('Suivant'));
    expect(within(view.getByTestId('replay-player-top-right')).getByText('Bot 1 — BOUDÉ')).toBeTruthy();
    expect(within(view.getByTestId('replay-player-bottom-left')).getByText('Tester')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Suivant'));
    expect(within(view.getByTestId('replay-player-top-right')).getByText('Bot 1')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Précédent'));
    expect(within(view.getByTestId('replay-player-top-right')).getByText('Bot 1 — BOUDÉ')).toBeTruthy();
});

it.each(['PARTIE_END', 'MANCHE_END', 'MATCH_END'] as const)('affiche la fin du round en phase %s et la retire à la nouvelle partie', phase => {
    const initial = createBaseGameState();
    const ended = { ...initial, phase };
    const next = { ...initial, roundNumber: 2 };
    const view = render(<SoloReplay visible frames={[initial, ended, next]} localPlayerId="player1" onClose={jest.fn()} />);
    expect(view.queryByText('Fin du Round')).toBeNull();
    fireEvent.press(view.getByLabelText('Suivant'));
    expect(view.getByText('Fin du Round')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Suivant'));
    expect(view.queryByText('Fin du Round')).toBeNull();
    fireEvent.press(view.getByLabelText('Précédent'));
    expect(view.getByText('Fin du Round')).toBeTruthy();
});

it('affiche le vainqueur et le score à la fin du match', () => {
    const base = createBaseGameState({ gameMode: 'SCORE' });
    const final = { ...base, phase: 'MATCH_END' as const, players: [{ ...base.players[0], totalPoints: 10 }, base.players[1]] };
    const view = render(<SoloReplay visible frames={[base, final]} localPlayerId="player1" onClose={jest.fn()} />);
    fireEvent.press(view.getByLabelText('Suivant'));
    expect(view.getByText('Vainqueur : Tester · 10 points')).toBeTruthy();
});

it('laisse le message de fin du round visible pendant la lecture automatique', () => {
    jest.useFakeTimers();
    try {
        const initial = createBaseGameState();
        const ended = { ...initial, phase: 'PARTIE_END' as const };
        const next = { ...initial, roundNumber: 2 };
        const view = render(<SoloReplay visible frames={[initial, ended, next]} localPlayerId="player1" onClose={jest.fn()} />);
        fireEvent.press(view.getByLabelText('Lecture'));
        act(() => { jest.advanceTimersByTime(1100); });
        expect(view.getByText('Fin du Round')).toBeTruthy();
        act(() => { jest.advanceTimersByTime(1999); });
        expect(view.getByText('Fin du Round')).toBeTruthy();
        act(() => { jest.advanceTimersByTime(1); });
        expect(view.queryByText('Fin du Round')).toBeNull();
    } finally {
        jest.useRealTimers();
    }
});

it('laisse le message boudé visible deux secondes pendant la lecture automatique', () => {
    jest.useFakeTimers();
    try {
        const initial = createBaseGameState();
        const blocked = { ...initial, boudePlayerId: 'player1' };
        const passed = { ...initial, turnId: 1 };
        const view = render(<SoloReplay visible frames={[initial, blocked, passed]} localPlayerId="player1" onClose={jest.fn()} />);
        fireEvent.press(view.getByLabelText('Lecture'));
        act(() => { jest.advanceTimersByTime(1100); });
        expect(view.getByText('Tester — BOUDÉ')).toBeTruthy();
        act(() => { jest.advanceTimersByTime(1999); });
        expect(view.getByText('Tester — BOUDÉ')).toBeTruthy();
        act(() => { jest.advanceTimersByTime(1); });
        expect(view.getByText('Tester')).toBeTruthy();
    } finally {
        jest.useRealTimers();
    }
});

it('lit automatiquement, met en pause et saute aux manches et parties choisies', () => {
    jest.useFakeTimers();
    try {
        const first = createBaseGameState({ lastActionTimestamp: 0 });
        const second = { ...first, turnId: 1 };
        const nextRound = { ...first, roundNumber: 2 };
        const nextManche = { ...first, mancheNumber: 2, roundNumber: 1 };
        const view = render(<SoloReplay visible frames={[first, second, nextRound, nextManche]} localPlayerId="player1" onClose={jest.fn()} />);
        fireEvent.press(view.getByLabelText('Lecture'));
        act(() => { jest.advanceTimersByTime(1100); });
        expect(view.getByText(/2 \/ 4/)).toBeTruthy();
        fireEvent.press(view.getByLabelText('Pause'));
        act(() => { jest.advanceTimersByTime(3000); });
        expect(view.getByText(/2 \/ 4/)).toBeTruthy();
        fireEvent.press(view.getByLabelText('Partie 2'));
        expect(view.getByText(/3 \/ 4/)).toBeTruthy();
        fireEvent.press(view.getByLabelText('Manche 2'));
        expect(view.getByText(/4 \/ 4/)).toBeTruthy();
        fireEvent.press(view.getByLabelText('Lecture'));
        expect(view.getByText(/1 \/ 4/)).toBeTruthy();
    } finally {
        jest.useRealTimers();
    }
});

it('accélère la lecture sans changer l’ordre des étapes', () => {
    jest.useFakeTimers();
    try {
        const first = createBaseGameState();
        const frames = [first, { ...first, turnId: 1 }, { ...first, turnId: 2 }];
        const view = render(<SoloReplay visible frames={frames} localPlayerId="player1" onClose={jest.fn()} />);
        fireEvent.press(view.getByLabelText('Vitesse 1 fois'));
        expect(view.getByLabelText('Vitesse 2 fois')).toBeTruthy();
        fireEvent.press(view.getByLabelText('Lecture'));
        act(() => { jest.advanceTimersByTime(550); });
        expect(view.getByText(/2 \/ 3/)).toBeTruthy();
        fireEvent.press(view.getByLabelText('Vitesse 2 fois'));
        expect(view.getByLabelText('Vitesse 4 fois')).toBeTruthy();
        act(() => { jest.advanceTimersByTime(275); });
        expect(view.getByText(/3 \/ 3/)).toBeTruthy();
    } finally {
        jest.useRealTimers();
    }
});

it('place les joueurs comme pendant la partie autour du joueur local', () => {
    const initial = createBaseGameState();
    const players = [
        { ...initial.players[0], id: 'left', name: 'Gauche' },
        { ...initial.players[0], id: 'me', name: 'Moi' },
        { ...initial.players[1], id: 'right', name: 'Droite' },
    ];
    const view = render(<SoloReplay visible frames={[{ ...initial, players }]} localPlayerId="me" onClose={jest.fn()} />);
    expect(within(view.getByTestId('replay-player-bottom-left')).getByText('Moi')).toBeTruthy();
    expect(within(view.getByTestId('replay-player-top-right')).getByText('Droite')).toBeTruthy();
    expect(within(view.getByTestId('replay-player-top-left')).getByText('Gauche')).toBeTruthy();
});

it('montre la main adverse et la met à jour après son coup', () => {
    const tile = { id: '6-6', left: 6 as const, right: 6 as const, isDouble: true };
    const spare = { id: '1-1', left: 1 as const, right: 1 as const, isDouble: true };
    const base = createBaseGameState({ currentPlayerId: 'bot1' });
    const initial = { ...base, players: [base.players[0], { ...base.players[1], hand: [tile, spare], handSize: 2 }] };
    const after = handleTurn(initial, 'bot1', tile);
    const view = render(<SoloReplay visible frames={[initial, after]} localPlayerId="player1" onClose={jest.fn()} />);
    expect(within(view.getByTestId('replay-hand-bot1')).getByText('main 6-6')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Suivant'));
    expect(within(view.getByTestId('replay-hand-bot1')).queryByText('main 6-6')).toBeNull();
    expect(within(view.getByTestId('replay-hand-bot1')).getByText('main 1-1')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Précédent'));
    expect(within(view.getByTestId('replay-hand-bot1')).getByText('main 6-6')).toBeTruthy();
});

it('masque puis réaffiche les mains adverses sans masquer celle du joueur', () => {
    const tile = { id: '6-6', left: 6 as const, right: 6 as const, isDouble: true };
    const spare = { id: '1-1', left: 1 as const, right: 1 as const, isDouble: true };
    const base = createBaseGameState({ currentPlayerId: 'bot1' });
    const initial = { ...base, players: [{ ...base.players[0], hand: [spare], handSize: 1 }, { ...base.players[1], hand: [tile, spare], handSize: 2 }] };
    const after = handleTurn(initial, 'bot1', tile);
    const view = render(<SoloReplay visible frames={[initial, after]} localPlayerId="player1" onClose={jest.fn()} />);
    const toggle = () => view.getByLabelText('Afficher les dominos adverses');
    expect(toggle().props.accessibilityState.checked).toBe(true);
    expect(view.getByTestId('replay-hand-bot1')).toBeTruthy();
    fireEvent.press(toggle());
    expect(toggle().props.accessibilityState.checked).toBe(false);
    expect(view.queryByTestId('replay-hand-bot1')).toBeNull();
    expect(within(view.getByTestId('replay-local-hand')).getByText('main 1-1')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Suivant'));
    fireEvent.press(toggle());
    expect(within(view.getByTestId('replay-hand-bot1')).queryByText('main 6-6')).toBeNull();
    expect(within(view.getByTestId('replay-hand-bot1')).getByText('main 1-1')).toBeTruthy();
});
