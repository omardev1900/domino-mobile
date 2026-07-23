export type RewardedAdFailure = 'NO_FILL' | 'NETWORK' | 'CONFIGURATION' | 'UNKNOWN';

type AdErrorLike = {
    code?: unknown;
    message?: unknown;
};

export function classifyRewardedAdError(error: unknown): RewardedAdFailure {
    if (!error || typeof error !== 'object') return 'UNKNOWN';

    const candidate = error as AdErrorLike;
    const code = typeof candidate.code === 'string' ? candidate.code.toLowerCase() : '';
    const message = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : '';
    const searchable = `${code} ${message}`;

    if (
        searchable.includes('no-fill')
        || searchable.includes('no fill')
        || searchable.includes('error-code-no-fill')
    ) {
        return 'NO_FILL';
    }
    if (searchable.includes('network') || searchable.includes('timeout')) {
        return 'NETWORK';
    }
    if (
        searchable.includes('invalid-request')
        || searchable.includes('app-id-missing')
        || searchable.includes('invalid-ad')
    ) {
        return 'CONFIGURATION';
    }
    return 'UNKNOWN';
}
