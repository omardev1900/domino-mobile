import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeCoinAuthority } from './coinAuthorityAudit';

const user = (id: string, data: Record<string, unknown>) => ({ id, data: () => data });

test('confirme une migration complète et des soldes valides', () => {
    const result = summarizeCoinAuthority([
        user('one', { coinAuthority: 'server', economy: { coins: 100 } }),
        user('two', { coinAuthority: 'server', economy: { coins: 0 } }),
    ]);

    assert.deepEqual(result, {
        ok: true,
        totalUsers: 2,
        serverAuthority: 2,
        missingAuthority: 0,
        invalidBalances: 0,
        missingAuthorityIds: [],
        invalidBalanceIds: [],
        invalidBalanceDetails: [],
    });
});

test('signale les profils non migrés et les soldes invalides', () => {
    const result = summarizeCoinAuthority([
        user('legacy', { economy: { coins: 20 } }),
        user('negative', { coinAuthority: 'server', economy: { coins: -1 } }),
        user('fractional', { coinAuthority: 'server', economy: { coins: 1.5 } }),
    ]);

    assert.equal(result.ok, false);
    assert.equal(result.totalUsers, 3);
    assert.equal(result.serverAuthority, 2);
    assert.equal(result.missingAuthority, 1);
    assert.equal(result.invalidBalances, 2);
    assert.deepEqual(result.missingAuthorityIds, ['legacy']);
    assert.deepEqual(result.invalidBalanceIds, ['negative', 'fractional']);
    assert.deepEqual(result.invalidBalanceDetails, ['negative=invalid:-1', 'fractional=invalid:1.5']);
});
