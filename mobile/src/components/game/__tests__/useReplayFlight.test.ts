import { handleTurn, passTurn } from '../../../core/LogicEngine';
import { createBaseGameState } from '../../../hooks/game/__tests__/testUtils';
import { getReplayPlay } from '../useReplayFlight';

it('identifie le domino et le joueur uniquement pour un nouveau coup joué', () => {
    const tile = { id: '6-6', left: 6 as const, right: 6 as const, isDouble: true };
    const spare = { id: '1-1', left: 1 as const, right: 1 as const, isDouble: true };
    const base = createBaseGameState();
    const before = { ...base, players: [{ ...base.players[0], hand: [tile, spare], handSize: 2 }, base.players[1]] };
    const after = handleTurn(before, 'player1', tile);
    expect(getReplayPlay(before, after)).toEqual({ playerId: 'player1', domino: tile });
    expect(getReplayPlay(after, before)).toBeNull();
    expect(getReplayPlay(before, { ...after, roundNumber: 2 })).toBeNull();
    const pass = passTurn(after, 'bot1');
    expect(getReplayPlay(after, pass)).toBeNull();
    expect(getReplayPlay(after, { ...after, phase: 'MATCH_END' })).toBeNull();
});
