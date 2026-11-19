/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { GameRoom, PlayerProfile, RoomStatus } from '../../core/types';
import { LobbyScreen } from '../LobbyScreen';

jest.mock('react-native-reanimated', () => {
    const Reanimated = require('react-native-reanimated/mock');
    Reanimated.default.call = () => {};
    return Reanimated;
});

jest.mock('@expo/vector-icons', () => ({
    Ionicons: 'Icon',
}));

jest.mock('expo-image', () => ({
    Image: 'Image',
}));

jest.mock('../../core/avatars', () => ({
    getAvatarImage: jest.fn(() => 1),
}));

jest.mock('../../components/EconomyHeader', () => ({
    EconomyHeader: () => null,
}));

jest.mock('../../components/AvatarFrame', () => ({
    AvatarFrame: () => null,
}));

jest.mock('../../components/GradeBadge', () => ({
    GradeBadge: () => null,
}));

jest.mock('../../components/BotSelectionModal', () => ({
    BotSelectionModal: () => null,
}));

jest.mock('../../components/common/PremiumButton', () => {
    const React = require('react');
    const { Pressable } = require('react-native');

    return {
        PremiumButton: ({ children, ...props }: React.ComponentProps<typeof Pressable>) => (
            <Pressable {...props}>{children}</Pressable>
        ),
    };
});

jest.mock('../../core/services/firebase', () => ({
    addBotToWaitingRoom: jest.fn(),
    leaveRoom: jest.fn(),
}));

jest.mock('../../core/services/LogService', () => ({
    LogService: {
        info: jest.fn(),
        warn: jest.fn(),
    },
}));

const makePlayer = (uid: string, displayName: string): PlayerProfile => ({
    uid,
    displayName,
    avatarId: 'avatar_default',
    gamesPlayed: 0,
    gamesWon: 0,
});

const makeRoom = (players: PlayerProfile[]): GameRoom => ({
    roomId: 'ABC123',
    createdAt: 1,
    lastActivity: 1,
    status: RoomStatus.WAITING,
    players,
    gameState: null,
    createdBy: players[0]?.uid ?? 'host',
    isPrivate: true,
    gameMode: 'MANCHE',
    winningCondition: 3,
    turnDuration: 15,
    heartbeats: Object.fromEntries(
        players
            .filter(player => player.status !== 'BOT')
            .map(player => [player.uid, { toMillis: () => Date.now() }]),
    ),
});

describe('LobbyScreen', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it('affiche un statut passif et la suppression de table pour un hote seul', () => {
        const host = makePlayer('host', 'Hote');
        const screen = render(
            <LobbyScreen
                roomData={makeRoom([host])}
                currentUserId={host.uid}
                onStartGame={jest.fn()}
                onDeleteRoom={jest.fn()}
            />,
        );

        expect(screen.getByText('En attente de 2 joueurs...')).toBeTruthy();
        expect(screen.queryByText(/ATTENDRE .* PLUS/)).toBeNull();
        expect(screen.getByLabelText('Supprimer la table')).toBeTruthy();
    });

    it('masque la suppression lorsque la salle contient deja un adversaire', () => {
        const host = makePlayer('host', 'Hote');
        const guest = makePlayer('guest', 'Invite');
        const screen = render(
            <LobbyScreen
                roomData={makeRoom([host, guest])}
                currentUserId={host.uid}
                onStartGame={jest.fn()}
                onDeleteRoom={jest.fn()}
            />,
        );

        expect(screen.getByText('En attente de 1 joueur...')).toBeTruthy();
        expect(screen.queryByLabelText('Supprimer la table')).toBeNull();
    });

    it('conserve le demarrage automatique lorsque les trois joueurs sont presents', async () => {
        jest.useFakeTimers();
        const host = makePlayer('host', 'Hote');
        const onStartGame = jest.fn();
        const room = makeRoom([
            host,
            makePlayer('guest-1', 'Invite 1'),
            makePlayer('guest-2', 'Invite 2'),
        ]);

        render(
            <LobbyScreen
                roomData={room}
                currentUserId={host.uid}
                onStartGame={onStartGame}
                onDeleteRoom={jest.fn()}
            />,
        );

        await act(async () => {
            jest.advanceTimersByTime(2000);
        });

        expect(onStartGame).toHaveBeenCalledTimes(1);
    });

    it('permet à l’hôte de relancer après un échec', async () => {
        jest.useFakeTimers();
        const room = makeRoom([makePlayer('host', 'Hôte'), makePlayer('a', 'A'), makePlayer('b', 'B')]);
        const onStartGame = jest.fn()
            .mockRejectedValueOnce(new Error('Mise indisponible'))
            .mockResolvedValueOnce(undefined);
        const screen = render(<LobbyScreen roomData={room} currentUserId="host" onStartGame={onStartGame} />);

        await act(async () => { jest.advanceTimersByTime(2000); });
        expect(screen.getByText('Mise indisponible')).toBeTruthy();
        await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Relancer la partie' })); });
        expect(onStartGame).toHaveBeenCalledTimes(2);
    });

    it('ne tente pas de demarrer la partie depuis un invite', () => {
        jest.useFakeTimers();
        const host = makePlayer('host', 'Hote');
        const onStartGame = jest.fn();
        const room = makeRoom([
            host,
            makePlayer('guest-1', 'Invite 1'),
            makePlayer('bot-1', 'Bot 1'),
        ]);

        render(
            <LobbyScreen
                roomData={room}
                currentUserId="guest-1"
                onStartGame={onStartGame}
                onDeleteRoom={jest.fn()}
            />,
        );

        act(() => {
            jest.advanceTimersByTime(5000);
        });

        expect(onStartGame).not.toHaveBeenCalled();
    });

    it('signale un joueur sans heartbeat recent et suspend le demarrage', () => {
        jest.useFakeTimers();
        const host = makePlayer('host', 'Hote');
        const room = makeRoom([
            host,
            makePlayer('guest-1', 'Invite 1'),
            makePlayer('guest-2', 'Invite 2'),
        ]);
        room.heartbeats = {
            host: { toMillis: () => Date.now() },
            'guest-1': { toMillis: () => Date.now() - 30_000 },
            'guest-2': { toMillis: () => Date.now() },
        };

        const onStartGame = jest.fn();
        const screen = render(
            <LobbyScreen
                roomData={room}
                currentUserId={host.uid}
                onStartGame={onStartGame}
                onDeleteRoom={jest.fn()}
            />,
        );

        expect(screen.getByLabelText('Invite 1 est déconnecté')).toBeTruthy();
        expect(screen.getByText('Un joueur est déconnecté — démarrage suspendu')).toBeTruthy();
        act(() => {
            jest.advanceTimersByTime(3000);
        });
        expect(onStartGame).not.toHaveBeenCalled();
    });
});
