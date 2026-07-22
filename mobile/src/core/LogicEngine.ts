import { Domino, DominoSide, Player, PlayerId, GameState, GamePhase, GameMode, MancheResult } from './types';
import { ALL_DOMINOS, HAND_SIZE, TALON_MORT_SIZE, WINS_TO_WIN_MATCH, MAX_PLAYERS, MANCHE_WIN_THRESHOLD } from './constants';
import { preparePlayersForNextRound , finalizeRound } from './ScoringEngine';

import { getValidMoves } from './DominoEngine';


/**
 * resolveBoude : Résout la partie bloquée après l'animation
 */
import { determineWinnerOnBoudé } from './ScoringEngine';

interface HighestDoubleInfo {
    playerId: PlayerId;
    domino: Domino;
    sum: number;
}

const isVeryFirstTurnOfMatch = (gameState: GameState): boolean => {
    const isFirstRoundOfManche = gameState.roundNumber === 1;
    const isTableEmpty = gameState.table.sequence.length === 0
        && gameState.table.leftValue === null
        && gameState.table.rightValue === null;
    return isFirstRoundOfManche && isTableEmpty;
};

const findHighestDouble = (players: Player[]): HighestDoubleInfo | null => {
    let best: HighestDoubleInfo | null = null;

    for (const player of players) {
        for (const domino of player.hand) {
            const isDouble = domino.isDouble || domino.left === domino.right;
            if (!isDouble) continue;

            const sum = domino.left + domino.right;
            if (!best || sum > best.sum) {
                best = { playerId: player.id, domino, sum };
            }
        }
    }

    return best;
};

const determineBestStarterFromPlayers = (players: Player[]): PlayerId => {
    const highestDouble = findHighestDouble(players);
    if (highestDouble) {
        return highestDouble.playerId;
    }

    let bestSum: { sum: number; playerId: PlayerId } | null = null;
    for (const player of players) {
        for (const domino of player.hand) {
            const sum = domino.left + domino.right;
            if (!bestSum || sum > bestSum.sum) {
                bestSum = { sum, playerId: player.id };
            }
        }
    }

    return bestSum ? bestSum.playerId : players[0].id;
};

export const getForcedOpeningDominoId = (gameState: GameState, playerId: PlayerId): string | null => {
    if (!isVeryFirstTurnOfMatch(gameState)) return null;

    const highestDouble = findHighestDouble(gameState.players);
    if (!highestDouble) return null;
    if (highestDouble.playerId !== playerId) return null;

    return highestDouble.domino.id;
};

/**
 * R2-B2 — Après une redonne sur égalité, force le joueur à égalité qui possède
 * le plus grand double à le jouer en premier.
 * S'applique uniquement au premier coup du round (table vide) et uniquement
 * aux joueurs listés dans tiedPlayerIds.
 */
export const getForcedTieBreakDominoId = (gameState: GameState, playerId: PlayerId): string | null => {
    const tiedIds = gameState.tiedPlayerIds;
    if (!tiedIds || tiedIds.length === 0) return null;
    if (!tiedIds.includes(playerId)) return null;

    // La contrainte ne s'applique qu'au premier coup (table vide)
    const isTableEmpty = gameState.table.leftValue === null && gameState.table.rightValue === null;
    if (!isTableEmpty) return null;

    // Plus grand double parmi les joueurs à égalité uniquement
    const tiedPlayers = gameState.players.filter(p => tiedIds.includes(p.id));
    const highestDouble = findHighestDouble(tiedPlayers);
    if (!highestDouble) return null;
    if (highestDouble.playerId !== playerId) return null;

    return highestDouble.domino.id;
};

/**
 * Mélange des dominos avec l'algorithme de Fisher-Yates
 */
export const shuffleDeck = (): Domino[] => {
    const deck: Domino[] = ALL_DOMINOS.map((d, index) => ({
        id: `d-${index}`,
        left: d.left,
        right: d.right,
        isDouble: d.left === d.right,
    }));

    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
};

/**
 * Distribution initiale : 3 joueurs x 7 dominos + 7 talon mort
 */
export const dealGame = (playerNames: string[], handSize: number = HAND_SIZE): Partial<GameState> => {
    const deck = shuffleDeck();
    const players: Player[] = playerNames.map((name, i) => ({
        id: `p${i + 1}`,
        name,
        hand: deck.slice(i * handSize, (i + 1) * handSize),
        handSize: handSize,
        currentMancheStars: 0,
        mancheWins: 0,
        totalRoundWins: 0,
        totalPoints: 0,
        isCochon: false,
        totalCochons: 0,
        totalCochonsInfliges: 0,
        totalCochonsSubis: 0,
        status: 'HUMAN',
        wins: 0,
    }));

    const talonMort = deck.slice(players.length * handSize);

    return {
        players,
        talonMort,
        phase: 'PLAYING',
        table: {
            sequence: [],
            leftValue: null,
            rightValue: null,
        },
        gameMode: 'MANCHE',
        winningCondition: WINS_TO_WIN_MATCH,
        lastActionTimestamp: Date.now(),
        turnId: 0,
        reDealCount: 0, // ✅ Initialisation (C5)
        stateVersion: 1, // FIX-MULTI-P1
    };
};

/**
 * Distribution pour Solo Mode : 3 joueurs (1 humain + 2 bots) x 7 dominos
 */
export const dealGameSolo = (playerId: string, playerName: string, avatarId: string | undefined, botDifficulty: 'TI_MANMAY' | 'MAPIPI' | 'GRAN_MOUN' | 'METKAYALI' = 'MAPIPI', handSize: number = HAND_SIZE): Partial<GameState> => {
    const deck = shuffleDeck();

    const getBots = (diff: string) => {
        switch (diff) {
            case 'TI_MANMAY':
                return [
                    { name: 'Ti-Sonson', avatarId: 'avatar_bot_01', diff: 'TI_MANMAY' },
                    { name: 'Man-Yaya', avatarId: 'avatar_bot_02', diff: 'TI_MANMAY' }
                ];
            case 'MAPIPI':
                return [
                    { name: 'Dédé', avatarId: 'avatar_bot_03', diff: 'MAPIPI' },
                    { name: 'Maxime', avatarId: 'avatar_bot_04', diff: 'MAPIPI' }
                ];
            case 'GRAN_MOUN':
                return [
                    { name: 'Tonton-Léon', avatarId: 'avatar_bot_05', diff: 'GRAN_MOUN' },
                    { name: 'Eudorge', avatarId: 'avatar_bot_06', diff: 'GRAN_MOUN' }
                ];
            case 'METKAYALI':
                return [
                    { name: 'Man-Diab', avatarId: 'avatar_bot_07', diff: 'METKAYALI' },
                    { name: 'Papa-Zombi', avatarId: 'avatar_bot_08', diff: 'METKAYALI' }
                ];
            default:
                return [
                    { name: 'Dédé', avatarId: 'avatar_bot_03', diff: 'MAPIPI' },
                    { name: 'Maxime', avatarId: 'avatar_bot_04', diff: 'MAPIPI' }
                ];
        }
    };

    const bots = getBots(botDifficulty);

    const players: Player[] = [
        {
            id: playerId,
            name: playerName,
            avatarId: avatarId,
            hand: deck.slice(0, handSize),
            handSize: handSize,
            currentMancheStars: 0,
            mancheWins: 0,
            totalRoundWins: 0,
            totalPoints: 0,
            isCochon: false,
            totalCochons: 0,
            totalCochonsInfliges: 0,
            totalCochonsSubis: 0,
            status: 'HUMAN',
            wins: 0,
        },
        {
            id: 'bot-1',
            name: bots[0].name,
            avatarId: bots[0].avatarId,
            hand: deck.slice(handSize, handSize * 2),
            handSize: handSize,
            currentMancheStars: 0,
            mancheWins: 0,
            totalRoundWins: 0,
            totalPoints: 0,
            isCochon: false,
            totalCochons: 0,
            totalCochonsInfliges: 0,
            totalCochonsSubis: 0,
            status: 'BOT',
            difficulty: bots[0].diff as any,
            wins: 0,
        },
        {
            id: 'bot-2',
            name: bots[1].name,
            avatarId: bots[1].avatarId,
            hand: deck.slice(handSize * 2, handSize * 3),
            handSize: handSize,
            currentMancheStars: 0,
            mancheWins: 0,
            totalRoundWins: 0,
            totalPoints: 0,
            isCochon: false,
            totalCochons: 0,
            totalCochonsInfliges: 0,
            totalCochonsSubis: 0,
            status: 'BOT',
            difficulty: bots[1].diff as any,
            wins: 0,
        },
    ];

    const talonMort = deck.slice(handSize * 3);

    return {
        players,
        talonMort,
        phase: 'PLAYING',
        table: {
            sequence: [],
            leftValue: null,
            rightValue: null,
        },
        gameMode: 'MANCHE',
        winningCondition: WINS_TO_WIN_MATCH,
        lastActionTimestamp: Date.now(),
        turnId: 0,
        history: [],
        firstPlayerOfRound: null,
        mancheResult: null,
        startingHandSize: handSize,
        roundNumber: 1,
        mancheNumber: 1,
        stateVersion: 1, // FIX-MULTI-P1
    };
};

/**
 * checkValidMove : Vérifie si un domino peut être posé
 */
export const checkValidMove = (
    domino: Domino,
    leftValue: number | null,
    rightValue: number | null
): { canPlay: boolean; side?: 'left' | 'right' | 'start'; isReversed?: boolean } => {
    // 1. First move
    if (leftValue === null || rightValue === null) {
        return { canPlay: true, side: 'start', isReversed: false };
    }

    // 2. Try Left
    if (domino.right === leftValue) return { canPlay: true, side: 'left', isReversed: false };
    if (domino.left === leftValue) return { canPlay: true, side: 'left', isReversed: true };

    // 3. Try Right
    if (domino.left === rightValue) return { canPlay: true, side: 'right', isReversed: false };
    if (domino.right === rightValue) return { canPlay: true, side: 'right', isReversed: true };

    return { canPlay: false };
}; // NEW IMPORTS

// Re-export specific helpers if needed by UI, or prefer direct import from ScoringEngine
export { calculateHandPoints, finalizeRound, determineWinnerOnBoudé } from './ScoringEngine';
export const handleEndOfRound = finalizeRound; // Alias for backward compatibility

/**
 * handleTurn : Gère le tour d'un joueur (humain ou bot)
 * Met à jour le plateau, la main du joueur, et passe au suivant.
 */
export const handleTurn = (
    gameState: GameState,
    playerId: PlayerId,
    domino: Domino,
    forcedSide?: 'left' | 'right'
): GameState => {
    if (gameState.currentPlayerId !== playerId) {
        throw new Error("Not your turn");
    }

    const forcedOpeningDominoId = getForcedOpeningDominoId(gameState, playerId);
    if (forcedOpeningDominoId && domino.id !== forcedOpeningDominoId) {
        throw new Error("Opening rule: highest double must be played on round 1 / manche 1.");
    }

    const forcedTieBreakDominoId = getForcedTieBreakDominoId(gameState, playerId);
    if (forcedTieBreakDominoId && domino.id !== forcedTieBreakDominoId) {
        throw new Error("Tie-break rule: the tied player with the highest double must play it first.");
    }

    // 1. Validation Logic with the new engine
    const allValidMoves = getValidMoves([domino], {
        left: gameState.table.leftValue,
        right: gameState.table.rightValue
    });

    // Filter by forcedSide if provided
    const possibleMoves = forcedSide
        ? allValidMoves.filter(m => m.side === forcedSide)
        : allValidMoves;

    if (possibleMoves.length === 0) {
        throw new Error(`Invalid move: Domino cannot be played ${forcedSide ? 'on the ' + forcedSide + ' side' : 'anywhere'}.`);
    }

    // On prend le premier coup valide (en cas d'ambiguïté sans forcedSide, ce qui ne devrait pas arriver pour un humain car GameScreen gère le choix)
    const move = possibleMoves[0];
    const side = move.side === 'start' ? 'left' : move.side;
    const isReversed = move.isReversed;


    const newState: GameState = structuredClone(gameState);
    // ✅ Filet de securite : history peut manquer dans les anciens etats Firebase
    if (!newState.history) newState.history = [];
    if (!newState.talonMort) newState.talonMort = [];
    const playerIndex = newState.players.findIndex(p => p.id === playerId);

    if (playerIndex === -1) throw new Error("Player not found");

    const player = newState.players[playerIndex];

    // Check ownership
    const ownsTile = player.hand.some(d => d.id === domino.id);
    if (!ownsTile) throw new Error("Player does not have this domino");

    // 2. Remove domino from hand
    // Note: We filter by ID.
    player.hand = player.hand.filter(d => d.id !== domino.id);
    player.handSize = player.hand.length;

    // 3. Update Table
    const playedDomino = { ...domino };

    // CRITICAL FIX: Maintain logical order in sequence
    // sequence[0] is always the far left, sequence[last] is always the far right
    if (newState.table.sequence.length === 0) {
        // First domino
        newState.table.sequence.push({
            domino: playedDomino,
            sideAtTable: 'left',
            isReversed: false
        });
        newState.table.leftValue = playedDomino.left;
        newState.table.rightValue = playedDomino.right;
    } else {
        if (side === 'left') {
            // Add to BEGINNING of array
            newState.table.sequence.unshift({
                domino: playedDomino,
                sideAtTable: 'left',
                isReversed: !!isReversed
            });
            // The NEW left value is the side of the domino that is NOT touching the table
            newState.table.leftValue = isReversed ? playedDomino.right : playedDomino.left;
        } else {
            // Add to END of array
            newState.table.sequence.push({
                domino: playedDomino,
                sideAtTable: 'right',
                isReversed: !!isReversed
            });
            // The NEW right value is the side of the domino that is NOT touching the table
            newState.table.rightValue = isReversed ? playedDomino.left : playedDomino.right;
        }
    }

    // 4. Update History & Timestamp
    newState.history.push({
        playerId,
        action: 'PLAY',
        domino: playedDomino,
        timestamp: Date.now()
    });
    newState.lastActionTimestamp = Date.now();

    // 5. Check Win Condition
    if (player.hand.length === 0) {
        return finalizeRound(newState, playerId); // USE FINALIZE ROUND
    }

    // 6. Pass Turn
    const currentIdx = newState.players.findIndex(p => p.id === newState.currentPlayerId);
    const nextIdx = (currentIdx + 1) % newState.players.length;
    newState.currentPlayerId = newState.players[nextIdx].id;
    newState.turnId = (newState.turnId ?? 0) + 1;
    newState.boudePlayerId = null;
    newState.stateVersion = (newState.stateVersion || 0) + 1; // FIX-MULTI-P1

    return newState;
};

/**
 * passTurn : Gère le tour d'un joueur qui ne peut pas jouer.
 * Vérifie qu'il n'a vraiment aucun coup valide.
 * Si tous les joueurs passent consécutivement, la partie est bloquée (Boudé).
 */
export const passTurn = (
    gameState: GameState,
    playerId: PlayerId
): GameState => {
    // 1. Validation : Le joueur doit être le joueur courant
    if (gameState.currentPlayerId !== playerId) {
        throw new Error("Not your turn");
    }

    const newState: GameState = structuredClone(gameState);
    const player = newState.players.find(p => p.id === playerId);

    if (!player) throw new Error("Player not found");

    // 2. Validation : Le joueur ne doit avoir AUCUN coup valide
    const canPlaySomething = player.hand.some(d => {
        return checkValidMove(
            d,
            newState.table.leftValue,
            newState.table.rightValue
        ).canPlay;
    });

    if (canPlaySomething) {
        throw new Error("Player has valid moves, cannot pass");
    }

    // 3. Update History
    newState.history.push({
        playerId,
        action: 'PASS',
        timestamp: Date.now()
    });
    newState.lastActionTimestamp = Date.now();

    // 4. Check for Blocked Game (Boudé)
    // Regarder les N dernières actions (N = nombre de joueurs)
    // Si ce sont toutes des 'PASS', alors tout le monde est bloqué.
    const numPlayers = newState.players.length;
    const lastActions = newState.history.slice(-numPlayers);
    const consecutivePasses = lastActions.filter(h => h.action === 'PASS').length;

    if (consecutivePasses === numPlayers) {
        // Jeu bloqué -> On passe en phase BOUDE
        // L'UI se chargera d'afficher l'overlay et d'appeler resolveBoude après 4s
        newState.phase = 'BOUDE';
        newState.stateVersion = (newState.stateVersion || 0) + 1; // FIX-MULTI-P1
        return newState;
    }

    // 5. Pass Turn to next player
    const currentIdx = newState.players.findIndex(p => p.id === newState.currentPlayerId);
    const nextIdx = (currentIdx + 1) % newState.players.length;
    newState.currentPlayerId = newState.players[nextIdx].id;
    newState.turnId = (newState.turnId ?? 0) + 1;
    newState.boudePlayerId = null;
    newState.stateVersion = (newState.stateVersion || 0) + 1; // FIX-MULTI-P1

    return newState;
};

export const resolveBoude = (gameState: GameState): { newState: GameState; isTie: boolean; tiedPlayerIds?: PlayerId[] } => {
    let winnerId = determineWinnerOnBoudé(gameState.players);

    // ✅ GARDE-FOU ANTI-BOUCLE (C5) : Au-delà de 2 égalités de points, on force un gagnant
    const currentTieCount = gameState.reDealCount || 0;
    if (winnerId === 'TIE' && currentTieCount >= 2) {
        console.warn(`[LogicEngine] Tie limit reached (${currentTieCount + 1}-th tie). Forcing decision.`);
        winnerId = determineFirstPlayer(gameState.players);
    }

    if (winnerId === 'TIE') {
        // R2-B2 : identifier les joueurs à égalité pour forcer leur plus grand double au prochain round
        const scores = gameState.players.map(p => ({ id: p.id, score: p.hand.reduce((s, d) => s + d.left + d.right, 0) }));
        const minScore = Math.min(...scores.map(s => s.score));
        const tiedPlayerIds = scores.filter(s => s.score === minScore).map(s => s.id);
        // FIX-REGRESSION: incrémenter stateVersion même en cas d'égalité — sans ça la transaction
        // Firestore voit newVersion === currentVersion et rejette l'écriture → jeu figé sur BOUDE TIE.
        const tiedState = { ...gameState, stateVersion: (gameState.stateVersion || 0) + 1 };
        return { newState: tiedState, isTie: true, tiedPlayerIds };
    }

    // Gagnant trouvé ou forcé -> On réinitialise le compteur
    const winningState = { ...gameState, reDealCount: 0 };
    const newState = finalizeRound(winningState, winnerId);
    return { newState, isTie: false };
};

/**
 * determineFirstPlayer : Détermine qui commence (Plus gros double ou plus gros domino)
 */
export const determineFirstPlayer = (players: Player[]): string => {
    return determineBestStarterFromPlayers(players);
};

export const determineTieBreakStarter = (players: Player[], tiedPlayerIds?: PlayerId[]): PlayerId => {
    if (!tiedPlayerIds || tiedPlayerIds.length === 0) {
        return determineFirstPlayer(players);
    }

    const tiedPlayers = players.filter(player => tiedPlayerIds.includes(player.id));
    if (tiedPlayers.length === 0) {
        return determineFirstPlayer(players);
    }

    return determineBestStarterFromPlayers(tiedPlayers);
};

/**
 * handleTimeout : Joue automatiquement le meilleur coup valide (le plus gros domino) 
 * ou passe le tour si aucun coup n'est possible.
 */
export const handleTimeout = (gameState: GameState, playerId: PlayerId): GameState => {
    if (gameState.currentPlayerId !== playerId) {
        throw new Error("Not your turn");
    }

    const playerIndex = gameState.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) throw new Error("Player not found");
    const player = gameState.players[playerIndex];

    // Un timeout joue/passe automatiquement le tour courant, sans changer le
    // statut reseau. Les vraies deconnexions passent par signalPlayerOffline.
    const tempState = gameState;

    let validMove = null;
    const forcedOpeningId = getForcedOpeningDominoId(tempState, playerId);

    if (forcedOpeningId) {
        const forcedDomino = player.hand.find(tile => tile.id === forcedOpeningId);
        if (forcedDomino) {
            validMove = { tile: forcedDomino, side: 'start' as const };
        }
    } else {
        const validMoves = getValidMoves(player.hand, {
            left: tempState.table.leftValue,
            right: tempState.table.rightValue
        });
        if (validMoves.length > 0) {
            // Trier pour jouer le domino avec la plus grande valeur (sum)
            const sortedMoves = [...validMoves].sort((a, b) => (b.tile.left + b.tile.right) - (a.tile.left + a.tile.right));
            validMove = sortedMoves[0];
        }
    }

    if (validMove) {
        return handleTurn(tempState, playerId, validMove.tile, validMove.side === 'start' ? undefined : validMove.side);
    } else {
        return passTurn(tempState, playerId);
    }
};

/**
 * computeNextRoundState : Calcule l'état de départ du prochain round ou de la prochaine manche.
 */
export const computeNextRoundState = (activeState: GameState, fallbackHandSize: number = 7): GameState => {
    const handSize = activeState.startingHandSize;
    if (!handSize || handSize < 1 || handSize > 14 || !Number.isInteger(handSize)) {
        throw new Error(`[LogicEngine] startingHandSize invalide: ${handSize}`);
    }

    const isMancheEnd = activeState.phase === 'MANCHE_END';
    let winnerId = isMancheEnd ? null : activeState.firstPlayerOfRound;

    const playerNames = activeState.players.map(p => p.name);
    // On génère la nouvelle distribution pure
    const partialState = dealGame(playerNames, handSize);

    const safeOldPlayersArray = (Array.isArray(activeState.players) ? activeState.players : Object.values(activeState.players || {})) as Player[];

    const newPlayers = preparePlayersForNextRound(
        partialState.players as Player[],
        safeOldPlayersArray,
        isMancheEnd
    );

    if (!winnerId) {
        // FIX BUG-DOUBLE6-MANCHE: En début de manche, toujours chercher parmi TOUS les joueurs, 
        // ignorer tiedPlayerIds résiduels de la manche précédente.
        winnerId = isMancheEnd 
            ? determineFirstPlayer(newPlayers) 
            : determineTieBreakStarter(newPlayers, activeState.tiedPlayerIds);
    }

    // FIX-400: Plafonner mancheHistory à 15 entrées pour éviter la croissance
    // illimitée du document Firestore (limite 1 MiB). On conserve les plus récentes.
    const MAX_MANCHE_HISTORY = 15;
    const rawMancheHistory = activeState.mancheHistory ?? [];
    const trimmedMancheHistory = rawMancheHistory.length > MAX_MANCHE_HISTORY
        ? rawMancheHistory.slice(-MAX_MANCHE_HISTORY)
        : rawMancheHistory;

    return {
        ...activeState, // Conserve configuration (gameId, rules...)
        players: newPlayers,
        talonMort: partialState.talonMort as Domino[],
        table: partialState.table as any,
        currentPlayerId: winnerId,
        phase: 'PLAYING',
        firstPlayerOfRound: null,
        history: [],
        mancheResult: null,
        mancheHistory: trimmedMancheHistory,
        lastActionTimestamp: Date.now(),
        turnId: 0, // Reset strict du turnId pour ce tour 1
        roundNumber: isMancheEnd ? 1 : (activeState.roundNumber || 0) + 1,
        mancheNumber: isMancheEnd ? (activeState.mancheNumber || 1) + 1 : (activeState.mancheNumber || 1),
        tiedPlayerIds: undefined, // FIX R2-B2: Use undefined instead of null
        boudePlayerId: null,      // R2-B8 : réinitialiser le badge Boudé à chaque nouveau round
        stateVersion: (activeState.stateVersion || 0) + 1, // FIX-MULTI-P1
    };
};

