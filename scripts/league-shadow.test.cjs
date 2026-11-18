'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { monthKey, compareAccount, summarize } = require('./league-shadow.cjs');
const timestamp = value => Date.parse(value);

test('frontière du mois à minuit en Martinique', () => {
    assert.equal(monthKey(timestamp('2026-12-01T03:59:59.999Z'), 'martinique'), '2026-11');
    assert.equal(monthKey(timestamp('2026-12-01T04:00:00.000Z'), 'martinique'), '2026-12');
    assert.equal(monthKey(timestamp('2026-12-01T03:59:59.999Z'), 'utc'), '2026-12');
});

test('compare les périodes sans changer les comptes ni proposer de crédit', () => {
    const account = { economyCochons: 8, history: [
        { timestamp: timestamp('2026-11-01T03:59:59Z'), cochons: 2 },
        { timestamp: timestamp('2026-11-01T04:00:00Z'), cochons: 1 },
    ] };
    const snapshot = structuredClone(account);
    assert.deepEqual(compareAccount(account, timestamp('2026-11-03T12:00:00Z')), { status: 'comparable', utc: 3, martinique: 1, economy: 8, invalidRecords: 0 });
    assert.deepEqual(account, snapshot);
});

test('signale les historiques absents, limités ou invalides', () => {
    const now = timestamp('2026-11-03T12:00:00Z');
    assert.equal(compareAccount({}, now).status, 'history_missing');
    assert.equal(compareAccount({ history: Array(500).fill({ timestamp: now, cochons: 0 }) }, now).status, 'history_limit');
    assert.equal(compareAccount({ history: [{ timestamp: now + 1, cochons: 1 }] }, now).status, 'invalid_records');
    assert.equal(summarize([{ history: [] }, {}], now).historyMissing, 1);
});
