import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildPlayerFinalization, getMatchParticipantIds, resolveTableTier } from './matchFinalizer';
import { finalRoom } from './matchFinalizer.testUtils';

describe('matchFinalizer', () => {
    it('conserve le participant ayant abandonne et exclut le bot', () => {
        assert.deepEqual(getMatchParticipantIds(finalRoom()), ['p1', 'p2']);

        const legacyRoom = finalRoom();
        legacyRoom.participantIds = undefined;
        assert.deepEqual(getMatchParticipantIds(legacyRoom), ['p1', 'p2']);
    });

    it('retrouve les joueurs d un lobby sans gameState pour le nettoyage', () => {
        const room = finalRoom();
        room.participantIds = undefined;
        room.gameState = null;
        room.players = [
            { uid: 'p1', displayName: 'Joueur 1', status: 'HUMAN' },
            { uid: 'bot-1', displayName: 'Bot', status: 'BOT' },
        ] as typeof room.players;

        assert.deepEqual(getMatchParticipantIds(room), ['p1']);
    });

    it('derive la table depuis la mise et utilise un fallback sur Debutant', () => {
        assert.equal(resolveTableTier(1000), 'EXPERT');
        assert.equal(resolveTableTier(123), 'DEBUTANT');
    });

    it('prepare economie, statistiques et popup depuis l etat officiel', () => {
        const finalized = buildPlayerFinalization(finalRoom(), 'p1', {
            economy: { coins: 50, xp: 0, level: 1, diamonds: 0, leaguePoints: 0 },
            stats: { gamesPlayed: 2, gamesWon: 1, matchHistory: [] },
        }, 'match:final-room:30:1:3', Date.UTC(2026, 6, 23));

        assert.equal(finalized.stats.gamesPlayed, 3);
        assert.equal(finalized.stats.gamesWon, 2);
        assert.equal(finalized.stats.totalPointsAccumulated, 10);
        assert.equal(finalized.monthlyStats.gamesPlayed, 1);
        assert.equal(finalized.reward.isWinner, true);
        assert.equal(finalized.economy.xp, finalized.reward.newXP);
        assert.equal(finalized.economy.coins, 50 + finalized.reward.coinsEarned);
    });

    it('classe toujours le joueur ayant abandonne comme perdant', () => {
        const finalized = buildPlayerFinalization(finalRoom(), 'p2', {
            economy: { coins: 20, level: 1 },
            stats: { gamesPlayed: 0, gamesWon: 0, matchHistory: [] },
        }, 'match:final-room:30:1:3', Date.UTC(2026, 6, 23));

        assert.equal(finalized.reward.isWinner, false);
        assert.equal(finalized.stats.gamesPlayed, 1);
        assert.equal(finalized.stats.gamesWon, 0);
    });
});
