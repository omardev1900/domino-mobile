import { TileTracker, likelyTilesFor } from './TileTracker';
import { DominoSide } from '../types';
import { ALL_DOMINOS } from '../constants';

export type DangerLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface OpponentProfile {
    playerId: string;
    excludedValues: Set<number>;
    likelyTiles: string[];
    handSize: number;
    playsDoubleFirst: boolean;
    playsHeavyFirst: boolean;
    dangerLevel: DangerLevel;
    movesObserved: number;
}

export type OpponentProfiles = Map<string, OpponentProfile>;

function updateOpponentProfile(tracker: TileTracker, profiles: Map<string, OpponentProfile>) {
    for (const [pid, profile] of profiles.entries()) {
        const remaining = tracker.handSizes.get(pid) ?? 7;
        
        const possibleTiles: any[] = [];
        for (const [id, state] of tracker.tileStates.entries()) {
            if (state.status !== 'UNKNOWN') continue;
            const idx = parseInt(id.replace('d-', ''), 10);
            if (isNaN(idx)) continue;
            const { left: lo, right: hi } = ALL_DOMINOS[idx];
            
            const prob = state.probabilities.get(pid) ?? 0;
            if (prob > 0.05) {
                possibleTiles.push({
                    id,
                    left: lo as DominoSide,
                    right: hi as DominoSide,
                    isDouble: lo === hi
                });
            }
        }
    }
    return profiles;
}

export function initOpponentProfiles(opponentIds: string[], initialHandSize = 7): OpponentProfiles {
    const profiles = new Map<string, OpponentProfile>();
    for (const id of opponentIds) {
        profiles.set(id, {
            playerId: id,
            excludedValues: new Set(),
            likelyTiles: [],
            handSize: initialHandSize,
            playsDoubleFirst: false,
            playsHeavyFirst: false,
            dangerLevel: 'LOW',
            movesObserved: 0,
        });
    }
    return profiles;
}

export function updateOnPlay(
    profiles: OpponentProfiles,
    tracker: TileTracker,
    playerId: string,
    tile: { id: string; left: number; right: number; isDouble: boolean }
): OpponentProfiles {
    const next = cloneProfiles(profiles);
    const profile = next.get(playerId);
    if (!profile) return next;

    profile.handSize = Math.max(0, profile.handSize - 1);
    profile.movesObserved++;

    if (tile.isDouble && profile.movesObserved <= 2) profile.playsDoubleFirst = true;
    if ((tile.left + tile.right) >= 10 && profile.movesObserved <= 3) profile.playsHeavyFirst = true;

    profile.likelyTiles = likelyTilesFor(tracker, playerId);
    profile.dangerLevel = computeDanger(profile.handSize);
    next.set(playerId, profile);
    return next;
}

export function updateOnPass(
    profiles: OpponentProfiles,
    tracker: TileTracker,
    playerId: string,
    leftValue: DominoSide | null,
    rightValue: DominoSide | null
): OpponentProfiles {
    const next = cloneProfiles(profiles);
    const profile = next.get(playerId);
    if (!profile) return next;

    if (leftValue !== null) profile.excludedValues.add(leftValue);
    if (rightValue !== null) profile.excludedValues.add(rightValue);
    profile.likelyTiles = likelyTilesFor(tracker, playerId);
    profile.dangerLevel = computeDanger(profile.handSize);
    next.set(playerId, profile);
    return next;
}

export function wouldHelpCritical(
    profiles: OpponentProfiles,
    newLeftValue: number,
    newRightValue: number
): boolean {
    return getExposurePenalty(profiles, newLeftValue, newRightValue) >= 0.55;
}

export function getExposurePenalty(
    profiles: OpponentProfiles,
    newLeftValue: number,
    newRightValue: number
): number {
    let highestRisk = 0;

    for (const profile of profiles.values()) {
        const excluded = profile.excludedValues;
        const canPlayLeft = !excluded.has(newLeftValue);
        const canPlayRight = !excluded.has(newRightValue);
        if (!canPlayLeft && !canPlayRight) continue;

        const likelihood = estimateEndpointLikelihood(profile, newLeftValue, newRightValue, canPlayLeft, canPlayRight);
        const risk = dangerWeight(profile.dangerLevel) * likelihood;
        if (risk > highestRisk) highestRisk = risk;
    }

    return highestRisk;
}

function computeDanger(handSize: number): DangerLevel {
    if (handSize <= 1) return 'CRITICAL';
    if (handSize <= 2) return 'HIGH';
    if (handSize <= 4) return 'MEDIUM';
    return 'LOW';
}

function estimateEndpointLikelihood(
    profile: OpponentProfile,
    newLeftValue: number,
    newRightValue: number,
    canPlayLeft: boolean,
    canPlayRight: boolean
): number {
    if (profile.likelyTiles.length === 0) {
        return canPlayLeft && canPlayRight ? 0.75 : 0.55;
    }

    const matches = profile.likelyTiles.filter(id => {
        const idx = parseInt(id.replace('d-', ''), 10);
        if (isNaN(idx)) return false;
        const { left: lo, right: hi } = ALL_DOMINOS[idx];
        return (canPlayLeft && (lo === newLeftValue || hi === newLeftValue))
            || (canPlayRight && (lo === newRightValue || hi === newRightValue));
    }).length;

    const ratio = matches / profile.likelyTiles.length;
    return Math.max(0.2, Math.min(1, ratio + 0.15));
}

function dangerWeight(level: DangerLevel): number {
    switch (level) {
        case 'CRITICAL':
            return 1;
        case 'HIGH':
            return 0.72;
        case 'MEDIUM':
            return 0.38;
        default:
            return 0.18;
    }
}

function cloneProfiles(profiles: OpponentProfiles): OpponentProfiles {
    const next = new Map<string, OpponentProfile>();
    for (const [k, v] of profiles) {
        next.set(k, { ...v, excludedValues: new Set(v.excludedValues), likelyTiles: [...v.likelyTiles] });
    }
    return next;
}
