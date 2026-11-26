/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { GameRoom, PlayerProfile, RoomStatus } from '../../core/types';
import { releaseWaitingRoomSeat } from '../../core/services/firebase';
import { LobbyScreen } from '../LobbyScreen';

jest.mock('react-native-reanimated', () => {
    const Reanimated = require('react-native-reanimated/mock');
    Reanimated.default.call = () => {};
    return Reanimated;
});

jest.mock('@expo/vector-icons', () => ({
    Ionicons: 'Icon',
    MaterialCommunityIcons: 'Icon',
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
    releaseWaitingRoomSeat: jest.fn(),
}));

jest.mock('../../hooks/game/presenceDiagnostics', () => ({
    getEstimatedPresenceServerNow: () => Date.now(),
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
                onLeaveRoom={jest.fn()}
            />,
        );

        expect(screen.queryByRole('button', { name: 'Quitter la table' })).toBeNull();
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

    it('affiche une sortie par icône aux invités et attend leur confirmation', () => {
        const guest = makePlayer('guest', 'Invité');
        const onLeaveRoom = jest.fn();
        const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        try {
            const screen = render(
                <LobbyScreen
                    roomData={makeRoom([makePlayer('host', 'Hôte'), guest])}
                    currentUserId={guest.uid}
                    onStartGame={jest.fn()}
                    onLeaveRoom={onLeaveRoom}
                />,
            );

            expect(screen.queryByText('Quitter la table')).toBeNull();
            fireEvent.press(screen.getByRole('button', { name: 'Quitter la table' }));
            expect(alert).toHaveBeenCalledWith('Quitter la table ?', 'Votre place sera libérée.', expect.any(Array));
            expect(onLeaveRoom).not.toHaveBeenCalled();

            const buttons = alert.mock.calls[0][2];
            buttons?.find(button => button.text === 'Annuler')?.onPress?.();
            expect(onLeaveRoom).not.toHaveBeenCalled();
            buttons?.find(button => button.text === 'Quitter')?.onPress?.();
            expect(onLeaveRoom).toHaveBeenCalledTimes(1);
        } finally {
            alert.mockRestore();
        }
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

    it('retente automatiquement quand la table redevient prête après un échec', async () => {
        jest.useFakeTimers();
        const players = [makePlayer('host', 'Hôte'), makePlayer('a', 'A'), makePlayer('b', 'B')];
        const room = makeRoom(players);
        const onStartGame = jest.fn().mockRejectedValueOnce(new Error('Présence expirée'));
        const screen = render(<LobbyScreen roomData={room} currentUserId="host" onStartGame={onStartGame} />);

        await act(async () => { jest.advanceTimersByTime(2000); });
        expect(onStartGame).toHaveBeenCalledTimes(1);

        const { a: expiredHeartbeat, ...remainingHeartbeats } = room.heartbeats!;
        const disconnected = { ...room, heartbeats: remainingHeartbeats };
        screen.rerender(<LobbyScreen roomData={disconnected} currentUserId="host" onStartGame={onStartGame} />);
        expect(screen.getByText('Connexion des joueurs en cours…')).toBeTruthy();
        expect(screen.queryByLabelText('A est déconnecté')).toBeNull();

        const restored = {
            ...room,
            heartbeats: { ...remainingHeartbeats, a: expiredHeartbeat },
            launchError: 'Présence expirée',
        };
        screen.rerender(<LobbyScreen roomData={restored} currentUserId="host" onStartGame={onStartGame} />);
        await act(async () => { jest.advanceTimersByTime(2000); });
        expect(onStartGame).toHaveBeenCalledTimes(2);
        expect(screen.getAllByText('● En ligne')).toHaveLength(3);
    });

    it('attend un premier signal avant d’afficher une déconnexion', async () => {
        jest.useFakeTimers();
        const room = makeRoom([makePlayer('host', 'Hôte'), makePlayer('a', 'Alice'), makePlayer('b', 'Bob')]);
        delete room.heartbeats!.a;
        const onStartGame = jest.fn();
        const screen = render(<LobbyScreen roomData={room} currentUserId="host" onStartGame={onStartGame} />);

        expect(screen.getByText('Connexion…')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Libérer la place de Alice' })).toBeNull();
        await act(async () => { jest.advanceTimersByTime(24_000); });
        expect(screen.queryByLabelText('Alice est déconnecté')).toBeNull();
        expect(onStartGame).not.toHaveBeenCalled();

        await act(async () => { jest.advanceTimersByTime(1000); });
        expect(screen.getByLabelText('Alice est déconnecté')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Libérer la place de Alice' })).toBeTruthy();
        expect(onStartGame).not.toHaveBeenCalled();
    });

    it('demande confirmation avant de libérer la place d’un hôte déconnecté', async () => {
        jest.useFakeTimers();
        const room = makeRoom([makePlayer('host', 'Hôte'), makePlayer('a', 'A'), makePlayer('b', 'B')]);
        room.heartbeats = { ...room.heartbeats, host: { toMillis: () => Date.now() - 30_000 } };
        const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        try {
            const screen = render(<LobbyScreen roomData={room} currentUserId="a" onStartGame={jest.fn()} />);
            expect(screen.getByText('Libérer')).toBeTruthy();
            fireEvent.press(screen.getByRole('button', { name: 'Libérer la place de Hôte' }));
            expect(alert).toHaveBeenCalledWith('Libérer cette place ?', 'La place de Hôte sera libérée.', expect.any(Array));
            const buttons = alert.mock.calls[0][2];
            buttons?.find(button => button.text === 'Annuler')?.onPress?.();
            expect(releaseWaitingRoomSeat).not.toHaveBeenCalled();

            await act(async () => { buttons?.find(button => button.text === 'Libérer')?.onPress?.(); });
            expect(releaseWaitingRoomSeat).toHaveBeenCalledWith('ABC123', 'host', undefined);
        } finally {
            alert.mockRestore();
        }
    });

    it('laisse le créateur Premium confirmer une exclusion avant de démarrer', async () => {
        jest.useFakeTimers();
        const room = {
            ...makeRoom([makePlayer('host', 'Hôte'), makePlayer('a', 'Alice'), makePlayer('b', 'Bob')]),
            lobbyCreatorId: 'host',
        };
        const onStartGame = jest.fn();
        const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        try {
            const screen = render(<LobbyScreen roomData={room} currentUserId="host" onStartGame={onStartGame} hasPremium />);
            await act(async () => { jest.advanceTimersByTime(3000); });
            expect(onStartGame).not.toHaveBeenCalled();
            expect(screen.queryByText('La table est prête.')).toBeNull();

            fireEvent.press(screen.getByRole('button', { name: 'Exclure Alice' }));
            expect(releaseWaitingRoomSeat).not.toHaveBeenCalledWith('ABC123', 'a', 'EJECT');
            const buttons = alert.mock.calls[0][2];
            await act(async () => { buttons?.find(button => button.text === 'Exclure')?.onPress?.(); });
            expect(releaseWaitingRoomSeat).toHaveBeenCalledWith('ABC123', 'a', 'EJECT');

            await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Démarrer la partie' })); });
            expect(onStartGame).toHaveBeenCalledTimes(1);
        } finally {
            alert.mockRestore();
        }
    });

    it('affiche l’exclusion en cours immédiatement et restaure la fiche si elle échoue', async () => {
        const room = {
            ...makeRoom([makePlayer('host', 'Hôte'), makePlayer('a', 'Alice'), makePlayer('b', 'Bob')]),
            lobbyCreatorId: 'host',
        };
        let rejectRelease: (error: Error) => void = () => {};
        jest.mocked(releaseWaitingRoomSeat).mockReturnValueOnce(new Promise<void>((_resolve, reject) => {
            rejectRelease = reject;
        }));
        const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        try {
            const screen = render(<LobbyScreen roomData={room} currentUserId="host" onStartGame={jest.fn()} hasPremium />);
            fireEvent.press(screen.getByRole('button', { name: 'Exclure Alice' }));
            act(() => { alert.mock.calls[0][2]?.find(button => button.text === 'Exclure')?.onPress?.(); });

            expect(screen.getByText('Exclusion en cours…')).toBeTruthy();
            expect(screen.queryByText('Alice')).toBeNull();
            expect(screen.queryByText('+ Bot')).toBeNull();

            await act(async () => { rejectRelease(new Error('Réessaie.')); });

            expect(screen.queryByText('Exclusion en cours…')).toBeNull();
            expect(screen.getByText('Alice')).toBeTruthy();
            expect(alert).toHaveBeenLastCalledWith('Impossible de libérer la place', 'Réessaie.');
        } finally {
            alert.mockRestore();
        }
    });

    it('masque l’exclusion pour un hôte Premium qui a hérité de la table', () => {
        const room = { ...makeRoom([makePlayer('host', 'Hôte'), makePlayer('a', 'Alice')]), lobbyCreatorId: 'ancien' };
        const screen = render(<LobbyScreen roomData={room} currentUserId="host" onStartGame={jest.fn()} hasPremium />);
        expect(screen.queryByRole('button', { name: 'Exclure Alice' })).toBeNull();
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
