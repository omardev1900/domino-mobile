const HEARTBEAT_SUSPENDED_PHASES = new Set(['PARTIE_END', 'MANCHE_END', 'MATCH_END']);

export const isHeartbeatSuspendedPhase = (phase: string | undefined): boolean =>
    phase !== undefined && HEARTBEAT_SUSPENDED_PHASES.has(phase);
