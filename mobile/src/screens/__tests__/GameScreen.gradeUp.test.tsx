import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import GameScreen from '../GameScreen';
import { MatchReward } from '../../core/economy.types';

jest.setTimeout(15000);

const mockGameOverlays = jest.fn((props: any) => null as any);
const mockRewardOverlay = jest.fn((props: any) => null as any);
const mockRoundResultCard = jest.fn((props: any) => null as any);
const mockMancheEndFlow = jest.fn((props: any) => null as any);
const mockPlayerArea = jest.fn((props: any) => null as any);
const mockActionFooter = jest.fn((props: any) => null as any);
const mockHandleOverlayContinue = jest.fn();

const getLastOverlayProps = () => mockGameOverlays.mock.calls[mockGameOverlays.mock.calls.length - 1][0];
const getLastRoundResultProps = () => mockRoundResultCard.mock.calls[mockRoundResultCard.mock.calls.length - 1][0];

jest.mock('react-native-reanimated', () => {
    const Reanimated = require('react-native-reanimated/mock');
    Reanimated.default.call = () => {};
    return Reanimated;
});

jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
        back: jest.fn(),
    }),
}));

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        addListener: jest.fn(() => jest.fn()),
        dispatch: jest.fn(),
    }),
    useFocusEffect: jest.fn(),
}));

jest.mock('expo-screen-orientation', () => ({}));
jest.mock('expo-navigation-bar', () => ({}));
jest.mock('react-native-safe-area-context', () => {
    const React = require('react');
    return {
        useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
        SafeAreaProvider: ({ children }: any) => React.createElement(React.Fragment, null, children),
    };
});

jest.mock('../../components/GameTable', () => ({
    GameTable: () => null,
}));
jest.mock('../../components/PlayerHand', () => ({
    PlayerHand: () => null,
}));
jest.mock('../../components/PlayerAvatar', () => ({
    PlayerAvatar: () => null,
}));
jest.mock('../../components/game/GameHeader', () => ({
    GameHeader: () => null,
}));
jest.mock('../../components/game/GameOptionsMenu', () => ({
    GameOptionsMenu: () => null,
}));
jest.mock('../../components/game/RoundEndFlow', () => ({
    RoundEndFlow: (props: any) => mockRoundResultCard(props),
}));
jest.mock('../../components/game/MancheEndFlow', () => ({
    MancheEndFlow: (props: any) => mockMancheEndFlow(props),
}));
jest.mock('../../components/game/GameOverlays', () => ({
    GameOverlays: (props: any) => mockGameOverlays(props),
}));
jest.mock('../../components/game/PlayerArea', () => ({
    PlayerArea: (props: any) => mockPlayerArea(props),
}));
jest.mock('../../components/game/ActionFooter', () => ({
    ActionFooter: (props: any) => mockActionFooter(props),
}));
jest.mock('../../components/UnifiedResultOverlay', () => ({
    UnifiedResultOverlay: () => null,
}));
jest.mock('../../components/QuickChat', () => ({
    QuickChat: () => null,
}));
jest.mock('../../components/FlyingDomino', () => ({
    FlyingDomino: () => null,
}));

jest.mock('../../components/RewardOverlay', () => ({
    RewardOverlay: (props: any) => mockRewardOverlay(props),
}));

jest.mock('../../hooks/game/useConnectionStatus', () => ({
    useConnectionStatus: () => ({
        isRejoining: false,
        signalPlayerOnline: jest.fn().mockResolvedValue(undefined),
        signalPlayerOffline: jest.fn().mockResolvedValue(undefined),
    }),
}));

let mockCurrentGameState = {
    gameId: 'game-123',
    players: [
        {
            id: 'p1',
            name: 'Moi',
            avatarId: 'avatar_default',
            hand: [],
            handSize: 0,
            currentMancheStars: 0,
            wins: 0,
            mancheWins: 2,
            totalRoundWins: 5,
            totalPoints: 20,
            isCochon: false,
            totalCochons: 3,
            totalCochonsInfliges: 10,
            totalCochonsSubis: 1,
            status: 'HUMAN',
        },
        {
            id: 'bot-1',
            name: 'Bot',
            avatarId: 'avatar_default',
            hand: [],
            handSize: 0,
            currentMancheStars: 0,
            wins: 0,
            mancheWins: 1,
            totalRoundWins: 2,
            totalPoints: 8,
            isCochon: false,
            totalCochons: 0,
            totalCochonsInfliges: 0,
            totalCochonsSubis: 3,
            status: 'BOT',
        },
    ],
    talonMort: [],
    table: { sequence: [], leftValue: null, rightValue: null },
    currentPlayerId: 'p1',
    phase: 'MATCH_END',
    firstPlayerOfRound: null,
    history: [],
    winningCondition: 3,
    gameMode: 'MANCHE',
    mancheResult: null,
    turnDuration: 15,
    lastActionTimestamp: 0,
    turnId: 1,
    mancheHistory: [],
    roundNumber: 1,
    mancheNumber: 1,
    startingHandSize: 7,
};

jest.mock('../../hooks/game/useGameSync', () => ({
    useGameSync: () => ({
        gameState: mockCurrentGameState,
        roomData: null,
        isStarting: false,
        setIsStarting: jest.fn(),
        safeUpdateGameState: jest.fn().mockResolvedValue(undefined),
        setGameState: jest.fn(),
        setRoomData: jest.fn(),
    }),
}));

jest.mock('../../hooks/game/useGameTimers', () => ({
    useGameTimers: () => ({
        timeLeft: null,
        setTimeLeft: jest.fn(),
        overtime: null,
        setOvertime: jest.fn(),
        clearAllTurnTimers: jest.fn(),
    }),
}));

jest.mock('../../hooks/game/useGameEngine', () => ({
    useGameEngine: () => ({
        dispatch: jest.fn(),
        handlePlayDomino: jest.fn(),
        confirmSidePlay: jest.fn(),
        handlePassTurn: jest.fn(),
        handleTimeout: jest.fn(),
        handleOverlayContinue: mockHandleOverlayContinue,
        pendingDomino: null,
        isProcessingMove: false,
    }),
}));

jest.mock('../../core/LogicEngine', () => ({
    determineFirstPlayer: jest.fn(),
    dealGameSolo: jest.fn(),
    getForcedOpeningDominoId: jest.fn(() => null),
    getForcedTieBreakDominoId: jest.fn(() => null),
    dealGame: jest.fn(),
}));

jest.mock('../../core/DominoEngine', () => ({
    getValidMoves: jest.fn(() => []),
}));

jest.mock('../../core/services/stats.service', () => ({
    statsService: {
        getStats: jest.fn().mockResolvedValue({ matchHistory: [] }),
        recordMatchResult: jest.fn().mockResolvedValue(undefined),
    },
}));

const reward: MatchReward = {
    coinsEarned: 200,
    xpEarned: 50,
    diamondsEarned: 0,
    leaguePointsEarned: 1,
    isWinner: true,
    previousLevel: 1,
    newLevel: 1,
    leveledUp: false,
    previousXP: 100,
    newXP: 150,
    xpToNextLevel: 50,
    previousGrade: null,
    newGrade: 'DEBUTANT',
    gradeUp: true,
    previousLeaguePoints: 0,
    newLeaguePoints: 1,
    nextGradeThreshold: 10,
    newCochonsGiven: 1,
    newlyUnlockedFrames: [],
    frameCoinsBonus: 0,
    breakdown: [],
};

jest.mock('../../core/services/economy.service', () => ({
    economyService: {
        getEconomy: jest.fn().mockResolvedValue({
            level: 1,
            xp: 100,
            leaguePoints: 0,
            cochonsGiven: 0,
            unlockedFrames: [],
        }),
        processServerReward: jest.fn().mockResolvedValue(reward),
        deductBuyIn: jest.fn().mockResolvedValue(true),
    },
}));

jest.mock('../../core/services/store.service', () => ({
    storeService: {
        getInventory: jest.fn().mockResolvedValue(null),
        getCatalog: jest.fn().mockResolvedValue([]),
    },
}));

jest.mock('../../core/services/bot.service', () => ({
    botService: {
        getBotsForLevel: jest.fn().mockResolvedValue([]),
    },
}));

jest.mock('../../core/audio/SoundManager', () => ({
    __esModule: true,
    default: {
        preloadSounds: jest.fn(),
        stopMusic: jest.fn(),
        unlockAudio: jest.fn(),
        playMusic: jest.fn(),
        playSound: jest.fn(),
        toggleMute: jest.fn().mockResolvedValue(true),
        setBgmEnabled: jest.fn().mockResolvedValue(true),
        setSfxEnabled: jest.fn().mockResolvedValue(true),
    },
}));

jest.mock('../../core/audio/HapticManager', () => ({
    __esModule: true,
    default: {},
}));

jest.mock('../../core/SettingsManager', () => ({
    __esModule: true,
    default: {
        getSettings: jest.fn(() => ({
            tableTheme: 'classic',
            isBgmEnabled: true,
            isSfxEnabled: true,
            isVibrationEnabled: true,
            gameBgmTheme: 'inGame',
        })),
        setVibrationEnabled: jest.fn().mockResolvedValue(undefined),
    },
}));

jest.mock('../../core/services/auth.service', () => ({
    authService: {
        refreshUserFromStorage: jest.fn().mockResolvedValue({
            uid: 'p1',
            displayName: 'Moi',
            avatarId: 'avatar_default',
        }),
    },
}));

jest.mock('../../core/services/firebase', () => ({
    leaveRoom: jest.fn().mockResolvedValue(undefined),
    startGame: jest.fn().mockResolvedValue(undefined),
    clearRematchVotes: jest.fn().mockResolvedValue(undefined),
    updatePlayerChat: jest.fn().mockResolvedValue(undefined),
    resetRoomToLobby: jest.fn().mockResolvedValue(undefined),
    markPlayerAsDebited: jest.fn().mockResolvedValue(undefined),
    markRoomAsFinished: jest.fn().mockResolvedValue(undefined),
    setUserActiveRoom: jest.fn().mockResolvedValue(undefined),
    deleteWaitingRoomIfOwner: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../core/RewardEngine', () => ({
    RewardEngine: {
        buildInputFromGameState: jest.fn(() => ({
            mancheHistory: [],
        })),
    },
}));



describe('GameScreen grade-up flow', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockCurrentGameState = {
            gameId: 'game-123',
            players: [
                {
                    id: 'p1',
                    name: 'Moi',
                    avatarId: 'avatar_default',
                    hand: [],
                    handSize: 0,
                    currentMancheStars: 0,
                    wins: 0,
                    mancheWins: 2,
                    totalRoundWins: 5,
                    totalPoints: 20,
                    isCochon: false,
                    totalCochons: 3,
                    totalCochonsInfliges: 10,
                    totalCochonsSubis: 1,
                    status: 'HUMAN',
                },
                {
                    id: 'bot-1',
                    name: 'Bot',
                    avatarId: 'avatar_default',
                    hand: [],
                    handSize: 0,
                    currentMancheStars: 0,
                    wins: 0,
                    mancheWins: 1,
                    totalRoundWins: 2,
                    totalPoints: 8,
                    isCochon: false,
                    totalCochons: 0,
                    totalCochonsInfliges: 0,
                    totalCochonsSubis: 3,
                    status: 'BOT',
                },
            ],
            talonMort: [],
            table: { sequence: [], leftValue: null, rightValue: null },
            currentPlayerId: 'p1',
            phase: 'MATCH_END',
            firstPlayerOfRound: null,
            history: [],
            winningCondition: 3,
            gameMode: 'MANCHE',
            mancheResult: null,
            turnDuration: 15,
            lastActionTimestamp: 0,
            turnId: 1,
            mancheHistory: [],
            roundNumber: 1,
            mancheNumber: 1,
            startingHandSize: 7,
        };
    });

    it('garde visuellement le joueur qui vient de jouer actif pendant l animation du domino', async () => {
        mockCurrentGameState = {
            ...mockCurrentGameState,
            phase: 'PLAYING',
            currentPlayerId: 'p1',
            turnId: 7,
            history: [],
        } as any;

        const view = render(
            <GameScreen
                gameId="game-123"
                userId="p1"
                mode="solo"
                gameMode="MANCHE"
                winningCondition={3}
                turnDuration={15}
                startingHandSize={7}
            />
        );

        mockCurrentGameState = {
            ...mockCurrentGameState,
            currentPlayerId: 'bot-1',
            turnId: 8,
            history: [
                {
                    action: 'PLAY',
                    playerId: 'p1',
                    domino: { id: 'd-6', left: 6, right: 6, isDouble: true },
                    timestamp: 1000,
                },
            ],
        } as any;

        view.rerender(
            <GameScreen
                gameId="game-123"
                userId="p1"
                mode="solo"
                gameMode="MANCHE"
                winningCondition={3}
                turnDuration={15}
                startingHandSize={7}
            />
        );

        await act(async () => {
            await Promise.resolve();
        });

        const lastPlayerAreaProps = mockPlayerArea.mock.calls[mockPlayerArea.mock.calls.length - 1][0];
        const lastActionFooterProps = mockActionFooter.mock.calls[mockActionFooter.mock.calls.length - 1][0];

        expect(mockCurrentGameState.currentPlayerId).toBe('bot-1');
        expect(lastPlayerAreaProps.gameState.currentPlayerId).toBe('p1');
        expect(lastActionFooterProps.gameState.currentPlayerId).toBe('p1');
    });

    it('affiche RewardOverlay quand la récompense de fin de match contient un gradeUp', async () => {
        render(
            <GameScreen
                gameId="game-123"
                userId="p1"
                mode="solo"
                gameMode="MANCHE"
                winningCondition={3}
                turnDuration={15}
                startingHandSize={7}
            />
        );

        await waitFor(() => {
            expect(mockRewardOverlay).toHaveBeenCalled();
            const lastCall = mockRewardOverlay.mock.calls[mockRewardOverlay.mock.calls.length - 1][0];
            expect(lastCall.visible).toBe(true);
            expect(lastCall.reward.gradeUp).toBe(true);
            expect(lastCall.reward.newGrade).toBe('DEBUTANT');
        });
    });

    it('rafraîchit le snapshot de RoundResultCard en MANCHE_END au lieu de réutiliser le round précédent', async () => {
        mockCurrentGameState = {
            ...mockCurrentGameState,
            phase: 'PARTIE_END',
            history: [
                { action: 'PLAY', playerId: 'p1', domino: { left: 6, right: 6 } },
            ],
        } as any;

        const view = render(
            <GameScreen
                gameId="game-123"
                userId="p1"
                mode="solo"
                gameMode="MANCHE"
                winningCondition={3}
                turnDuration={15}
                startingHandSize={7}
            />
        );

        await waitFor(() => {
            const lastCall = mockRoundResultCard.mock.calls[mockRoundResultCard.mock.calls.length - 1][0];
            expect(lastCall.gameState.phase).toBe('PARTIE_END');
            expect(lastCall.gameState.history[0].domino.left).toBe(6);
            expect(lastCall.gameState.history[0].domino.right).toBe(6);
        });

        mockCurrentGameState = {
            ...mockCurrentGameState,
            phase: 'MANCHE_END',
            mancheResult: 'COCHON',
            history: [
                { action: 'PLAY', playerId: 'p1', domino: { left: 1, right: 4 } },
            ],
        } as any;

        view.rerender(
            <GameScreen
                gameId="game-123"
                userId="p1"
                mode="solo"
                gameMode="MANCHE"
                winningCondition={3}
                turnDuration={15}
                startingHandSize={7}
            />
        );

        await waitFor(() => {
            const lastCall = mockRoundResultCard.mock.calls[mockRoundResultCard.mock.calls.length - 1][0];
            expect(lastCall.gameState.phase).toBe('MANCHE_END');
            expect(lastCall.gameState.history[0].domino.left).toBe(1);
            expect(lastCall.gameState.history[0].domino.right).toBe(4);
        });
    });

    it('n affiche pas l overlay final de match avant la fin du RoundResultCard quand on sort d une fin de manche', async () => {
        jest.useFakeTimers();

        mockCurrentGameState = {
            ...mockCurrentGameState,
            phase: 'MANCHE_END',
            mancheResult: 'COCHON',
        } as any;

        const view = render(
            <GameScreen
                gameId="game-123"
                userId="p1"
                mode="solo"
                gameMode="MANCHE"
                winningCondition={3}
                turnDuration={15}
                startingHandSize={7}
            />
        );

        await act(async () => {
            await Promise.resolve();
        });
        expect(getLastOverlayProps().showScoreOverlay).toBe(false);
        expect(getLastRoundResultProps().visible).toBe(true);
        const getLastMancheEndProps = () => mockMancheEndFlow.mock.calls[mockMancheEndFlow.mock.calls.length - 1][0];

        // Après l'animation (13s), le RoundResultCard disparaît et l'overlay de manche s'affiche
        await act(async () => {
            jest.advanceTimersByTime(13000);
            await Promise.resolve();
        });

        // MancheEndFlow doit être affiché (mocké) pour MANCHE_END
        expect(mockMancheEndFlow).toHaveBeenCalled();
        expect(getLastMancheEndProps().visible).toBe(true);

        // -- Partie 2 : MATCH_END --
        // Maintenant on simule que le joueur clique sur "Continuer" de la manche
        // et que le backend passe en MATCH_END
        mockCurrentGameState = {
            ...mockCurrentGameState,
            phase: 'MATCH_END',
            mancheResult: null,
        } as any;

        view.rerender(
            <GameScreen
                gameId="game-123"
                userId="p1"
                mode="solo"
                gameMode="MANCHE"
                winningCondition={3}
                turnDuration={15}
                startingHandSize={7}
            />
        );

        await act(async () => {
            await Promise.resolve();
        });
        expect(getLastOverlayProps().showScoreOverlay).toBe(false);
        expect(getLastRoundResultProps().visible).toBe(true);
        expect(getLastRoundResultProps().gameState.phase).toBe('MATCH_END');

        await act(async () => {
            jest.advanceTimersByTime(13000);
            await Promise.resolve();
        });

        expect(getLastOverlayProps().showScoreOverlay).toBe(true);

        view.unmount();
        jest.runOnlyPendingTimers();
    });

    it('n initialise le RoundResultCard BOUDE qu une seule fois pour le meme etat bloque', async () => {
        jest.useFakeTimers();

        mockCurrentGameState = {
            ...mockCurrentGameState,
            phase: 'BOUDE',
            gameId: 'game-123',
            mancheNumber: 1,
            roundNumber: 2,
            turnId: 22,
            players: [
                {
                    ...mockCurrentGameState.players[0],
                    id: 'p1',
                    hand: [{ id: 'd00', left: 0, right: 0, isDouble: true }],
                    handSize: 1,
                },
                {
                    ...mockCurrentGameState.players[1],
                    id: 'bot-1',
                    hand: [{ id: 'd11', left: 1, right: 1, isDouble: true }],
                    handSize: 1,
                },
            ],
        } as any;

        const view = render(
            <GameScreen
                gameId="game-123"
                userId="p1"
                mode="solo"
                gameMode="MANCHE"
                winningCondition={3}
                turnDuration={15}
                startingHandSize={7}
            />
        );

        await act(async () => {
            await Promise.resolve();
        });

        const firstVisibleCount = mockRoundResultCard.mock.calls
            .filter(call => call[0].visible && call[0].gameState.phase === 'BOUDE')
            .length;

        view.rerender(
            <GameScreen
                gameId="game-123"
                userId="p1"
                mode="solo"
                gameMode="MANCHE"
                winningCondition={3}
                turnDuration={15}
                startingHandSize={7}
            />
        );

        await act(async () => {
            await Promise.resolve();
        });

        const secondVisibleCount = mockRoundResultCard.mock.calls
            .filter(call => call[0].visible && call[0].gameState.phase === 'BOUDE')
            .length;

        expect(firstVisibleCount).toBe(1);
        expect(secondVisibleCount).toBe(2);
        expect(getLastRoundResultProps().gameState.phase).toBe('BOUDE');
        expect(getLastRoundResultProps().visible).toBe(true);

        await act(async () => {
            jest.advanceTimersByTime(13000);
            await Promise.resolve();
        });

        expect(mockHandleOverlayContinue).toHaveBeenCalledTimes(1);

        view.unmount();
        jest.runOnlyPendingTimers();
    });
});
