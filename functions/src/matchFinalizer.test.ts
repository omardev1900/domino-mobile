import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildPlayerFinalization, getMatchParticipantIds, resolveTableTier } from './matchFinalizer';
import { TABLE_CONFIGS } from './core/economy.constants';
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

    it('garde une mise de 100 coins et utilise un fallback sur Debutant', () => {
        assert.deepEqual(Object.values(TABLE_CONFIGS).map(table => table.buyIn), [100, 100, 100]);
        assert.equal(resolveTableTier(100), 'DEBUTANT');
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

    it('credite le palier mensuel meme avec un ancien cadre, une seule fois au franchissement', () => {
        const room = finalRoom();
        const manche = room.gameState!.mancheHistory![0];
        manche.resultType = 'COCHON';
        manche.cochonCount = 1;
        room.gameState!.players.find(player => player.id === 'p1')!.totalCochonsInfliges = 1;
        const profile = {
            economy: { coins: 50, level: 1, leaguePoints: 9, cochonsGiven: 9, unlockedFrames: ['frame_apprenti_1'] },
            stats: { matchHistory: [{ timestamp: Date.UTC(2026, 10, 2), cochons: 9 }] },
        };
        const first = buildPlayerFinalization(room, 'p1', profile, 'match:1', Date.UTC(2026, 10, 3));
        assert.equal(first.reward.frameCoinsBonus, 200);
        assert.equal(first.economy.coins, 50 + first.reward.coinsEarned);
        const next = buildPlayerFinalization(room, 'p1', { economy: first.economy, stats: first.stats }, 'match:2', Date.UTC(2026, 10, 3));
        assert.equal(next.reward.frameCoinsBonus, 0);
    });

    it('utilise l historique mensuel plutot que le compteur economique divergent', () => {
        const room = finalRoom();
        const manche = room.gameState!.mancheHistory![0];
        manche.resultType = 'COCHON';
        manche.cochonCount = 1;
        room.gameState!.players.find(player => player.id === 'p1')!.totalCochonsInfliges = 1;
        const finalized = buildPlayerFinalization(room, 'p1', {
            economy: { coins: 50, level: 1, leaguePoints: 9, cochonsGiven: 100 },
            stats: { matchHistory: [{ timestamp: Date.UTC(2026, 6, 1, 4), cochons: 9 }] },
        }, 'match:monthly-source', Date.UTC(2026, 6, 23));

        assert.equal(finalized.reward.newCochonsGiven, 10);
        assert.equal(finalized.monthlyStats.cochonsGiven, 10);
    });

    it('double les coins du vainqueur quand son entitlement Premium est actif', () => {
        const normal = buildPlayerFinalization(finalRoom(), 'p1', {
            economy: { coins: 50, xp: 0, level: 1, diamonds: 0, leaguePoints: 0 },
            stats: { gamesPlayed: 2, gamesWon: 1, matchHistory: [] },
        }, 'match:final-room:30:1:3', Date.UTC(2026, 6, 23));
        const premium = buildPlayerFinalization(finalRoom(), 'p1', {
            economy: { coins: 50, xp: 0, level: 1, diamonds: 0, leaguePoints: 0 },
            stats: { gamesPlayed: 2, gamesWon: 1, matchHistory: [] },
        }, 'match:final-room:30:1:3', Date.UTC(2026, 6, 23), true);

        assert.equal(normal.reward.coinsEarned, 250);
        assert.equal(premium.reward.coinsEarned, 500);
        assert.equal(premium.economy.coins, 550);
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
