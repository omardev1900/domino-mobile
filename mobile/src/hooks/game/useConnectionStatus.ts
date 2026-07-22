import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db, rtdb } from '../../core/services/firebase';
import { doc, runTransaction, updateDoc } from 'firebase/firestore';
import { ref, set, onValue, onDisconnect as rtdbOnDisconnect } from 'firebase/database';
import { GameRoom } from '../../core/types';
import { LogService } from '../../core/services/LogService';

export interface UseConnectionStatusProps {
    gameId: string | undefined;
    localPlayerId: string;
    isSoloMode: boolean;
    isLocalHost?: boolean;
    roomData?: GameRoom | null;
    /**
     * Ref mis à jour par GameScreen après useGameSync — suspend le heartbeat Firestore
     * pendant les transitions critiques sans créer de dépendance circulaire de hook.
     */
    gamePhaseRef?: React.MutableRefObject<string | undefined>;
}

export interface UseConnectionStatusResult {
    isRejoining: boolean;
    signalPlayerOnline: () => Promise<void>;
    signalPlayerOffline: (surrendered?: boolean) => Promise<void>;
    /** Ping immédiat à appeler dès la sortie d'une phase critique (ex: PARTIE_END → PLAYING) pour
     * réinitialiser le chrono de présence sans attendre le prochain tick du setInterval. */
    forceImmediatePing: () => Promise<void>;
}

/** Phases durant lesquelles le heartbeat Firestore est suspendu pour éviter d'invalider les transactions NEXT_ROUND */
const CRITICAL_PHASES = new Set(['PARTIE_END', 'MANCHE_END', 'MATCH_END']);

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
    useEffect(() => () => {
        if (rejoinTimerRef.current) clearTimeout(rejoinTimerRef.current);
    }, []);

    // ─── 1. HEARTBEAT FIRESTORE (fallback 25s) ───────────────────────────────
    // Conservé comme filet de sécurité si RTDB n'est pas disponible.
    // FIX-400: ping suspendu pendant les phases critiques (PARTIE_END/MANCHE_END/MATCH_END).
    // Les updateDoc du heartbeat vont dans la write-queue interne du SDK et invalident
    // les runTransaction de transition NEXT_ROUND → FAILED_PRECONDITION (HTTP 400) en boucle.
    // FIX-REGRESSION-#8: intervalle ramené à 10s (était passé à 20s dans #8).
    // 20s + pause 12s = 32s > seuil vigilance 25s → marquage DISCONNECTED intempestif.
    // 10s + pause 12s = 22s < 25s → sûr.
    const sendPing = useCallback(async () => {
        if (!gameId || isSoloMode) return;
        // Suspendre pendant les transitions critiques pour ne pas invalider les transactions
        const phase = externalGamePhaseRef?.current;
        if (phase && CRITICAL_PHASES.has(phase)) {
            LogService.debug('ConnectionStatus', `[HEARTBEAT] Skipped during ${phase}`);
            return;
        }
        try {
            const roomRef = doc(db, 'rooms', gameId);
            await updateDoc(roomRef, { [`heartbeats.${localPlayerId}`]: Date.now() });
        } catch {
            // Ignore silent network errors on ping
        }
    }, [gameId, isSoloMode, localPlayerId]); // externalGamePhaseRef est un ref stable, pas besoin de l'inclure

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
            await updateDoc(roomRef, { [`heartbeats.${localPlayerId}`]: Date.now() });
            LogService.debug('ConnectionStatus', '[HEARTBEAT] Ping de rattrapage envoyé (sortie de phase critique)');
        } catch {
            // Ignore silent network errors
        }
    }, [gameId, isSoloMode, localPlayerId]);

    // ─── 2. PRÉSENCE RTDB + onDisconnect (détection rapide ~3-5s) ────────────
    // Structure RTDB : /presence/{gameId}/{uid} = { status: 'online'|'offline', t: timestamp }
    //
    // Fonctionnement :
    //   - Au mount : on s'enregistre comme 'online' et on programme un onDisconnect 'offline'
    //   - Firebase exécute le onDisconnect côté serveur dès que le TCP se ferme (~3s)
    //   - GameScreen écoute ces changements et marque le joueur DISCONNECTED dans Firestore
    //   - Au démontage propre (rage-quit, quitter la partie) : on écrit 'offline' nous-même
    useEffect(() => {
        if (!gameId || isSoloMode || !localPlayerId) return;

        const presenceRef = ref(rtdb, `presence/${gameId}/${localPlayerId}`);
        const connectedRef = ref(rtdb, '.info/connected');

        // Écouter l'état de connexion RTDB pour (re)configurer le onDisconnect
        // à chaque reconnexion réseau.
        // onValue retourne une fonction Unsubscribe (Firebase v9 modular API)
        const unsubConnected = onValue(connectedRef, async (snap) => {
            if (!snap.val()) return; // Pas encore connecté au RTDB

            try {
                // Programmer l'écriture automatique côté serveur en cas de déconnexion
                await rtdbOnDisconnect(presenceRef).set({
                    status: 'offline',
                    t: Date.now(),
                });
                // Se déclarer en ligne
                await set(presenceRef, { status: 'online', t: Date.now() });
                LogService.info('ConnectionStatus', '[RTDB] Presence set to online, onDisconnect armed.');
            } catch (err) {
                LogService.warn('ConnectionStatus', '[RTDB] Failed to set presence:', err);
            }
        });

        return () => {
            // FIX-CLEANUP: unsubConnected est la fonction Unsubscribe renvoyée par onValue,
            // pas le callback — il faut l'appeler directement, pas la passer à off().
            unsubConnected();
            set(presenceRef, { status: 'offline', t: Date.now() }).catch(() => {});
        };
    }, [gameId, isSoloMode, localPlayerId]);

    // ─── 3. SIGNAL ONLINE (reconnexion) ──────────────────────────────────────
    const signalPlayerOnline = useCallback(async () => {
        if (!gameId || isSoloMode) return;

        // FIX-BOUCLE-400: comme sendPing, ne jamais lancer de transaction pendant les
        // phases critiques (MANCHE_END/PARTIE_END/MATCH_END). Les runTransaction entrent
        // en conflit avec les écritures NEXT_ROUND de l'hôte → avalanche de FAILED_PRECONDITION,
        // round suivant bloqué et badge "Reprise de connexion" en boucle.
        const phase = externalGamePhaseRef?.current;
        if (phase && CRITICAL_PHASES.has(phase)) {
            LogService.debug('ConnectionStatus', `[ONLINE] signalPlayerOnline skipped during ${phase}`);
            return;
        }

        const roomRef = doc(db, 'rooms', gameId);
        try {
            await runTransaction(db, async (transaction) => {
                const roomDoc = await transaction.get(roomRef);
                if (!roomDoc.exists()) return;

                const currentRoomData = roomDoc.data() as GameRoom;
                const state = currentRoomData.gameState;
                if (!state || !state.players) return;

                let stateUpdated = false;
                const updatedPlayers = state.players.map((p) => {
                    if (p.id === localPlayerId && p.status !== 'HUMAN') {
                        stateUpdated = true;
                        return { ...p, status: 'HUMAN' as const };
                    }
                    return p;
                });

                if (stateUpdated) {
                    transaction.update(roomRef, { 'gameState.players': updatedPlayers });
                    setIsRejoining(true);
                    if (rejoinTimerRef.current) clearTimeout(rejoinTimerRef.current);
                    rejoinTimerRef.current = setTimeout(() => setIsRejoining(false), 3000);
                }
            });

            // Remettre la présence RTDB à 'online' et réarmer le onDisconnect
            if (gameId && localPlayerId) {
                const presenceRef = ref(rtdb, `presence/${gameId}/${localPlayerId}`);
                await rtdbOnDisconnect(presenceRef).set({ status: 'offline', t: Date.now() });
                await set(presenceRef, { status: 'online', t: Date.now() });
            }
        } catch (error) {
            LogService.error('ConnectionStatus', 'Error signalPlayerOnline:', error);
        }
    }, [gameId, isSoloMode, localPlayerId]);

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
            await runTransaction(db, async (transaction) => {
                const roomDoc = await transaction.get(roomRef);
                if (!roomDoc.exists()) return;

                const currentRoomData = roomDoc.data() as GameRoom;
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
            LogService.info('ConnectionStatus', `[OFFLINE] Player ${localPlayerId} → ${newStatus}`);
        } catch (error) {
            LogService.error('ConnectionStatus', 'Error signalPlayerOffline:', error);
        }
    }, [gameId, isSoloMode, localPlayerId]);

    useEffect(() => {
        signalPlayerOfflineRef.current = signalPlayerOffline;
    }, [signalPlayerOffline]);

    return {
        isRejoining,
        signalPlayerOnline,
        signalPlayerOffline,
        forceImmediatePing,
    };
};
