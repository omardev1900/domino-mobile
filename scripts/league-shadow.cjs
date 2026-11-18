'use strict';

// Simulation locale : aucune connexion réseau ni écriture en base.
const formatters = {
    utc: new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit' }),
    martinique: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Martinique', year: 'numeric', month: '2-digit' }),
};

function monthKey(timestamp, zone) {
    if (!Number.isFinite(timestamp) || !formatters[zone]) throw new Error('Timestamp ou fuseau invalide');
    const parts = formatters[zone].formatToParts(new Date(timestamp));
    const get = type => parts.find(part => part.type === type)?.value;
    return `${get('year')}-${get('month')}`;
}

function compareAccount(account, asOf) {
    if (!Number.isFinite(asOf)) throw new Error('Date de comparaison invalide');
    if (!Array.isArray(account.history)) return { status: 'history_missing' };
    const utcMonth = monthKey(asOf, 'utc');
    const martiniqueMonth = monthKey(asOf, 'martinique');
    let utc = 0;
    let martinique = 0;
    let invalid = 0;
    for (const match of account.history) {
        if (!Number.isFinite(match?.timestamp) || !Number.isFinite(match?.cochons) || match.timestamp > asOf) {
            invalid++;
            continue;
        }
        if (monthKey(match.timestamp, 'utc') === utcMonth) utc += match.cochons;
        if (monthKey(match.timestamp, 'martinique') === martiniqueMonth) martinique += match.cochons;
    }
    return {
        status: invalid ? 'invalid_records' : account.history.length >= 500 ? 'history_limit' : 'comparable',
        utc, martinique,
        economy: Number.isFinite(account.economyCochons) ? account.economyCochons : null,
        invalidRecords: invalid,
        // La présence de moins de 500 matchs ne garantit pas que l'historique soit complet.
    };
}

function summarize(accounts, asOf) {
    const summary = { accounts: 0, comparable: 0, historyMissing: 0, historyLimit: 0, invalidRecords: 0, utcDiffersMartinique: 0, economyAboveUtc: 0, economyBelowUtc: 0, economyEqualUtc: 0, economyMissing: 0 };
    for (const account of accounts) {
        const result = compareAccount(account, asOf);
        summary.accounts++;
        if (result.status === 'history_missing') { summary.historyMissing++; continue; }
        if (result.status === 'invalid_records') summary.invalidRecords++;
        else if (result.status === 'history_limit') summary.historyLimit++;
        else summary.comparable++;
        if (result.utc !== result.martinique) summary.utcDiffersMartinique++;
        if (result.economy === null) summary.economyMissing++;
        else if (result.economy > result.utc) summary.economyAboveUtc++;
        else if (result.economy < result.utc) summary.economyBelowUtc++;
        else summary.economyEqualUtc++;
    }
    return summary;
}

module.exports = { monthKey, compareAccount, summarize };

if (require.main === module) {
    try {
        const input = JSON.parse(require('node:fs').readFileSync(0, 'utf8'));
        if (!Array.isArray(input.accounts)) throw new Error('accounts doit être un tableau');
        process.stdout.write(`${JSON.stringify(summarize(input.accounts, Date.parse(input.asOf)), null, 2)}\n`);
    } catch (error) {
        process.stderr.write(`Simulation impossible : ${error.message}\n`);
        process.exitCode = 1;
    }
}
