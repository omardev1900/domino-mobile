import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db, rtdb } from '../../core/services/firebase';
import { doc, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ref, set, remove, onValue, onDisconnect as rtdbOnDisconnect } from 'firebase/database';
import { GameRoom } from '../../core/types';
import { isHeartbeatSuspendedPhase, shouldRestoreHumanStatus } from './presencePolicy';
import {
    createPresenceConnectionId,
    getEstimatedPresenceServerNow,
    presenceErrorCode,
} from './presenceDiagnostics';
import { usePresenceDiagnosticSession } from './usePresenceDiagnosticSession';

export interface UseConnectionStatusProps {
    gameId: string | undefined;
    localPlayerId: string;
    isSoloMode: boolean;
    roomData?: GameRoom | null;
    /**
     * Ref mis à jour par GameScreen après useGameSync — suspend le heartbeat Firestore
     * pendant les transitions critiques sans créer de dépendance circulaire de hook.
     */
    gamePhaseRef?: React.MutableRefObject<string | undefined>;
}

export interface UseConnectionStatusResult {
    isRejoining: boolean;
    diagnosticConnectionId: string;
    signalPlayerOnline: () => Promise<void>;
    signalPlayerOffline: (surrendered?: boolean) => Promise<void>;
    /** Ping immédiat à appeler dès la sortie d'une phase critique (ex: PARTIE_END → PLAYING) pour
     * réinitialiser le chrono de présence sans attendre le prochain tick du setInterval. */
    forceImmediatePing: () => Promise<void>;
}

const HEARTBEAT_RETRY_DELAYS_MS = [1_000, 3_000, 8_000] as const;

/** Phases durant lesquelles le heartbeat Firestore est suspendu pour éviter d'invalider les transactions NEXT_ROUND */
export const useConnectionStatus = ({
    gameId,
    localPlayerId,
    isSoloMode,
    gamePhaseRef: externalGamePhaseRef,
}: UseConnectionStatusProps): UseConnectionStatusResult => {
    // ✅ FIX ANTI-ZOMBIE: signal visible pour l'UI quand un joueur reprend sa connexion
    const [isRejoining, setIsRejoining] = useState(false);
    // Ref pour pouvoir appeler signalPlayerOffline dans le cleanup RTDB sans dépendance circulaire
    const signalPlayerOfflineRef = useRef<((surrendered?: boolean) => Promise<void>) | null>(null);
    // FIX-LEAK: timer du badge "rejoining" — nettoyé au démontage pour éviter setState après unmount
    const rejoinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const heartbeatRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const sendPingRef = useRef<(retryAttempt?: number) => Promise<void>>(async () => undefined);
    const { connectionId: diagnosticConnectionId, log: logPresence } = usePresenceDiagnosticSession({
        gameId,
        isSoloMode,
        localPlayerId,
    });
    // Change à chaque nouvelle connexion RTDB. Ainsi un onDisconnect retardé
    // ne peut supprimer que le nœud qu'il a lui-même créé.
    const presenceConnectionIdRef = useRef<string | null>(null);
    useEffect(() => () => {
        if (rejoinTimerRef.current) clearTimeout(rejoinTimerRef.current);
        if (heartbeatRetryTimerRef.current) clearTimeout(heartbeatRetryTimerRef.current);
    }, []);

    // ─── 1. HEARTBEAT FIRESTORE (fallback 25s) ───────────────────────────────
    // Conservé comme filet de sécurité si RTDB n'est pas disponible.
    // FIX-400: ping suspendu pendant les phases critiques (PARTIE_END/MANCHE_END/MATCH_END).
    // Les updateDoc du heartbeat vont dans la write-queue interne du SDK et invalident
    // les runTransaction de transition NEXT_ROUND → FAILED_PRECONDITION (HTTP 400) en boucle.
    // FIX-REGRESSION-#8: intervalle ramené à 10s (était passé à 20s dans #8).
    // 20s + pause 12s = 32s > seuil vigilance 25s → marquage DISCONNECTED intempestif.
    // 10s + pause 12s = 22s < 25s → sûr.
    const sendPing = useCallback(async (retryAttempt = 0) => {
        if (!gameId || isSoloMode) return;
        if (retryAttempt === 0 && heartbeatRetryTimerRef.current) {
            clearTimeout(heartbeatRetryTimerRef.current);
            heartbeatRetryTimerRef.current = null;
        }
        // Suspendre pendant les transitions critiques pour ne pas invalider les transactions
        const phase = externalGamePhaseRef?.current;
        if (isHeartbeatSuspendedPhase(phase)) {
            logPresence({
                event: 'heartbeat_skipped',
                source: 'firestore_heartbeat',
                phase,
                decision: 'suspended_phase',
            });
            return;
        }
        try {
            const roomRef = doc(db, 'rooms', gameId);
            await updateDoc(roomRef, { [`heartbeats.${localPlayerId}`]: serverTimestamp() });
            logPresence({
                event: 'heartbeat_write_succeeded',
                source: 'firestore_heartbeat',
                heartbeatAtMs: getEstimatedPresenceServerNow(),
                phase,
                decision: retryAttempt > 0 ? `retry_succeeded_${retryAttempt}` : undefined,
            });
        } catch (error) {
            const retryDelayMs = HEARTBEAT_RETRY_DELAYS_MS[retryAttempt];
            logPresence({
                event: 'heartbeat_write_failed',
                source: 'firestore_heartbeat',
                errorCode: presenceErrorCode(error),
                phase,
                decision: retryDelayMs === undefined
                    ? 'retry_exhausted'
                    : `retry_scheduled_${retryAttempt + 1}`,
            });
            if (retryDelayMs !== undefined) {
                heartbeatRetryTimerRef.current = setTimeout(() => {
                    heartbeatRetryTimerRef.current = null;
                    void sendPingRef.current(retryAttempt + 1);
                }, retryDelayMs);
            }
        }
    }, [externalGamePhaseRef, gameId, isSoloMode, localPlayerId, logPresence]);

    useEffect(() => {
        sendPingRef.current = sendPing;
    }, [sendPing]);

    useEffect(() => {
        if (!gameId || isSoloMode) return;
        sendPing(); // Ping immédiat au mount (phase est PLAYING)
        const interval = setInterval(sendPing, 10000); // 10s — 10s + 12s pause max = 22s < seuil 25s
        return () => clearInterval(interval);
    }, [gameId, isSoloMode, sendPing]);

    // ─── PING DE RATTRAPAGE ───────────────────────────────────────────────────
    // Appelé par GameScreen dès que la phase passe à PLAYING (sortie de phase critique).
    // Réinitialise le chrono de présence immédiatement sans attendre le prochain tick.
    const forceImmediatePing = useCallback(async () => {
        if (!gameId || isSoloMode) return;
        try {
            const roomRef = doc(db, 'rooms', gameId);
            await updateDoc(roomRef, { [`heartbeats.${localPlayerId}`]: serverTimestamp() });
            logPresence({
                event: 'heartbeat_write_succeeded',
                source: 'firestore_heartbeat',
                heartbeatAtMs: getEstimatedPresenceServerNow(),
                decision: 'phase_catch_up',
                phase: externalGamePhaseRef?.current,
            });
        } catch (error) {
            logPresence({
                event: 'heartbeat_write_failed',
                source: 'firestore_heartbeat',
                decision: 'phase_catch_up',
                errorCode: presenceErrorCode(error),
                phase: externalGamePhaseRef?.current,
            });
        }
    }, [externalGamePhaseRef, gameId, isSoloMode, localPlayerId, logPresence]);

    // ─── 2. PRÉSENCE RTDB + onDisconnect (détection rapide ~3-5s) ────────────
    // Structure RTDB : /presence/{gameId}/{uid}/connections/{connectionId}
    //                 = { status: 'online', t: timestamp }
    //
    // Fonctionnement :
    //   - À chaque connexion RTDB : on crée un nœud propre et on programme sa suppression
    //   - Firebase exécute le onDisconnect côté serveur dès que le TCP se ferme (~3s)
    //   - GameScreen écoute ces changements et marque le joueur DISCONNECTED dans Firestore
    //   - Au démontage propre (rage-quit, quitter la partie) : on supprime son propre nœud
    useEffect(() => {
        if (!gameId || isSoloMode || !localPlayerId) return;

        const connectedRef = ref(rtdb, '.info/connected');

        // Écouter l'état de connexion RTDB pour (re)configurer le onDisconnect
        // à chaque reconnexion réseau.
        // onValue retourne une fonction Unsubscribe (Firebase v9 modular API)
        const unsubConnected = onValue(connectedRef, async (snap) => {
            const rtdbConnected = snap.val() === true;
            logPresence({
                event: 'rtdb_connection_changed',
                source: 'rtdb_connection',
                rtdbConnected,
            });
            if (!rtdbConnected) return; // Pas encore connecté au RTDB

            try {
                const presenceAtMs = Date.now();
                const presenceConnectionId = createPresenceConnectionId(presenceAtMs);
                presenceConnectionIdRef.current = presenceConnectionId;
                const presenceRef = ref(
                    rtdb,
                    `presence/${gameId}/${localPlayerId}/connections/${presenceConnectionId}`
                );
                // Programmer l'écriture automatique côté serveur en cas de déconnexion
                await rtdbOnDisconnect(presenceRef).remove();
                logPresence({
                    event: 'rtdb_on_disconnect_armed',
                    source: 'rtdb_presence',
                    presenceAtMs,
                    rtdbConnected,
                    statusTo: 'offline',
                });
                // Se déclarer en ligne
                await set(presenceRef, { status: 'online', t: presenceAtMs });
                logPresence({
                    event: 'rtdb_presence_written',
                    source: 'rtdb_presence',
                    presenceAtMs,
                    rtdbConnected,
                    statusTo: 'online',
                });
            } catch (err) {
                logPresence({
                    event: 'rtdb_presence_write_failed',
                    source: 'rtdb_presence',
                    errorCode: presenceErrorCode(err),
                    rtdbConnected,
                });
            }
        });

        return () => {
            // FIX-CLEANUP: unsubConnected est la fonction Unsubscribe renvoyée par onValue,
            // pas le callback — il faut l'appeler directement, pas la passer à off().
            unsubConnected();
            const presenceConnectionId = presenceConnectionIdRef.current;
            presenceConnectionIdRef.current = null;
            if (!presenceConnectionId) return;
            const presenceRef = ref(
                rtdb,
                `presence/${gameId}/${localPlayerId}/connections/${presenceConnectionId}`
            );
            const presenceAtMs = Date.now();
            remove(presenceRef)
                .then(() => logPresence({
                    event: 'rtdb_presence_written',
                    source: 'rtdb_presence',
                    decision: 'hook_cleanup',
                    presenceAtMs,
                    statusTo: 'offline',
                }))
                .catch(error => logPresence({
                    event: 'rtdb_presence_write_failed',
                    source: 'rtdb_presence',
                    decision: 'hook_cleanup',
                    errorCode: presenceErrorCode(error),
                }));
        };
    }, [gameId, isSoloMode, localPlayerId, logPresence]);

    // ─── 3. SIGNAL ONLINE (reconnexion) ──────────────────────────────────────
    const signalPlayerOnline = useCallback(async () => {
        if (!gameId || isSoloMode) return;

        // FIX-BOUCLE-400: comme sendPing, ne jamais lancer de transaction pendant les
        // phases critiques (MANCHE_END/PARTIE_END/MATCH_END). Les runTransaction entrent
        // en conflit avec les écritures NEXT_ROUND de l'hôte → avalanche de FAILED_PRECONDITION,
        // round suivant bloqué et badge "Reprise de connexion" en boucle.
        const phase = externalGamePhaseRef?.current;
        if (isHeartbeatSuspendedPhase(phase)) {
            logPresence({
                event: 'status_transition_skipped',
                source: 'reconnect',
                decision: 'suspended_phase',
                phase,
                statusTo: 'HUMAN',
            });
            return;
        }

        // Publier le retour RTDB en premier annule immédiatement les timers de grâce adverses.
        // La transaction Firestore restaure ensuite le statut partagé si nécessaire.
        const presenceConnectionId = presenceConnectionIdRef.current
            ?? createPresenceConnectionId();
        presenceConnectionIdRef.current = presenceConnectionId;
        const presenceRef = ref(
            rtdb,
            `presence/${gameId}/${localPlayerId}/connections/${presenceConnectionId}`
        );
        const roomRef = doc(db, 'rooms', gameId);
        try {
            logPresence({
                event: 'status_transition_started',
                source: 'reconnect',
                phase,
                statusTo: 'HUMAN',
            });
            const presenceAtMs = Date.now();
            await rtdbOnDisconnect(presenceRef).remove();
            await set(presenceRef, { status: 'online', t: presenceAtMs });

            await runTransaction(db, async (transaction) => {
                const roomDoc = await transaction.get(roomRef);
                if (!roomDoc.exists()) return;

                const currentRoomData = roomDoc.data() as GameRoom;
                // For coordinated rooms, Functions owns HUMAN/DISCONNECTED.
                // Renew immediately so a valid reconnect can cancel a pending bot
                // action without waiting for the regular ten-second interval.
                if (currentRoomData.coordinatorVersion === 1) {
                    transaction.update(roomRef, {
                        [`heartbeats.${localPlayerId}`]: serverTimestamp(),
                    });
                    return;
                }
                const state = currentRoomData.gameState;
                if (!state || !state.players) return;

                let stateUpdated = false;
                const updatedPlayers = state.players.map((p) => {
                    if (p.id === localPlayerId && shouldRestoreHumanStatus(p.status)) {
                        stateUpdated = true;
                        return { ...p, status: 'HUMAN' as const };
                    }
                    return p;
                });

                if (stateUpdated) {
                    transaction.update(roomRef, { 'gameState.players': updatedPlayers });
                    logPresence({
                        event: 'status_transition_applied',
                        source: 'reconnect',
                        phase,
                        statusFrom: 'DISCONNECTED',
                        statusTo: 'HUMAN',
                    });
                    setIsRejoining(true);
                    if (rejoinTimerRef.current) clearTimeout(rejoinTimerRef.current);
                    rejoinTimerRef.current = setTimeout(() => setIsRejoining(false), 3000);
                }
            });
        } catch (error) {
            logPresence({
                event: 'status_transition_failed',
                source: 'reconnect',
                errorCode: presenceErrorCode(error),
                phase,
                statusTo: 'HUMAN',
            });
        }
    }, [externalGamePhaseRef, gameId, isSoloMode, localPlayerId, logPresence]);

    // ─── 4. SIGNAL OFFLINE (quitter volontaire ou crash) ─────────────────────
    // surrendered = true  → joueur a cliqué "Quitter" volontairement → SURRENDERED
    // surrendered = false → crash réseau / OS kill                   → DISCONNECTED
    //
    // SURRENDERED : le bot joue les tours restants, mais le joueur est classé DERNIER
    // en fin de match, quelle que soit la performance de son bot.
    const signalPlayerOffline = useCallback(async (surrendered = false) => {
        if (!gameId || isSoloMode) return;

        const newStatus = surrendered ? 'SURRENDERED' as const : 'DISCONNECTED' as const;
        const roomRef = doc(db, 'rooms', gameId);
        try {
            logPresence({
                event: 'status_transition_started',
                source: surrendered ? 'manual_leave' : 'rtdb_presence',
                phase: externalGamePhaseRef?.current,
                statusFrom: 'HUMAN',
                statusTo: newStatus,
            });
            await runTransaction(db, async (transaction) => {
                const roomDoc = await transaction.get(roomRef);
                if (!roomDoc.exists()) return;

                const currentRoomData = roomDoc.data() as GameRoom;
                // A disconnect is inferred by the server-side lease for coordinated
                // rooms. Surrender is handled by submitGameAction instead.
                if (currentRoomData.coordinatorVersion === 1) return;
                const state = currentRoomData.gameState;
                if (!state || !state.players) return;

                const updatedPlayers = state.players.map((p) => {
                    if (p.id === localPlayerId) {
                        return { ...p, status: newStatus };
                    }
                    return p;
                });

                transaction.update(roomRef, { 'gameState.players': updatedPlayers });
            });
            logPresence({
                event: 'status_transition_applied',
                source: surrendered ? 'manual_leave' : 'rtdb_presence',
                phase: externalGamePhaseRef?.current,
                statusFrom: 'HUMAN',
                statusTo: newStatus,
            });
        } catch (error) {
            logPresence({
                event: 'status_transition_failed',
                source: surrendered ? 'manual_leave' : 'rtdb_presence',
                errorCode: presenceErrorCode(error),
                phase: externalGamePhaseRef?.current,
                statusTo: newStatus,
            });
        }
    }, [externalGamePhaseRef, gameId, isSoloMode, localPlayerId, logPresence]);

    useEffect(() => {
        signalPlayerOfflineRef.current = signalPlayerOffline;
    }, [signalPlayerOffline]);

    return {
        isRejoining,
        diagnosticConnectionId,
        signalPlayerOnline,
        signalPlayerOffline,
        forceImmediatePing,
    };
};
