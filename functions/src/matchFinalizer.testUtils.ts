import { Domino, GameRoom, GameState, Player, PlayerProfile, PlayerStatus } from './gameCore/types';

const domino = (id: string, left: Domino['left'], right: Domino['right']): Domino => ({
    id,
    left,
    right,
    isDouble: left === right,
});

const player = (id: string, status: PlayerStatus, points: number, rankWins: number): Player => ({
    id,
    name: id,
    hand: [domino(`${id}-1-2`, 1, 2)],
    handSize: 1,
    currentMancheStars: 0,
    wins: 0,
    mancheWins: rankWins,
    totalRoundWins: rankWins * 3,
    totalPoints: points,
    isCochon: false,
    totalCochons: 0,
    totalCochonsInfliges: 0,
    totalCochonsSubis: 0,
    status,
});

const profile = (uid: string, status: PlayerStatus): PlayerProfile => ({
    uid,
    displayName: uid,
    avatarId: `avatar-${uid}`,
    status,
    gamesPlayed: 0,
    gamesWon: 0,
});

export const finalState = (): GameState => ({
    gameId: 'final-room',
    players: [
        player('p1', 'HUMAN', 10, 2),
        player('p2', 'SURRENDERED', 4, 1),
        player('bot-1', 'BOT', 6, 1),
    ],
    talonMort: [],
    table: { sequence: [], leftValue: null, rightValue: null },
    currentPlayerId: 'p1',
    phase: 'MATCH_END',
    firstPlayerOfRound: 'p1',
    history: [],
    winningCondition: 10,
    gameMode: 'SCORE',
    turnDuration: 15,
    lastActionTimestamp: 1000,
    turnId: 20,
    mancheHistory: [{
        mancheNumber: 1,
        points: { p1: 5, p2: 1, 'bot-1': 2 },
        winnerId: 'p1',
        resultType: 'NORMAL',
        cochonCount: 0,
    }],
    roundNumber: 3,
    mancheNumber: 1,
    startingHandSize: 7,
    stateVersion: 30,
});

export const finalRoom = (): GameRoom => ({
    roomId: 'final-room',
    createdAt: 1,
    lastActivity: 1,
    status: 'PLAYING' as GameRoom['status'],
    players: [profile('p1', 'HUMAN')],
    playerIds: ['p1'],
    participantIds: ['p1', 'p2'],
    participantProfiles: [profile('p1', 'HUMAN'), profile('p2', 'HUMAN'), profile('bot-1', 'BOT')],
    gameState: finalState(),
    createdBy: 'p1',
    isPrivate: false,
    buyIn: 100,
    coordinatorVersion: 1,
});
