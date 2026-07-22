import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

import { View, StyleSheet, Text, StatusBar, TouchableOpacity, Alert, useWindowDimensions, Image, Platform, Pressable, AppState, AppStateStatus } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, FadeInLeft, FadeInRight, FadeIn, ZoomIn, FadeOut, FadeInUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as NavigationBar from 'expo-navigation-bar';
import * as Sentry from '@sentry/react-native';
import { GameTable , GameTableRef } from '../components/GameTable';
import { PlayerHand } from '../components/PlayerHand';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { GameHeader } from '../components/game/GameHeader';
import { GameOptionsMenu } from '../components/game/GameOptionsMenu';
import { GameOverlays } from '../components/game/GameOverlays';
import { PlayerArea } from '../components/game/PlayerArea';
import { NetworkRequiredScreen } from '../components/NetworkRequiredScreen';
import { HandSortMode } from '../components/PlayerHand';
import { ActionFooter } from '../components/game/ActionFooter';
import { LobbyScreen } from './LobbyScreen';
import { UnifiedResultOverlay } from '../components/UnifiedResultOverlay';
import { QuickChat } from '../components/QuickChat';
import { RoundEndFlow } from '../components/game/RoundEndFlow';
import { MancheEndFlow } from '../components/game/MancheEndFlow';
import { RewardOverlay } from '../components/RewardOverlay';
import { MatchRewardModal } from '../components/MatchRewardModal';

// Core
import { determineFirstPlayer, dealGameSolo, getForcedOpeningDominoId, getForcedTieBreakDominoId, dealGame } from '../core/LogicEngine';
import { getValidMoves } from '../core/DominoEngine';
import { GameState, Player, PlayerId, GamePhase, Domino, GameRoom, GameMode } from '@/core/types';
import { leaveRoom, startGame, clearRematchVotes, updatePlayerChat, resetRoomToLobby, markPlayerAsDebited, markRoomAsFinished, setUserActiveRoom, deleteWaitingRoomIfOwner } from '../core/services/firebase';
import SoundManager from '../core/audio/SoundManager';
import HapticManager from '../core/audio/HapticManager';
import { HAND_SIZE } from '../core/constants';
import SettingsManager from '../core/SettingsManager';
import { TableTheme } from '../core/themes/tableThemes';
import { authService } from '../core/services/auth.service';
import { AVAILABLE_AVATARS, AvatarId } from '../core/avatars';

import { FlyingDominoData } from '../core/animations/AnimationTypes';
import { FlyingDomino } from '../components/FlyingDomino';
import { useConnectionStatus } from '../hooks/game/useConnectionStatus';
import { useGameSync } from '../hooks/game/useGameSync';
import { useGameTimers } from '../hooks/game/useGameTimers';
import { useGameEngine } from '../hooks/game/useGameEngine';
import { statsService } from '../core/services/stats.service';
import { getMonthlyCochonsFromHistory } from '../core/leagueProgress';
import { economyService } from '../core/services/economy.service';
import { storeService } from '../core/services/store.service';
import { botService } from '../core/services/bot.service';
import { LogService } from '../core/services/LogService';
import { RewardEngine } from '../core/RewardEngine';
import { MatchReward, TableTier } from '../core/economy.types';
import { TABLE_CONFIGS } from '../core/economy.constants';
import { SkinConfig } from '../core/store.types';
import { useInterstitialAd, TestIds, AdMobIds } from '../core/services/AdMobAdapter';
import { rtdb } from '../core/services/firebase';
import { ref as rtdbRef, onValue as rtdbOnValue, off as rtdbOff } from 'firebase/database';

interface GameScreenProps {
    gameId?: string;
    userId?: string;
    authUid?: string;
    mode?: 'solo' | 'multiplayer';
    difficulty?: 'TI_MANMAY' | 'MAPIPI' | 'GRAN_MOUN';
    gameMode?: GameMode;
    winningCondition?: number;
    turnDuration?: number;
    startingHandSize?: number;
    tableTier?: string; // TableTier passé depuis solo.tsx / lobby.tsx
}

export default function GameScreen({ gameId, userId, authUid, mode, difficulty, gameMode, winningCondition, turnDuration, startingHandSize: propStartingHandSize, tableTier: propTableTier }: GameScreenProps) {
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const isLandscape = width > height;
    const router = useRouter();
    const navigation = useNavigation();

    // -- 1. Basal State & Identity --
    const [localPlayerId] = useState<PlayerId>(userId || 'p1');
    const [isSoloMode] = useState(mode === 'solo');
    const [startingHandSize] = useState(propStartingHandSize || HAND_SIZE);
    const [activeTableTier] = useState<TableTier>((propTableTier as TableTier) || 'DEBUTANT');
    const persistenceUserId = authUid || userId;

    // FIX-400: Ref de phase créé AVANT useConnectionStatus (gameState n'est pas encore dispo ici).
    // Mis à jour via useEffect après useGameSync. useConnectionStatus lit .current lors de chaque ping.
    const gamePhaseForHBRef = useRef<string | undefined>(undefined);

    // -- 2. Connection Status --
    const { isRejoining, signalPlayerOnline, signalPlayerOffline, forceImmediatePing } = useConnectionStatus({
        gameId,
        localPlayerId,
        isSoloMode,
        gamePhaseRef: gamePhaseForHBRef,
    });

    // Rage Quit / Tab Close Web Security (Déplacé ici car GameScreen est le point de montage principal)
    useEffect(() => {
        if (Platform.OS !== 'web' || isSoloMode || !gameId) return;
        const handleBeforeUnload = () => { signalPlayerOffline(); };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [gameId, isSoloMode, signalPlayerOffline]);

    useEffect(() => {
        if (isSoloMode || !gameId) return;
        AsyncStorage.setItem('active_roomId', gameId).catch(err => LogService.error('GameScreen', 'Error setting active_roomId', err));
        if (localPlayerId && localPlayerId !== 'p1') {
            setUserActiveRoom(localPlayerId, gameId).catch(err => LogService.error('GameScreen', 'Error setting user active room', err));
        }

        // --- SENTRY ENRICHMENT ---
        Sentry.setTag('roomId', gameId);
        Sentry.setTag('gameMode', mode || 'unknown');

        return () => {
            Sentry.setTag('roomId', 'none');
            Sentry.setTag('gameMode', 'none');
        };
    }, [gameId, isSoloMode, localPlayerId, mode]);

    // -- 3. Sync Hook (Network & Reconnection) --
    const {
        gameState,
        roomData,
        isStarting,
        setIsStarting,
        safeUpdateGameState,
        setGameState,
        setRoomData
    } = useGameSync({ gameId, localPlayerId, isSoloMode, signalPlayerOnline });

    // FIX-400: maintenir le ref de phase à jour pour que useConnectionStatus puisse
    // suspendre les heartbeats Firestore pendant les transitions critiques.
    // FIX-REGRESSION-#8: ping immédiat à la sortie d'une phase critique (→ PLAYING) pour
    // réinitialiser le chrono de présence sans attendre le prochain tick du setInterval.
    useEffect(() => {
        const prevPhase = gamePhaseForHBRef.current;
        gamePhaseForHBRef.current = gameState?.phase;
        if (gameState?.phase === 'PLAYING' && prevPhase !== 'PLAYING' && prevPhase !== undefined) {
            forceImmediatePing();
        }
    }, [gameState?.phase, forceImmediatePing]);

    const [timeLeftState, setTimeLeftState] = useState<number | null>(null);
    const [overtimeState, setOvertimeState] = useState<number | null>(null);

    const hasBeenDebited = useRef(false);
    const [debitFeedback, setDebitFeedback] = useState<string | null>(null);
    const isIntentionalLeave = useRef(false);

    // -- ACTING HOST LOGIC --
    // Le vrai hôte est celui désigné par isHost, ou à défaut le créateur.
    let currentHostUid = roomData?.players.find(p => p.isHost)?.uid || roomData?.createdBy;
    
    // Si la partie est lancée et que l'hôte officiel est déconnecté (ou est un bot), 
    // FIX-HOST-ELECTION: Lire gameState.players (statut en jeu) et NON roomData.players
    // (statut de lobby, jamais mis à jour pendant la partie via signalPlayerOffline).
    // Avant ce fix, isDesignatedHostActive était toujours true → aucune élection ne se déclenchait.
    if (!isSoloMode && roomData?.players && gameState?.players) {
        const isDesignatedHostActive = gameState.players.some(
            gp => gp.id === currentHostUid && gp.status === 'HUMAN'
        );
        if (!isDesignatedHostActive) {
            const firstActiveHumanUid = roomData.players
                .map(rp => rp.uid)
                .find(uid => gameState.players.some(gp => gp.id === uid && gp.status === 'HUMAN'));
            if (firstActiveHumanUid) {
                currentHostUid = firstActiveHumanUid;
                LogService.info('GameScreen', `[HOST-ELECTION] Acting host elected: ${firstActiveHumanUid}`);
            } else {
                // Aucun joueur HUMAN trouvé — l'élection échoue silencieusement.
                // Dans ce cas, currentHostUid reste l'hôte d'origine (déconnecté), personne
                // n'est isLocalHost → le bot ne sera pas joué. Cela ne devrait pas arriver
                // en jeu normal (au moins un joueur HUMAN = le joueur local lui-même).
                LogService.warn('GameScreen', '[HOST-ELECTION] No active HUMAN player found — election produced no result. currentHostUid kept as original.');
            }
        }
    }

    const isLocalHost = isSoloMode || (currentHostUid === localPlayerId);

    // -- VIGILANCE FIRESTORE: fallback heartbeat (tous les joueurs, seuil 25s) --
    // FIX-VIGILANCE: Guard !isLocalHost supprimé → tous les clients peuvent marquer DISCONNECTED.
    // FIX-VIGILANCE-REF: roomData lu via ref pour éviter le reset de l'intervalle à chaque snapshot.
    const roomDataRef = useRef(roomData);
    useEffect(() => { roomDataRef.current = roomData; }, [roomData]);

    useEffect(() => {
        if (!gameId || isSoloMode) return;

        const checkInterval = setInterval(async () => {
            const currentRoomData = roomDataRef.current;
            if (!currentRoomData?.gameState?.players) return;

            const now = Date.now();
            let hasTimedOutPlayers = false;

            const updatedPlayers = currentRoomData.gameState.players.map(p => {
                if (p.id === localPlayerId || p.status !== 'HUMAN') return p;
                const lastPing = currentRoomData.heartbeats?.[p.id] ?? 0;
                if (now - lastPing > 25000) {
                    hasTimedOutPlayers = true;
                    LogService.info('GameScreen', `[VIGILANCE] Player ${p.id} timed out (${Math.round((now - lastPing) / 1000)}s). Marking DISCONNECTED.`);
                    return { ...p, status: 'DISCONNECTED' as const };
                }
                return p;
            });

            if (hasTimedOutPlayers) {
                try {
                    const { updateDoc, doc } = await import('firebase/firestore');
                    const { db } = await import('../core/services/firebase');
                    const roomRef = doc(db, 'rooms', gameId);
                    await updateDoc(roomRef, { 'gameState.players': updatedPlayers });
                } catch (error) {
                    LogService.error('GameScreen', '[VIGILANCE] Error marking player disconnected:', error);
                }
            }
        }, 5000);

        return () => clearInterval(checkInterval);
        // roomData retiré des deps — lu via roomDataRef pour éviter le reset permanent
    }, [gameId, isSoloMode, localPlayerId]);

    // -- VIGILANCE RTDB: détection rapide via présence Firebase (~3-5s) --
    // Dès qu'un joueur passe offline dans RTDB (onDisconnect côté serveur), on attend
    // une GRACE PERIOD avant de le marquer DISCONNECTED dans Firestore.
    // Ce délai évite le "flapping" sur connexion instable (slow 4G) : si le joueur
    // se reconnecte dans le délai, le timer est annulé et rien n'est écrit.
    // FIX-MIDTURN-FREEZE: Si le joueur offline est le joueur actif (PLAYING, c'est son tour),
    // on utilise une grace period réduite (1s au lieu de 4s) pour que l'élection d'hôte
    // et le coup du bot se déclenchent en ~3-4s au lieu de ~7s.
    const rtdbOfflineTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    useEffect(() => {
        if (!gameId || isSoloMode) return;

        const presenceRef = rtdbRef(rtdb, `presence/${gameId}`);
        const GRACE_PERIOD_MS = 4000;       // 4s — absorbe le flapping TCP sur slow 4G
        const ACTIVE_TURN_GRACE_MS = 1000;  // 1s — joueur actif bloque le jeu, détection prioritaire

        const unsubPresence = rtdbOnValue(presenceRef, (snapshot) => {
            const presenceData = snapshot.val() as Record<string, { status: string; t: number }> | null;
            if (!presenceData) return;

            Object.entries(presenceData).forEach(([uid, data]) => {
                if (uid === localPlayerId) return;

                if (data.status === 'offline') {
                    // Déjà un timer en cours pour ce joueur → pas de doublon
                    if (rtdbOfflineTimers.current[uid]) return;

                    // Réduire la grace period si c'est le joueur dont c'est le tour :
                    // son absence bloque toute la partie, donc on accélère la détection.
                    const currentGS = roomDataRef.current?.gameState;
                    const isActiveTurnPlayer = currentGS?.phase === 'PLAYING'
                        && uid === currentGS?.currentPlayerId;
                    const effectiveGraceMs = isActiveTurnPlayer ? ACTIVE_TURN_GRACE_MS : GRACE_PERIOD_MS;

                    LogService.info('GameScreen', `[RTDB-PRESENCE] Player ${uid} offline — grace period ${effectiveGraceMs}ms${isActiveTurnPlayer ? ' (ACTIVE TURN — faster detection)' : ''}`);
                    rtdbOfflineTimers.current[uid] = setTimeout(async () => {
                        delete rtdbOfflineTimers.current[uid];

                        // Vérifier l'état actuel avant d'écrire (le joueur a peut-être déjà reconnecté)
                        const currentRoomData = roomDataRef.current;
                        if (!currentRoomData?.gameState?.players) return;

                        const player = currentRoomData.gameState.players.find(p => p.id === uid);
                        if (!player || player.status !== 'HUMAN') return; // Déjà DISCONNECTED ou BOT

                        LogService.info('GameScreen', `[RTDB-PRESENCE] Grace period expired — marking ${uid} DISCONNECTED`);
                        const updatedPlayers = currentRoomData.gameState.players.map(p =>
                            p.id === uid ? { ...p, status: 'DISCONNECTED' as const } : p
                        );

                        try {
                            const { updateDoc, doc } = await import('firebase/firestore');
                            const { db } = await import('../core/services/firebase');
                            await updateDoc(doc(db, 'rooms', gameId), { 'gameState.players': updatedPlayers });
                        } catch (error) {
                            LogService.error('GameScreen', '[RTDB-PRESENCE] Error marking player disconnected:', error);
                        }
                    }, effectiveGraceMs);

                } else if (data.status === 'online') {
                    // Joueur de retour pendant la grace period → annuler le timer
                    if (rtdbOfflineTimers.current[uid]) {
                        LogService.info('GameScreen', `[RTDB-PRESENCE] Player ${uid} back online — grace period cancelled`);
                        clearTimeout(rtdbOfflineTimers.current[uid]);
                        delete rtdbOfflineTimers.current[uid];
                    }
                }
            });
        });

        return () => {
            unsubPresence();
            // Annuler tous les timers en suspens au démontage
            Object.values(rtdbOfflineTimers.current).forEach(clearTimeout);
            rtdbOfflineTimers.current = {};
        };
    }, [gameId, isSoloMode, localPlayerId]);

    const [isPaused, setIsPaused] = useState(false);
    const [showOptions, setShowOptions] = useState(false);

    // -- BUG-DOMINO-SIZE-ON-RESUME: layout key pour forcer recalcul apres retour d'appel/notification --
    // GameTable.boardScale utilise useWindowDimensions() qui peut retourner des valeurs transitoires
    // apres un AppState change vers 'active'. Incrementer layoutKey force un remount de GameTable
    // avec les bonnes dimensions fraiches.
    const [layoutKey, setLayoutKey] = useState(0);
    useEffect(() => {
        if (Platform.OS === 'web') return; // web n'a pas d'interruptions telephoniques
        const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
            if (nextState === 'active') {
                // L'app revient au premier plan : laisser les dimensions se stabiliser (150ms)
                // puis forcer le recalcul de boardScale dans GameTable via un remount.
                setTimeout(() => setLayoutKey(k => k + 1), 150);
                LogService.debug('GameScreen', 'AppState -> active, forcing layout refresh');
            }
        });
        return () => subscription.remove();
    }, []);

    // Référence mutable pour stocker la fonction handleTimeout issue du moteur
    const handleTimeoutRef = useRef<((pId: string, turnId?: number) => void) | null>(null);
    
    // Callback stable passé à useGameTimers
    const handleTimeoutCb = useCallback((pId: string, turnId?: number) => {
        if (handleTimeoutRef.current) {
            handleTimeoutRef.current(pId, turnId);
        }
    }, []);

    // Pub in-game : pause moteur + mémorisation de la transition en attente
    const [isAdVisible, setIsAdVisible] = useState(false);
    const isAdVisibleRef = useRef(false);

    const [flyingDomino, setFlyingDomino] = useState<FlyingDominoData | null>(null);
    const [hiddenDominoId, setHiddenDominoId] = useState<string | null>(null);
    const [isMoveAnimationPending, setIsMoveAnimationPending] = useState(false);
    const tableRef = useRef<GameTableRef>(null);
    const lastPlayStartPos = useRef<{ x: number, y: number } | null>(null);
    const avatarRefs = useRef<{ [key: string]: any }>({});
    const animatedHistoryLengthRef = useRef(gameState?.history?.length || 0);
    const animatedPlayKeysRef = useRef<Set<string>>(new Set());
    const pendingLocalPlayAnimationRef = useRef<{
        dominoId: string;
        animationId: string;
        startPoint: { x: number, y: number };
    } | null>(null);
    const [localHandAnimationSnapshot, setLocalHandAnimationSnapshot] = useState<Domino[] | null>(null);
    const [hiddenHandDominoId, setHiddenHandDominoId] = useState<string | null>(null);
    const [preserveLocalHandHighlights, setPreserveLocalHandHighlights] = useState(false);
    const [preservedPlayableDominoIds, setPreservedPlayableDominoIds] = useState<string[]>([]);
    const [turnDisplayHold, setTurnDisplayHold] = useState<{
        currentPlayerId: PlayerId;
        phase: GamePhase;
        turnId: number;
        lastActionTimestamp: number;
    } | null>(null);

    const pendingHistoryLengthDiff = (gameState?.history?.length || 0) - animatedHistoryLengthRef.current;
    const pendingHistoryMove = pendingHistoryLengthDiff > 0 ? gameState?.history?.[gameState.history.length - 1] : null;
    const pendingHistoryDominoId = pendingHistoryMove?.action === 'PLAY' && pendingHistoryMove.domino
        ? pendingHistoryMove.domino.id
        : null;
    const effectiveHiddenDominoId = hiddenDominoId ?? pendingHistoryDominoId;

    const isGamePaused = isPaused || showOptions || isAdVisible;
    const isMoveAnimationActive = isMoveAnimationPending || !!flyingDomino || !!hiddenDominoId || !!pendingHistoryDominoId;
    const pendingTurnDisplayHold = pendingHistoryMove?.action === 'PLAY'
        ? {
            currentPlayerId: pendingHistoryMove.playerId,
            phase: 'PLAYING' as GamePhase,
            turnId: Math.max(0, (gameState?.turnId ?? 0) - 1),
            lastActionTimestamp: pendingHistoryMove.timestamp ?? gameState?.lastActionTimestamp ?? 0,
        }
        : null;
    const activeTurnDisplayHold = turnDisplayHold ?? pendingTurnDisplayHold;
    const currentDisplayState = useMemo(() => {
        if (!gameState || !isMoveAnimationActive || !activeTurnDisplayHold) {
            return gameState;
        }

        return {
            ...gameState,
            currentPlayerId: activeTurnDisplayHold.currentPlayerId,
            phase: activeTurnDisplayHold.phase,
            turnId: activeTurnDisplayHold.turnId,
            lastActionTimestamp: activeTurnDisplayHold.lastActionTimestamp,
        };
    }, [activeTurnDisplayHold, gameState, isMoveAnimationActive]);

    const finishFlyingDomino = useCallback((reason: 'finished' | 'watchdog' = 'finished') => {
        if (reason === 'watchdog') {
            LogService.warn('GameScreen', '[ANIM-DOMINO] Animation watchdog cleared a stuck flying domino.');
        }
        setFlyingDomino(null);
        setHiddenDominoId(null);
        setIsMoveAnimationPending(false);
        setLocalHandAnimationSnapshot(null);
        setHiddenHandDominoId(null);
        setPreserveLocalHandHighlights(false);
        setPreservedPlayableDominoIds([]);
        setTurnDisplayHold(null);
        lastPlayStartPos.current = null;
    }, []);

    useEffect(() => {
        if (!flyingDomino) return;
        const watchdog = setTimeout(() => finishFlyingDomino('watchdog'), 1400);
        return () => clearTimeout(watchdog);
    }, [flyingDomino, finishFlyingDomino]);

    const pendingPhaseTransitionRef = useRef<(() => void) | null>(null);

    // -- 4. Timer Hook --
    const {
        timeLeft,
        setTimeLeft,
        overtime,
        setOvertime,
        clearAllTurnTimers
    } = useGameTimers({
        gameState: currentDisplayState,
        isPaused: isGamePaused || isMoveAnimationActive,
        localPlayerId,
        onTimeout: (pId, turnId) => handleTimeoutCb(pId, turnId)
    });

    // -- 5. The Façade Game Engine --
    useEffect(() => {
        if (!gameState?.history) return;
        
        const currentLength = gameState.history.length;
        if (currentLength > animatedHistoryLengthRef.current) {
            const newActions = gameState.history.slice(animatedHistoryLengthRef.current);
            const lastMoveIndex = currentLength - 1;
            animatedHistoryLengthRef.current = currentLength;
            
            const lastMove = newActions[newActions.length - 1];
            if (lastMove.action === 'PLAY' && lastMove.domino) {
                const playKey = [
                    gameState.gameId,
                    gameState.mancheNumber,
                    gameState.roundNumber,
                    lastMoveIndex,
                    lastMove.playerId,
                    lastMove.domino.id,
                    lastMove.timestamp ?? 'no-ts'
                ].join(':');

                if (animatedPlayKeysRef.current.has(playKey)) {
                    setHiddenDominoId(null);
                    setIsMoveAnimationPending(false);
                    return;
                }
                animatedPlayKeysRef.current.add(playKey);

                const isLocal = lastMove.playerId === localPlayerId;
                const pendingLocalAnimation = isLocal
                    && pendingLocalPlayAnimationRef.current?.dominoId === lastMove.domino.id
                    ? pendingLocalPlayAnimationRef.current
                    : null;
                const animationId = pendingLocalAnimation?.animationId ?? playKey;

                setTurnDisplayHold({
                    currentPlayerId: lastMove.playerId,
                    phase: 'PLAYING',
                    turnId: Math.max(0, (gameState.turnId ?? 0) - 1),
                    lastActionTimestamp: lastMove.timestamp ?? gameState.lastActionTimestamp ?? 0,
                });
                setIsMoveAnimationPending(true);
                setHiddenDominoId(lastMove.domino.id);
                let startPoint = pendingLocalAnimation?.startPoint ?? { x: width / 2, y: height / 2 };

                if (!pendingLocalAnimation && isLocal && lastPlayStartPos.current) {
                    startPoint = lastPlayStartPos.current;
                }

                const triggerAnimation = (start: { x: number, y: number }) => {
                    const showFlight = (data: FlyingDominoData) => {
                        setHiddenDominoId(data.domino.id);
                        if (!data.holdAtStart) {
                            setPreserveLocalHandHighlights(false);
                        }
                        setFlyingDomino(data);
                    };

                    setTimeout(() => {
                        let measured = false;
                        const fallbackTimeout = setTimeout(() => {
                            if (measured) return;
                            measured = true;
                            showFlight({
                                animationId,
                                domino: lastMove.domino!,
                                startPoint: start,
                                baseSize: pendingLocalAnimation ? 38 : 34,
                                orientation: 'vertical',
                                isReversed: false
                            });
                        }, 90);

                        tableRef.current?.measureTile(lastMove.domino!.id, (endX: number, endY: number, w: number, h: number, meta) => {
                            if (measured) return;
                            measured = true;
                            clearTimeout(fallbackTimeout);
                            if (w > 0) {
                                showFlight({
                                    animationId,
                                    domino: lastMove.domino!,
                                    startPoint: start,
                                    endPoint: { x: endX, y: endY },
                                    baseSize: pendingLocalAnimation ? 38 : 34,
                                    width: w,
                                    height: h,
                                    orientation: meta?.orientation ?? (w > h ? 'horizontal' : 'vertical'),
                                    isReversed: meta?.isReversed ?? false,
                                    visualLeft: meta?.visualLeft,
                                    visualRight: meta?.visualRight,
                                });
                            } else {
                                showFlight({
                                    animationId,
                                    domino: lastMove.domino!,
                                    startPoint: start,
                                    baseSize: pendingLocalAnimation ? 38 : 34,
                                    orientation: 'vertical',
                                    isReversed: false
                                });
                            }
                        });
                    }, 16);
                };

                if (!isLocal && avatarRefs.current[lastMove.playerId]) {
                    let avatarMeasured = false;
                    const avatarFallback = setTimeout(() => {
                        if (avatarMeasured) return;
                        avatarMeasured = true;
                        triggerAnimation(startPoint);
                    }, 200);

                    avatarRefs.current[lastMove.playerId]?.measure((x: number, y: number, w: number, h: number, px: number, py: number) => {
                        if (avatarMeasured) return;
                        avatarMeasured = true;
                        clearTimeout(avatarFallback);
                        triggerAnimation({ x: px + w / 2 - 20, y: py + h / 2 - 40 });
                    });
                } else {
                    triggerAnimation(startPoint);
                }
                if (pendingLocalAnimation) {
                    pendingLocalPlayAnimationRef.current = null;
                }
            } else {
                // If it was a PASS or other action, no animation, just update visual state immediately
                setHiddenDominoId(null);
                setIsMoveAnimationPending(false);
                setTurnDisplayHold(null);
            }
        } else if (currentLength < animatedHistoryLengthRef.current || currentLength === 0) {
            animatedHistoryLengthRef.current = currentLength;
            if (currentLength === 0) {
                animatedPlayKeysRef.current.clear();
            }
            setIsMoveAnimationPending(false);
            setTurnDisplayHold(null);
        }
    }, [gameState?.history, gameState?.gameId, gameState?.mancheNumber, gameState?.roundNumber, gameState?.turnId, localPlayerId, width, height]);

    const handleReplay = async () => {
        if (isSoloMode) {
            if (gameId) {
                await AsyncStorage.removeItem(`@solo_game_state:${gameId}`);
            }
            setIsStarting(false);
            setGameState(null);
            setScoreOverlayPhase(null);
            setShowMatchRewardModal(false);
            
            startSoloGame();
            return;
        }

        if (gameId && roomData) {
            const isHost = roomData.players[0].uid === localPlayerId;
            if (isHost) {
                try {
                    await resetRoomToLobby(gameId);
                    await clearRematchVotes(gameId);
                } catch (e: any) {
                    Alert.alert("Erreur", "Impossible de réinitialiser la salle : " + e.message);
                }
            } else {
                // Non-hôte : quitter directement sans bloquer
                handleLeaveRoom();
            }
        }
    };

    const {
        dispatch,
        handlePlayDomino,
        confirmSidePlay,
        handlePassTurn,
        handleTimeout,
        handleOverlayContinue,
        pendingDomino,
        isProcessingMove
    } = useGameEngine({
        gameState,
        localPlayerId,
        isSoloMode,
        gameId,
        isPaused: isPaused || showOptions || isAdVisible || isMoveAnimationPending,
        isLocalHost,
        roomData,
        userId,
        startingHandSize,
        safeUpdateGameState,
        setGameState,
        clearAllTurnTimers,
        setOvertime,
        setTimeLeft,
        onReplay: handleReplay
    });

    // Wire the timer timeout cb directly to the returned handleTimeout function
    useEffect(() => {
        handleTimeoutRef.current = handleTimeout;
    }, [handleTimeout]);


    // -- 5. UI State remaining --
    const [showRoomInfo] = useState(false); // conservé pour GameOverlays, non déclenché depuis le header
    const [tableTheme, setTableTheme] = useState<TableTheme>('classic');
    const [scoreOverlayPhase, setScoreOverlayPhase] = useState<'MANCHE_END' | 'MATCH_END' | null>(null);
    const [showMatchRewardModal, setShowMatchRewardModal] = useState(false);
    const [matchRewardAmount, setMatchRewardAmount] = useState(100);
    const [showRoundResult, setShowRoundResult] = useState(false);
    // Snapshot du gameState au moment où la carte résultat est déclenchée.
    // Évite que le contenu change si la phase évolue pendant l'affichage (ex: égalité boudé).
    const [roundResultSnapshot, setRoundResultSnapshot] = useState<typeof gameState | null>(null);
    const [isBgmEnabled, setIsBgmEnabled] = useState(() => SettingsManager.getSettings().isBgmEnabled ?? true);
    const [isSfxEnabled, setIsSfxEnabled] = useState(() => SettingsManager.getSettings().isSfxEnabled ?? true);
    const [isVibrationEnabled, setIsVibrationEnabled] = useState(() => SettingsManager.getSettings().isVibrationEnabled);
    const [bannerState, setBannerState] = useState<'NONE' | 'MANCHE' | 'ROUND'>('NONE');
    const [playersChat, setPlayersChat] = useState<{ [playerId: string]: string | null }>({});
    const chatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastChatTimeRef = useRef<number>(0);
    const gameStateRef = useRef<GameState | null>(null);

    // Google AdMob
    const { isLoaded: isAdMobLoaded, isClosed: isAdMobClosed, load: loadAdMob, show: showAdMob } = useInterstitialAd(AdMobIds.INTERSTITIAL_FIN_PARTIE);

    useEffect(() => {
        if (Platform.OS !== 'web') {
            loadAdMob();
        }
    }, [loadAdMob]);

    useEffect(() => {
        if (isAdMobClosed) {
            isAdVisibleRef.current = false;
            setIsAdVisible(false);
            const pending = pendingPhaseTransitionRef.current;
            if (pending) {
                pendingPhaseTransitionRef.current = null;
                pending();
            }
            if (Platform.OS !== 'web') {
                loadAdMob();
            }
        }
    }, [isAdMobClosed, loadAdMob]);

    useEffect(() => {
        gameStateRef.current = gameState;
    }, [gameState]);

    // FIX-TDZ: handleLeaveRoom déclarée ici (après gameStateRef, sa dernière dépendance)
    // pour éviter le ReferenceError "Cannot access before initialization" causé par les
    // useEffect qui la référencent avant sa position originale (~L1680).
    const handleLeaveRoom = useCallback(() => {
        LogService.info('GameScreen', `[QUIT] handleLeaveRoom called. isSoloMode: ${isSoloMode}, gameId: ${gameId}`);

        // 0. Arrêter la musique de jeu immédiatement pour éviter la fuite audio
        SoundManager.stopMusic();

        // Purger l'état du jeu solo local de l'AsyncStorage
        if (isSoloMode && gameId) {
            AsyncStorage.removeItem(`@solo_game_state:${gameId}`).catch(err => LogService.error('GameScreen', 'Error purging solo game state on leave', err));
        }

        // Allow beforeRemove to pass through
        isIntentionalLeave.current = true;

        const isActiveMultiplayerSession = !isSoloMode && !!gameId && gameStateRef.current?.phase !== 'MATCH_END';

        // Cleanup Firestore AVANT la navigation (fire-and-forget)
        if (isActiveMultiplayerSession && gameId) {
            // FIX-SURRENDER: Ne PAS sauvegarder active_roomId — sinon useMultiResume rappelle le joueur.
            // Au lieu de ça : marquer SURRENDERED, retirer de la salle, nettoyer le cache local.
            AsyncStorage.removeItem('active_roomId').catch(err => LogService.error('GameScreen', 'Error removing active_roomId', err));
            if (localPlayerId && localPlayerId !== 'p1') {
                setUserActiveRoom(localPlayerId, null).catch(err => LogService.error('GameScreen', 'Error clearing active room', err));
            }
            signalPlayerOffline(true).catch(e => LogService.error('GameScreen', 'Error marking player offline', e)); // Abandon volontaire → SURRENDERED
            leaveRoom(gameId, localPlayerId).catch(e => LogService.error('GameScreen', 'Error leaving room on surrender', e));
        } else {
            AsyncStorage.removeItem('active_roomId').catch(err => LogService.error('GameScreen', 'Error removing active_roomId', err));
            if (localPlayerId && localPlayerId !== 'p1') {
                setUserActiveRoom(localPlayerId, null).catch(err => LogService.error('GameScreen', 'Error clearing active room', err));
            }
            if (!isSoloMode && gameId) {
                leaveRoom(gameId, localPlayerId).catch(e => LogService.error('GameScreen', 'Error leaving room', e));
            }
        }

        // FIX: Laisser un frame à React pour que les useEffect cleanup (cancelAnimation)
        // s'exécutent avant la navigation — évite RetryableMountingLayerException sur Android Fabric
        requestAnimationFrame(() => {
            router.replace('/home');
        });
    }, [isSoloMode, gameId, localPlayerId, router, signalPlayerOffline]);

    // --- CHAT LOGIC ---
    const triggerLocalChat = useCallback(async (content: string) => {
        if (!gameId || isSoloMode) {
            // Local echo for solo
            setPlayersChat(prev => ({ ...prev, [localPlayerId]: content }));
            setTimeout(() => setPlayersChat(prev => ({ ...prev, [localPlayerId]: null })), 5000);
            return;
        }
        const now = Date.now();
        if (now - lastChatTimeRef.current < 2000) return; // Rate limit
        lastChatTimeRef.current = now;

        try {
            await updatePlayerChat(gameId, localPlayerId, content);
            setPlayersChat(prev => ({ ...prev, [localPlayerId]: content }));
            setTimeout(() => {
                setPlayersChat(prev => ({ ...prev, [localPlayerId]: null }));
            }, 5000);
        } catch (e) {
            LogService.error('GameScreen', 'Chat error', e);
        }
    }, [gameId, isSoloMode, localPlayerId]);

    const triggerOpponentChat = useCallback((pId: string, content: string) => {
        setPlayersChat(prev => ({ ...prev, [pId]: content }));
        setTimeout(() => {
            setPlayersChat(prev => ({ ...prev, [pId]: null }));
        }, 5000);
    }, []);

    // Synchronise les messages chat des adversaires depuis Firebase
    useEffect(() => {
        if (!roomData?.quickChats || isSoloMode) return;

        if (isFirstChatLoad.current) {
            // Premier chargement: on marque tous les messages actuels comme "vus" silencieusement
            Object.entries(roomData.quickChats).forEach(([pId, chatData]) => {
                if (chatData) {
                    lastSeenChatNonces.current[pId] = chatData.nonce || String(chatData.timestamp);
                }
            });
            isFirstChatLoad.current = false;
            return;
        }

        Object.entries(roomData.quickChats).forEach(([pId, chatData]) => {
            if (pId === localPlayerId) return;
            if (!chatData?.content) return;

            const currentNonce = chatData.nonce || String(chatData.timestamp);
            const lastSeen = lastSeenChatNonces.current[pId];

            if (currentNonce !== lastSeen) {
                lastSeenChatNonces.current[pId] = currentNonce;
                triggerOpponentChat(pId, chatData.content);
            }
        });
    }, [roomData?.quickChats]);

    // Badge Boudé local : se reset dès que turnId change pour éviter la persistance
    // en multi quand Firestore tarde à propager boudePlayerId = null.
    const [localBoudedPlayerId, setLocalBoudedPlayerId] = useState<string | null>(null);
    const lastBoudeTurnIdRef = useRef<number>(-1);
    useEffect(() => {
        const phase = gameState?.phase;
        if (phase === 'MATCH_END' || phase === 'MANCHE_END' || phase === 'PARTIE_END') {
            setLocalBoudedPlayerId(null);
            return;
        }

        const turnId = gameState?.turnId ?? -1;
        const firebaseBoudedId = gameState?.boudePlayerId ?? null;
        if (firebaseBoudedId && turnId !== lastBoudeTurnIdRef.current) {
            lastBoudeTurnIdRef.current = turnId;
            setLocalBoudedPlayerId(firebaseBoudedId);
        } else if (!firebaseBoudedId) {
            setLocalBoudedPlayerId(null);
        }
    }, [gameState?.boudePlayerId, gameState?.turnId, gameState?.phase]);

    const rootRef = useRef<View>(null);
    const processedBotTurnRef = useRef<string | null>(null);
    const lastSeenChatNonces = useRef<{ [playerId: string]: string }>({});
    const isFirstChatLoad = useRef<boolean>(true);
    const prevMancheRef = useRef<number>(1);

    const roundResultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingRoundResultTransition = useRef<(() => void) | null>(null);

    const handleDismissRoundResult = useCallback(() => {
        if (roundResultTimerRef.current) {
            clearTimeout(roundResultTimerRef.current);
            roundResultTimerRef.current = null;
        }
        setShowRoundResult(false);
        if (pendingRoundResultTransition.current) {
            const pending = pendingRoundResultTransition.current;
            pendingRoundResultTransition.current = null;
            pending();
        }
    }, []);
    // Tracks whether current PARTIE_END came from a BOUDE (to skip re-showing the card)
    const boudeHandledRef = useRef(false);
    const activeBoudeResultKeyRef = useRef<string | null>(null);
    const resolvedBoudeResultKeysRef = useRef<Set<string>>(new Set());
    const boudeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // -- 6. Derived State & Layout --
    const localPlayer = gameState?.players.find(p => p.id === localPlayerId);
    const isMyTurn = gameState?.currentPlayerId === localPlayerId;
    const isLocalMatchWinner = useMemo(() => {
        if (!gameState || gameState.phase !== 'MATCH_END') return false;
        const sorted = [...gameState.players].sort((a, b) => {
            if (gameState.gameMode === 'COCHON') {
                if ((b.totalCochonsInfliges || 0) !== (a.totalCochonsInfliges || 0)) {
                    return (b.totalCochonsInfliges || 0) - (a.totalCochonsInfliges || 0);
                }
                return b.totalPoints - a.totalPoints;
            }
            if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
            if (b.totalCochons !== a.totalCochons) return b.totalCochons - a.totalCochons;
            return b.mancheWins - a.mancheWins;
        });
        return sorted[0]?.id === localPlayerId;
    }, [gameState, localPlayerId]);
    // isGameOver : logique UI générale (header, PlayerArea, QuickChat...)
    const isGameOver = gameState?.phase === 'MATCH_END' || gameState?.phase === 'MANCHE_END'
        || gameState?.phase === 'PARTIE_END' || gameState?.phase === 'BOUDE';
    // showScoreOverlay : uniquement MANCHE_END / MATCH_END — PARTIE_END est géré par RoundResultCard + auto-continue
    // ✅ FIX [R2-B7] : on exclut la période d'affichage du RoundResultCard (zIndex 1500) pour éviter
    // qu'il masque l'UnifiedResultOverlay en fin de match.
    const showScoreOverlay = (gameState?.phase === 'MANCHE_END' || gameState?.phase === 'MATCH_END')
        && scoreOverlayPhase === gameState.phase
        && !showRoundResult;

    const [playerDisplayName, setPlayerDisplayName] = useState<string>('Moi');
    const [playerAvatarId, setPlayerAvatarId] = useState<string | undefined>('avatar_01');
    const [handSortMode, setHandSortMode] = useState<HandSortMode>('AUTO');
    const [playerSkinId, setPlayerSkinId] = useState<string | undefined>(undefined);
    const [playerSkinConfig, setPlayerSkinConfig] = useState<SkinConfig | undefined>(undefined);
    const [profileLoaded, setProfileLoaded] = useState(false);
    const statsRecordedRef = useRef(false);
    const [matchReward, setMatchReward] = useState<MatchReward | null>(null);
    const [showRewardOverlay, setShowRewardOverlay] = useState(false);
    const playerEconomyRef = useRef<{ level: number; xp: number; leaguePoints: number; cochonsGiven?: number; unlockedFrames?: any[]; leagueGrade?: string | null }>({ level: 1, xp: 0, leaguePoints: 0 });

    // Load economy on mount
    useEffect(() => {
        economyService.getEconomy().then(eco => {
            playerEconomyRef.current = {
                level: eco.level,
                xp: eco.xp,
                leaguePoints: eco.leaguePoints,
                cochonsGiven: eco.cochonsGiven,
                unlockedFrames: eco.unlockedFrames,
            };
        }).catch(err => LogService.error('GameScreen', 'Error loading economy on mount', err));
    }, []);

    // -- stats & economy recording effect --
    // Mark room as FINISHED when match ends (Multiplayer only)
    useEffect(() => {
        if (!isSoloMode && gameId && isLocalHost && gameState?.phase === 'MATCH_END') {
            LogService.info('GameScreen', `Match ended, marking room ${gameId} as FINISHED`);
            markRoomAsFinished(gameId).catch(err => {
                LogService.error('GameScreen', 'Error marking room as finished', err);
            });
        }
    }, [gameState?.phase, isSoloMode, gameId, isLocalHost]);

    // FIX-SURRENDER: Filet de sécurité — si tous les joueurs sont SURRENDERED/BOT (aucun HUMAN)
    // en phase MATCH_END, personne ne peut cliquer "Continuer". On déclenche un exit automatique
    // après 3 s pour éviter le gel total de l'interface.
    useEffect(() => {
        if (isSoloMode || gameState?.phase !== 'MATCH_END') return;
        if (!gameState?.players || gameState.players.length === 0) return;

        const hasHumanPlayer = gameState.players.some(p => p.status === 'HUMAN');
        if (hasHumanPlayer) return;

        LogService.info('GameScreen', '[AUTO-EXIT] All players are SURRENDERED/BOT at MATCH_END — auto-exit in 3s');
        const timer = setTimeout(() => {
            handleLeaveRoom();
        }, 3000);
        return () => clearTimeout(timer);
    }, [gameState?.phase, gameState?.players, isSoloMode, handleLeaveRoom]);

    useEffect(() => {
        if (gameState?.phase === 'MATCH_END' && !statsRecordedRef.current) {
            const localPlayer = gameState.players.find(p => p.id === localPlayerId);
            if (localPlayer) {
                // Determine Match Winner
                const sorted = [...gameState.players].sort((a, b) => {
                    if (gameState.gameMode === 'COCHON') {
                        if ((b.totalCochonsInfliges || 0) !== (a.totalCochonsInfliges || 0)) {
                            return (b.totalCochonsInfliges || 0) - (a.totalCochonsInfliges || 0);
                        }
                        return b.totalPoints - a.totalPoints;
                    }
                    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
                    if (b.totalCochons !== a.totalCochons) return b.totalCochons - a.totalCochons;
                    return b.mancheWins - a.mancheWins;
                });

                const winner = sorted[0];
                const result = winner.id === localPlayerId ? 'WIN' : 'LOSS';

                const opponentsData = gameState.players
                    .filter(p => p.id !== localPlayerId)
                    .map(p => ({ name: p.name, avatarId: p.avatarId || 'avatar_default' }));

                const processMatchEnd = async () => {
                    try {
                        const currentStats = await statsService.getStats();
                        const currentMonthlyLeaguePoints = getMonthlyCochonsFromHistory(currentStats.matchHistory);

                        // 1. Calculate & apply economy rewards (new system) FIRST
                        const rewardInput = RewardEngine.buildInputFromGameState({
                            gameState,
                            localPlayerId,
                            currentLevel: playerEconomyRef.current.level,
                            currentXP: playerEconomyRef.current.xp,
                            currentLeaguePoints: playerEconomyRef.current.leaguePoints,
                            currentCochonsGiven: playerEconomyRef.current.cochonsGiven || 0,
                            unlockedFrames: playerEconomyRef.current.unlockedFrames || [],
                            tableTier: activeTableTier,
                            isSoloMode,
                        });

                        // ✅ Exécution sécurisée côté serveur (Backend Banker)
                        const reward = await economyService.processServerReward(rewardInput, persistenceUserId);
                        setMatchReward(reward);
                        // BUG-LEAGUE-TIER-REWARD: declencher l'overlay aussi quand frameCoinsBonus > 0
                        // (passage de palier Ligue sans cadre visuel, LEAGUE_FRAMES_ENABLED = false)
                        if (reward.gradeUp || (reward.newlyUnlockedFrames?.length ?? 0) > 0 || reward.frameCoinsBonus > 0) {
                            setShowRewardOverlay(true);
                        }

                        // Les stats mensuelles doivent refléter le barème métier du RewardEngine
                        // (5/4/2/1/-1) et non le delta cumulé des cochons donnés.
                        const leaguePointsEarned = reward.leaguePointsEarned;
                        const mancheLeaguePointsEarned = rewardInput.mancheHistory.flatMap((manche) => {
                            const pts = manche.pointsEarned;
                            return pts === 5 || pts === 4 || pts === 2 || pts === 1 || pts === -1
                                ? [pts]
                                : [];
                        });

                        // Mettre à jour le cache local pour que la prochaine partie
                        // dans la même session parte des bonnes valeurs (évite la dérive cochonsGiven)
                        playerEconomyRef.current = {
                            level: reward.newLevel,
                            xp: reward.newXP,
                            leaguePoints: reward.newLeaguePoints,
                            cochonsGiven: reward.newCochonsGiven,
                            unlockedFrames: [
                                ...(playerEconomyRef.current.unlockedFrames || []),
                                ...reward.newlyUnlockedFrames.map((f: any) => f.frameId),
                            ],
                            leagueGrade: reward.newGrade || (playerEconomyRef.current as any).leagueGrade,
                        };

                        LogService.info('GameScreen', `Economy rewards applied — coins:${reward.coinsEarned} xp:${reward.xpEarned} gradeUp:${reward.gradeUp} leaguePointsEarned:${leaguePointsEarned}`);

                        // 2. Record basic match stats ONLY IF economy succeeds
                        // ✅ FIX [2026-04-15]: Use totalCochonsInfliges (cochons GIVEN to opponents, permanent counter)
                        // instead of totalCochons which was ambiguous and mapped to cochons RECEIVED (malus).
                        await statsService.recordMatchResult({
                            result,
                            cochons: localPlayer.totalCochonsInfliges || 0,
                            points: localPlayer.totalPoints || 0,
                            roundsWon: localPlayer.mancheWins || 0,
                            leaguePointsEarned,
                            mancheLeaguePointsEarned,
                            opponents: opponentsData,
                            mode: isSoloMode ? 'SOLO' : 'MULTIPLAYER',
                            userId: persistenceUserId
                        });
                    } catch (err) {
                        LogService.error('GameScreen', 'Match end processing failed:', err);
                    }
                };

                processMatchEnd();
                statsRecordedRef.current = true;
            }
        } else if (gameState?.phase !== 'MATCH_END' && gameState?.phase !== 'MANCHE_END') {
            statsRecordedRef.current = false;
            setMatchReward(null); // Reset pour la prochaine partie
            setShowRewardOverlay(false);
        }
    }, [gameState?.phase, localPlayerId, isSoloMode, persistenceUserId]);

    useEffect(() => {
        if (Platform.OS === 'web' && !showScoreOverlay && !showRoomInfo && !isPaused) {
            (rootRef.current as any)?.focus?.();
        }
    }, [showScoreOverlay, showRoomInfo, isPaused]);

    // Load saved table theme and player profile
    useFocusEffect(
        useCallback(() => {
            const loadSettings = async () => {
                const settings = SettingsManager.getSettings();
                setTableTheme(settings.tableTheme);
                setIsBgmEnabled(settings.isBgmEnabled ?? true);
                setIsSfxEnabled(settings.isSfxEnabled ?? true);

                if (isSoloMode) {
                    try {
                        const profile = await authService.refreshUserFromStorage();
                        if (profile) {
                            setPlayerDisplayName(profile.displayName || 'Moi');
                            const avatar = profile.avatarUrl || profile.avatarId;
                            if (avatar) {
                                setPlayerAvatarId(avatar);
                            } else {
                                setPlayerAvatarId('avatar_default');
                            }
                            // Stocker le leagueGrade pour le propager au player au deal
                            if (profile.leagueGrade) {
                                (playerEconomyRef.current as any).leagueGrade = profile.leagueGrade;
                            }
                        }
                    } catch (error) {
                        LogService.error('GameScreen', 'Error loading profile:', error);
                    }
                }

                // Load cosmetics like skin for both solo and multiplayer
                try {
                    const inventory = await storeService.getInventory();
                    if (inventory?.equipped?.skin) {
                        const skinIdToLoad = inventory.equipped.skin;
                        setPlayerSkinId(skinIdToLoad);

                        // Fetch catalog to get the config for the equipped skin
                        const catalog = await storeService.getCatalog();
                        const equippedSkinItem = catalog.find(item => item.id === skinIdToLoad);
                        if (equippedSkinItem && equippedSkinItem.skinConfig) {
                            setPlayerSkinConfig(equippedSkinItem.skinConfig);
                        }
                    }
                } catch (e) {
                    LogService.error('GameScreen', 'Error loading inventory cosmetics', e);
                }

                setProfileLoaded(true);
            };
            loadSettings();
        }, [isSoloMode])
    );
    // ── SYS-LOGGING-ENGINE: Suivi des Transitions de Phase ──
    const previousPhaseRef = useRef<GamePhase | null>(null);
    useEffect(() => {
        if (gameState && gameState.phase !== previousPhaseRef.current) {
            if (previousPhaseRef.current !== null) {
                LogService.transition('GameScreen', previousPhaseRef.current, gameState.phase, `Turn: ${gameState.turnId}`);
            }
            previousPhaseRef.current = gameState.phase;
        }
    }, [gameState?.phase, gameState?.turnId]);

    // ── SYS-LOGGING-ENGINE: Suivi des Overlays (Modales) ──
    useEffect(() => {
        LogService.event('GameScreen', showRoundResult ? '🟢 Overlay OPEN: RoundResultCard' : '🔴 Overlay CLOSE: RoundResultCard');
    }, [showRoundResult]);

    useEffect(() => {
        if (scoreOverlayPhase) {
            LogService.event('GameScreen', `🟢 Overlay OPEN: ScoreOverlay (${scoreOverlayPhase})`);
        } else {
            LogService.event('GameScreen', '🔴 Overlay CLOSE: ScoreOverlay');
        }
    }, [scoreOverlayPhase]);

    useEffect(() => {
        LogService.event('GameScreen', showMatchRewardModal ? '🟢 Overlay OPEN: UnifiedResultOverlay' : '🔴 Overlay CLOSE: UnifiedResultOverlay');
    }, [showMatchRewardModal]);

    useEffect(() => {
        LogService.event('GameScreen', showRewardOverlay ? '🟢 Overlay OPEN: LeagueRewardOverlay' : '🔴 Overlay CLOSE: LeagueRewardOverlay');
    }, [showRewardOverlay]);

    // Gestion des fins de round / manche / match
    // Ref stable vers handleOverlayContinue (disponible dès useGameEngine, avant ce point)
    // Pour PARTIE_END : l'intercept ne fait qu'appeler handleOverlayContinue (la branche récompenses est MATCH_END only)
    const partieEndContinueRef = useRef(handleOverlayContinue);
    useEffect(() => { partieEndContinueRef.current = handleOverlayContinue; }, [handleOverlayContinue]);

    const resolveBoudeOnce = useCallback((resultKey: string) => {
        if (resolvedBoudeResultKeysRef.current.has(resultKey)) return;
        resolvedBoudeResultKeysRef.current.add(resultKey);
        setShowRoundResult(false);
        partieEndContinueRef.current();
    }, []);

    const isCurrentBoudeResultVisible = gameState?.phase === 'BOUDE'
        && activeBoudeResultKeyRef.current === `${gameState.gameId}:${gameState.mancheNumber}:${gameState.roundNumber}:${gameState.turnId}`;

    useEffect(() => {
        if (!gameState) return;
        const boudeResultKey = `${gameState.gameId}:${gameState.mancheNumber}:${gameState.roundNumber}:${gameState.turnId}`;

        if (isMoveAnimationActive) return;

        if (
            gameState.phase !== 'BOUDE'
            && gameState.phase !== 'PARTIE_END'
            && gameState.phase !== 'MANCHE_END'
            && gameState.phase !== 'MATCH_END'
        ) {
            setShowRoundResult(false);
            setScoreOverlayPhase(null);
            setRoundResultSnapshot(null);
        }

        // ── Garde catch-all : si BOUDE a été affiché mais PARTIE_END a été skippé
        // (Firestore peut livrer BOUDE → PLAYING directement en multiplayer)
        // IMPORTANT : ne pas retourner early pour MANCHE_END/MATCH_END — laisser
        // leurs handlers ci-dessous s'exécuter (BOUDE peut résoudre directement en MANCHE_END).
        if (boudeHandledRef.current && gameState.phase !== 'BOUDE' && gameState.phase !== 'PARTIE_END') {
            if (gameState.phase !== 'MANCHE_END' && gameState.phase !== 'MATCH_END') {
                boudeHandledRef.current = false;
                activeBoudeResultKeyRef.current = null;
                setShowRoundResult(false);
                return;
            }
        }

        if (gameState.phase === 'BOUDE') {
            if (activeBoudeResultKeyRef.current !== boudeResultKey) {
                // Partie bloquée : card immédiate 3.5s, host résout BOUDE au bout
                boudeHandledRef.current = true;
                activeBoudeResultKeyRef.current = boudeResultKey;
                setScoreOverlayPhase(null);
                setRoundResultSnapshot(gameState);
                setShowRoundResult(true);
            }
            if (isLocalHost && !boudeTimerRef.current) {
                // Host : on résout soi-même après 12s (pour laisser les animations de fin de round se terminer)
                boudeTimerRef.current = setTimeout(() => {
                    resolveBoudeOnce(boudeResultKey);
                    boudeTimerRef.current = null;
                }, 12000);
            } else if (!isLocalHost && !boudeTimerRef.current) {
                // Secours (Acting Host transition fallback) : 
                // Si l'hôte a crash ou est offline, n'importe quel autre joueur humain actif résout après 15s
                // Firestore n'enregistrera l'update qu'une seule fois grâce à l'idempotence de resolveBoude
                boudeTimerRef.current = setTimeout(() => {
                    resolveBoudeOnce(boudeResultKey);
                    boudeTimerRef.current = null;
                }, 15000);
            }
            // Attente de PARTIE_END via Firestore (timer du host ou secours)
            return;
        } else {
            if (boudeTimerRef.current) {
                clearTimeout(boudeTimerRef.current);
                boudeTimerRef.current = null;
            }
        }

        // ── MANCHE_END ──────────────────────────────────────────────────────────
        // Cas : un round vient de se terminer et le score de manche change.
        // PARTIE_END → MANCHE_END arrive très vite en multi (deux updates Firestore
        // successives). Le handler PARTIE_END a peut-être déjà lancé le RoundEndFlow
        // et positionné pendingRoundResultTransition sur triggerMatchEnd (FAUX pour
        // MANCHE_END). On corrige ici la pending transition pour qu'elle affiche le
        // score de manche (MancheEndFlow) et non l'écran de fin de match.
        if (gameState.phase === 'MANCHE_END') {
            setScoreOverlayPhase(null);
            // Conserver le snapshot PARTIE_END si déjà défini (transition rapide),
            // sinon initialiser avec l'état MANCHE_END courant (arrivée directe).
            setRoundResultSnapshot(prev => prev ?? gameState);
            setShowRoundResult(true);
            // Après dismiss du RoundEndFlow → afficher l'écran de score de manche
            pendingRoundResultTransition.current = () => {
                setScoreOverlayPhase('MANCHE_END');
            };
            // Filet de sécurité : dismiss automatique après 12s si l'auto-advance échoue
            if (!roundResultTimerRef.current) {
                roundResultTimerRef.current = setTimeout(handleDismissRoundResult, 12000);
            }
            return () => {
                // FIX-TIMER: remettre la ref à null sinon un rerun de l'effet
                // (turnId, animations…) désarme le filet de sécurité sans re-arm possible
                if (roundResultTimerRef.current) {
                    clearTimeout(roundResultTimerRef.current);
                    roundResultTimerRef.current = null;
                }
            };
        }

        if (gameState.phase === 'PARTIE_END') {
            if (boudeHandledRef.current) {
                // Vient de BOUDE : card déjà montrée, avancer directement sans re-afficher
                boudeHandledRef.current = false;
                activeBoudeResultKeyRef.current = null;
                setScoreOverlayPhase(null);
                setShowRoundResult(false);
                partieEndContinueRef.current(); // computeNextRoundState → PLAYING/MANCHE_END
                return;
            }
            // PARTIE_END classique (victoire normale)
            setScoreOverlayPhase(null);
            setRoundResultSnapshot(gameState);
            setShowRoundResult(true);
            pendingRoundResultTransition.current = () => {
                isAdVisibleRef.current = true;
                setIsAdVisible(true);
                setTimeout(() => {
                    try {
                        showAdMob();
                        setTimeout(() => {
                            if (isAdVisibleRef.current) {
                                LogService.warn('GameScreen', 'AdMob fallback timeout (MATCH_END skip)');
                                isAdVisibleRef.current = false;
                                setIsAdVisible(false);
                                if (pendingPhaseTransitionRef.current) {
                                    const pending = pendingPhaseTransitionRef.current;
                                    pendingPhaseTransitionRef.current = null;
                                    pending();
                                }
                            }
                        }, 15000);
                    } catch (e) {
                        LogService.error('GameScreen', 'Failed to show AdMob (MATCH_END skip)', e);
                        isAdVisibleRef.current = false;
                        setIsAdVisible(false);
                        if (pendingPhaseTransitionRef.current) {
                            const pending = pendingPhaseTransitionRef.current;
                            pendingPhaseTransitionRef.current = null;
                            pending();
                        }
                    }
                }, 50);
                pendingPhaseTransitionRef.current = () => setScoreOverlayPhase('MATCH_END');
                return;
            }

            const triggerMatchEnd = () => {
                isAdVisibleRef.current = true;
                setIsAdVisible(true);
                setTimeout(() => {
                    try {
                        showAdMob();
                        setTimeout(() => {
                            if (isAdVisibleRef.current) {
                                LogService.warn('GameScreen', 'AdMob fallback timeout (MATCH_END)');
                                isAdVisibleRef.current = false;
                                setIsAdVisible(false);
                                if (pendingPhaseTransitionRef.current) {
                                    const pending = pendingPhaseTransitionRef.current;
                                    pendingPhaseTransitionRef.current = null;
                                    pending();
                                }
                            }
                        }, 15000);
                    } catch (e) {
                        LogService.error('GameScreen', 'Failed to show AdMob (MATCH_END)', e);
                        isAdVisibleRef.current = false;
                        setIsAdVisible(false);
                        if (pendingPhaseTransitionRef.current) {
                            const pending = pendingPhaseTransitionRef.current;
                            pendingPhaseTransitionRef.current = null;
                            pending();
                        }
                    }
                }, 50);
                pendingPhaseTransitionRef.current = () => setScoreOverlayPhase('MATCH_END');
            };

            // Fin de match : affichage temporaire du RoundResultCard (5s) PUIS UnifiedResultOverlay
            setScoreOverlayPhase(null);
            setRoundResultSnapshot(gameState);
            setShowRoundResult(true);
            pendingRoundResultTransition.current = () => {
                triggerMatchEnd();
            };
            if (roundResultTimerRef.current) clearTimeout(roundResultTimerRef.current);
            roundResultTimerRef.current = setTimeout(handleDismissRoundResult, 12000);
            return () => {
                // FIX-TIMER: null obligatoire pour permettre le re-arm après rerun de l'effet
                if (roundResultTimerRef.current) {
                    clearTimeout(roundResultTimerRef.current);
                    roundResultTimerRef.current = null;
                }
            };
        }
    }, [gameState?.phase, gameState?.gameId, gameState?.mancheNumber, gameState?.roundNumber, gameState?.turnId, isLocalHost, resolveBoudeOnce, isMoveAnimationActive]);

    // Afficher la popup de pub récompensée 2 secondes après l'apparition du score de fin de match
    // Uniquement en mode SOLO — en multi la pub interstitielle AdMob est déjà gérée ailleurs.
    useEffect(() => {
        if (scoreOverlayPhase === 'MATCH_END' && isSoloMode) {
            setMatchRewardAmount(100);
            const timer = setTimeout(() => {
                setShowMatchRewardModal(true);
            }, 4000);
            return () => clearTimeout(timer);
        } else {
            setShowMatchRewardModal(false);
        }
    }, [scoreOverlayPhase, isSoloMode]);


    // Auto-redirect non-hôtes quand l'hôte reset la room après le match
    useEffect(() => {
        if (isSoloMode || isLocalHost) return;
        if (!roomData) return;
        const hostReset = roomData.status === 'WAITING' && !roomData.gameState;
        if (hostReset && gameState?.phase === 'MATCH_END') {
            handleLeaveRoom();
        }
    }, [roomData?.status, roomData?.gameState]);

    // Show Round/Manche Banner when a new round starts
    // 🔧 FIX: On utilise prevMancheRef pour détecter un VRAI changement de manche
    // et éviter les faux positifs causés par les re-renders intermédiaires Firebase
    // (ex: mancheNumber=1 stale + roundNumber=1 du nouvel état → M1/R1 affiché à tort).
    useEffect(() => {
        if (!gameState || gameState.phase !== 'PLAYING') return;

        const rn = gameState.roundNumber ?? 1;
        const mn = gameState.mancheNumber ?? 1;

        const isFirstRoundOfNewManche = rn === 1 && mn > prevMancheRef.current;
        const isNewRound = rn > 1;

        // Met à jour la ref AVANT de programmer quoi que ce soit
        prevMancheRef.current = mn;

        if (isFirstRoundOfNewManche) {
            // Nouvelle manche : affiche "Manche X" 1s puis "Round 1" 1s
            setBannerState('MANCHE');
            let timer2: ReturnType<typeof setTimeout>;
            const timer1 = setTimeout(() => {
                setBannerState('ROUND');
                timer2 = setTimeout(() => {
                    setBannerState('NONE');
                }, 1000);
            }, 1000);
            return () => {
                clearTimeout(timer1);
                clearTimeout(timer2);
            };
        } else if (isNewRound) {
            // Round 2+ dans la même manche : affiche juste "Round Y" 1s
            setBannerState('ROUND');
            const timer = setTimeout(() => {
                setBannerState('NONE');
            }, 1000);
            return () => clearTimeout(timer);
        }
        // rn === 1 ET mn === prevManche → premier round du tout premier match OU re-render parasite : rien
    }, [gameState?.roundNumber, gameState?.mancheNumber, gameState?.phase]);

    // Audio & Firebase Subscription
    // Buy-in Deduction (Delayed)
    useEffect(() => {
        if (isSoloMode || !gameId || !gameState || gameState.phase !== 'PLAYING') return;
        if (hasBeenDebited.current) return;

        const deductBuyInAction = async () => {
            const tableConfig = TABLE_CONFIGS[activeTableTier];
            if (!tableConfig || tableConfig.buyIn <= 0) return;

            // PERSISTENCE CHECK: Check if Firestore already knows we were debited
            const meInRoom = roomData?.players.find(p => p.uid === localPlayerId);
            if (meInRoom?.hasBeenDebited) {
                LogService.info('GameScreen', "[ECONOMY] Player already debited (found in Firestore), skipping.");
                hasBeenDebited.current = true;
                return;
            }

            LogService.info('GameScreen', `[ECONOMY] Deducting buy-in of ${tableConfig.buyIn} for room ${gameId}`);
            const success = await economyService.deductBuyIn(tableConfig.buyIn, localPlayerId);

            if (success) {
                hasBeenDebited.current = true;
                await markPlayerAsDebited(gameId, localPlayerId);
                setDebitFeedback(`-${tableConfig.buyIn} 🪙`);
                setTimeout(() => setDebitFeedback(null), 2500);
            } else {
                LogService.error('GameScreen', "[ECONOMY] Failed to deduct buy-in at game start!");
            }
        };

        // Only guests deduct here. Host deducts in handleStartGame for atomic transition.
        if (!isLocalHost) {
            deductBuyInAction();
        }
    }, [gameState?.phase, isLocalHost, isSoloMode, gameId, activeTableTier, localPlayerId]);
    useEffect(() => {
        // Solo mode - wait for profile to load first
        if (isSoloMode) {
            if (!profileLoaded) {
                return; // Wait for profile to load
            }
            setIsStarting(false); // Ensure loading is off
            startSoloGame();
            return;
        }

        if (!gameId) {
            setIsStarting(false);
            // Handle offline/local fallback
            return;
        }

        // Multiplayer loading...
        // useGameSync handles the subscription internally now, but if we need a custom one for chat:
        // Actually, triggerOpponentChat logic can be moved into useGameSync or a dedicated effect here
    }, [gameId, isSoloMode, profileLoaded]);

    const forcedOpeningDominoId = useMemo(() => {
        if (!gameState) return null;
        // Règle ouverture match (round 1, manche 1)
        const opening = getForcedOpeningDominoId(gameState, localPlayerId);
        if (opening) return opening;
        // R2-B2 : règle égalité — premier coup du round après redonne, joueurs à égalité uniquement
        return getForcedTieBreakDominoId(gameState, localPlayerId);
    }, [gameState, localPlayerId]);

    // Check if player has ANY playable domino (NEW: Before early return for hooks safety)
    const canPlayAny = useMemo(() => {
        if (!gameState) return false;
        const localPlayer = gameState.players.find(p => p.id === localPlayerId);
        if (!localPlayer) return false;
        let moves = getValidMoves(localPlayer.hand, {
            left: gameState.table.leftValue,
            right: gameState.table.rightValue
        });
        if (forcedOpeningDominoId) {
            moves = moves.filter(move => move.tile.id === forcedOpeningDominoId);
        }
        return moves.length > 0;
    }, [gameState?.players, gameState?.table.leftValue, gameState?.table.rightValue, localPlayerId, forcedOpeningDominoId]);


    // IN-GAME PROTECTION: Prevent accidental exit
    useEffect(() => {

        if (!gameState && !isStarting) return; // Only protect if in game or starting

        const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
            // If the match is over, or we intentionally leave, allow navigation
            if (gameStateRef.current?.phase === 'MATCH_END' || isIntentionalLeave.current) {
                return;
            }
            // Prevent default behavior of leaving the screen
            e.preventDefault();

            // Prompt the user before leaving
            Alert.alert(
                'Quitter la partie ?',
                'Si vous quittez cet écran, la partie continuera sans vous et vous serez forcé d’y revenir à la réouverture.',
                [
                    { text: "Rester", style: 'cancel', onPress: () => { } },
                    {
                        text: 'Quitter l’écran',
                        style: 'destructive',
                        // If the user confirmed, then we dispatch the action we blocked earlier
                        // This will continue the action that had triggered the removal of the screen
                        onPress: async () => {
                            if (gameId && !isSoloMode) {
                                try {
                                    await AsyncStorage.setItem('active_roomId', gameId);
                                    await signalPlayerOffline(true); // Abandon volontaire confirmé
                                } catch (err) {
                                    LogService.error('GameScreen', 'Error preserving room on exit', err);
                                }
                            }
                            isIntentionalLeave.current = true;
                            navigation.dispatch(e.data.action);
                        },
                    },
                ]
            );
        });

        return unsubscribe;
    }, [gameState, isStarting, gameId, navigation, isSoloMode, signalPlayerOffline]);

    // -------------------------------------------------------------------------
    // SAFE FIREBASE UPDATE: Silently swallow offline errors in Solo mode.
    // In solo mode, the game state is local-first; Firebase sync is best-effort.
    // In multiplayer, errors are re-thrown so they can be handled normally.
    // -------------------------------------------------------------------------

    const startSoloGame = useCallback(async () => {
        if (isStarting) return;
        setIsStarting(true);
        try {
            // Tenter de restaurer l'état de jeu solo sauvegardé
            if (gameId) {
                const savedStateStr = await AsyncStorage.getItem(`@solo_game_state:${gameId}`);
                if (savedStateStr) {
                    try {
                        const parsedState = JSON.parse(savedStateStr) as GameState;
                        if (parsedState && parsedState.players && parsedState.players.length > 0) {
                            // ✅ FIX : Ne pas restaurer une partie déjà terminée.
                            // Si l'OS a tué l'app avant que handleLeaveRoom() purge la clé,
                            // l'état MATCH_END resterait en AsyncStorage et bloquerait le joueur.
                            if (parsedState.phase === 'MATCH_END') {
                                LogService.info('GameScreen', `[SOLO] Saved state is MATCH_END for ${gameId}, purging and starting fresh.`);
                                await AsyncStorage.removeItem(`@solo_game_state:${gameId}`);
                                // On laisse tomber la restauration → nouvelle partie ci-dessous
                            } else {
                                LogService.info('GameScreen', `[SOLO] Restored saved solo game state for ${gameId}`);
                                setGameState(parsedState);
                                return; // Restauration réussie, quitter startSoloGame
                            }
                        }
                    } catch (parseErr) {
                        LogService.error('GameScreen', '[SOLO] Failed to parse saved solo game state:', parseErr);
                    }
                }
            }


            const botDifficulty = difficulty || 'MAPIPI';

            // Fetch bot profiles from Firestore (or fallback)
            const botProfiles = await botService.getBotsForLevel(botDifficulty, 2);
            const playerNames = [playerDisplayName, ...botProfiles.map(b => b.name)];

            const eco = await economyService.getEconomy();

            const fullState = dealGameSolo(
                localPlayerId,
                playerDisplayName,
                playerAvatarId as string,
                botDifficulty,
                startingHandSize || 7
            ) as GameState;

            // Configure local player and bots avatars
            fullState.players[0].avatarId = playerAvatarId as AvatarId;
            // Propager le leagueGrade du joueur local s'il est disponible
            if (eco.leagueGrade) {
                fullState.players[0].leagueGrade = eco.leagueGrade;
            } else if ((playerEconomyRef.current as any).leagueGrade) {
                fullState.players[0].leagueGrade = (playerEconomyRef.current as any).leagueGrade;
            }


            fullState.players[1].name = botProfiles[0].name;
            fullState.players[1].avatarId = (botProfiles[0].imageUrl || botProfiles[0].avatarId) as AvatarId;
            fullState.players[1].difficulty = botDifficulty;

            if (fullState.players.length > 2) {
                fullState.players[2].name = botProfiles[1].name;
                fullState.players[2].avatarId = (botProfiles[1].imageUrl || botProfiles[1].avatarId) as AvatarId;
                fullState.players[2].difficulty = botDifficulty;
            }

            // Mettre en place le moteur de la partie
            fullState.currentPlayerId = determineFirstPlayer(fullState.players);
            fullState.gameMode = gameMode || 'MANCHE';
            fullState.winningCondition = winningCondition || 3;
            fullState.turnDuration = turnDuration || 15;
            fullState.gameId = gameId || `solo-${Date.now()}`;
            fullState.roundNumber = 1;
            fullState.mancheNumber = 1;

            // ✅ FIX CRITIQUE: dealGameSolo retourne un Partial<GameState>.
            // Ces champs sont absents du retour de la fonction mais REQUIS par handleTurn.
            // Sans eux, newState.history.push() crash au premier coup joué.
            if (!fullState.history) fullState.history = [];
            if (!fullState.firstPlayerOfRound) fullState.firstPlayerOfRound = null;
            if (!fullState.mancheResult) fullState.mancheResult = null;
            if (!fullState.startingHandSize) fullState.startingHandSize = startingHandSize || 7;
            if (!fullState.talonMort) fullState.talonMort = [];

            setGameState(fullState);
        } catch (error) {
            LogService.error('GameScreen', 'Error starting solo game:', error);
            Alert.alert('Error', 'Failed to start local game');
        } finally {
            setIsStarting(false);
        }
    }, [isStarting, difficulty, playerDisplayName, gameMode, winningCondition, turnDuration, startingHandSize, playerAvatarId, setGameState, setIsStarting]);

    // Multiplayer Start Handler
    const handleStartGame = async () => {
        SoundManager.unlockAudio();
        if (!gameId || !roomData) return;

        // 1. Débit immédiat pour l'hôte
        const tableConfig = TABLE_CONFIGS[activeTableTier];
        const meInRoom = roomData.players.find(p => p.uid === localPlayerId);

        if (tableConfig && tableConfig.buyIn > 0 && !hasBeenDebited.current && !meInRoom?.hasBeenDebited) {
            const success = await economyService.deductBuyIn(tableConfig.buyIn, localPlayerId);
            if (!success) {
                Alert.alert("Solde insuffisant", "Vous n'avez plus assez de coins pour lancer cette table.");
                return;
            }
            hasBeenDebited.current = true;
            await markPlayerAsDebited(gameId, localPlayerId);
            setDebitFeedback(`-${tableConfig.buyIn} 🪙`);
            setTimeout(() => setDebitFeedback(null), 2500);
        }

        setIsStarting(true);

        try {
            const playerNames = roomData.players.map(p => p.displayName);
            const botDifficulty = (roomData.difficulty || 'MAPIPI') as any;
            const botConfigs = await botService.getBotsForLevel(botDifficulty, 3);
            let botIndex = 0;

            while (playerNames.length < 3) {
                if (botIndex < botConfigs.length) {
                    playerNames.push(botConfigs[botIndex].name);
                    botIndex++;
                } else {
                    playerNames.push(`Bot ${playerNames.length}`);
                }
            }

            const fullState = dealGame(
                playerNames,
                roomData.startingHandSize || 7
            ) as GameState;

            // Apply room settings manually to the partial state if needed
            fullState.gameMode = roomData.gameMode || 'MANCHE';
            fullState.winningCondition = roomData.winningCondition || 3;
            fullState.turnDuration = roomData.turnDuration || 15;
            fullState.gameId = gameId; // Ensure gameId is present

            // ✅ FIX: Champs manquants que dealGame() ne définit pas (contrairement à dealGameSolo)
            // Sans eux, computeNextRoundState lit roundNumber=undefined → calcule toujours round 2 = R1
            fullState.roundNumber = 1;
            fullState.mancheNumber = 1;
            fullState.mancheHistory = [];
            fullState.history = [];
            fullState.firstPlayerOfRound = null;
            fullState.mancheResult = null;
            fullState.startingHandSize = roomData.startingHandSize || 7;

            // Re-assign IDs to actual UIDs for real players, and configure Bots
            fullState.players = fullState.players.map((p, i) => {
                if (i < roomData.players.length) {
                    const uid = roomData.players[i].uid;
                    const roomPlayer = roomData.players[i];
                    return {
                        ...p,
                        id: uid,
                        avatarId: roomPlayer.avatarId || 'avatar_default',
                        leagueGrade: roomPlayer.leagueGrade,   // Propagé depuis PlayerProfile
                        activeFrame: roomPlayer.activeFrame,   // Propagé depuis PlayerProfile
                        status: roomPlayer.status === 'BOT' ? 'BOT' : 'HUMAN',
                        difficulty: roomPlayer.status === 'BOT' ? (roomPlayer as any).difficulty : undefined
                    };
                } else {
                    const relativeBotIdx = i - roomData.players.length;
                    const config = botConfigs[relativeBotIdx] || botConfigs[0];
                    return {
                        ...p,
                        id: `bot-${i}`,
                        name: config.name,
                        status: 'BOT',
                        avatarId: config.avatarId,
                        difficulty: config.difficulty as any
                    };
                }
            });

            fullState.currentPlayerId = determineFirstPlayer(fullState.players);
            await startGame(gameId, fullState, localPlayerId);

        } catch (error) {
            LogService.error('GameScreen', "Failed to start game:", error);
            Alert.alert("Error", "Could not start game");
            setIsStarting(false);
        }
    };


    // --- BOT LOGIC HANDLING ---
    // The "Industrial" bot loop (lines 1200+) handles all bot moves consistently.

    // -------------------------------------------------------------------------
    // HELPERS & ACTIONS (UI-ONLY)
    // -------------------------------------------------------------------------

    const handleDeleteWaitingRoom = useCallback(async () => {
        if (!gameId || !roomData || isSoloMode) return;
        try {
            const deleted = await deleteWaitingRoomIfOwner(gameId, localPlayerId);
            if (deleted) {
                await AsyncStorage.removeItem('active_roomId');
                if (localPlayerId && localPlayerId !== 'p1') {
                    await setUserActiveRoom(localPlayerId, null);
                }
                router.replace('/home');
            }
        } catch (error: any) {
            Alert.alert('Suppression impossible', error?.message || 'Impossible de supprimer cette table.');
        }
    }, [gameId, roomData, isSoloMode, localPlayerId, router]);

    // -- 7. Action Handlers (Delegated) --
    // These are already extracted into useGameEngine and useGameSync

    const localPlayerForActionFooter = useMemo(() => {
        if (!localPlayer || !localHandAnimationSnapshot || !hiddenHandDominoId) return localPlayer;
        return {
            ...localPlayer,
            hand: localHandAnimationSnapshot,
        };
    }, [hiddenHandDominoId, localHandAnimationSnapshot, localPlayer]);

    const primeLocalDominoFlight = useCallback((domino: Domino, position?: { x: number, y: number }, handSnapshot?: Domino[], playableDominoIds: string[] = []) => {
        if (!position) return;

        const animationId = `local-${domino.id}-${Date.now()}`;
        pendingLocalPlayAnimationRef.current = {
            dominoId: domino.id,
            animationId,
            startPoint: position,
        };
        lastPlayStartPos.current = position;
        setLocalHandAnimationSnapshot(handSnapshot ?? null);
        setHiddenHandDominoId(domino.id);
        setPreserveLocalHandHighlights(true);
        setPreservedPlayableDominoIds(playableDominoIds);
        setFlyingDomino({
            animationId,
            domino,
            startPoint: position,
            baseSize: 38,
            orientation: 'vertical',
            isReversed: false,
            holdAtStart: true,
        });
    }, []);

    const wrappedHandlePlayDomino = useCallback(
        (domino: Domino, position?: { x: number, y: number }) => {
            if (position) {
                lastPlayStartPos.current = position;
            }
            if (gameState) {
                const isBoardEmpty = gameState.table.leftValue === null && gameState.table.rightValue === null;
                const validMoves = isBoardEmpty
                    ? [{ side: 'start' }]
                    : getValidMoves([domino], {
                        left: gameState.table.leftValue,
                        right: gameState.table.rightValue
                    });
                const bothEndsEqual = gameState.table.leftValue === gameState.table.rightValue;
                const willPlayImmediately = isBoardEmpty || validMoves.length === 1 || bothEndsEqual;

                if (willPlayImmediately) {
                    const handSnapshot = localPlayer?.hand ?? [];
                    const playableIds = handSnapshot
                        .filter(tile => (
                            isBoardEmpty
                                ? true
                                : getValidMoves([tile], {
                                    left: gameState.table.leftValue,
                                    right: gameState.table.rightValue
                                }).length > 0
                        ))
                        .filter(tile => !forcedOpeningDominoId || tile.id === forcedOpeningDominoId)
                        .map(tile => tile.id);
                    primeLocalDominoFlight(domino, position, handSnapshot, playableIds);
                }
            }
            handlePlayDomino(domino);
        },
        [forcedOpeningDominoId, gameState, handlePlayDomino, localPlayer?.hand, primeLocalDominoFlight]
    );

    const wrappedConfirmSidePlay = useCallback(
        (side: 'left' | 'right') => {
            if (!pendingDomino) return; // Sécurité : évite l'appel undefined si la pièce a été reset avant le release
            if (pendingDomino) {
                const handSnapshot = localPlayer?.hand ?? [];
                const playableIds = handSnapshot
                    .filter(tile => (
                        gameState
                            ? getValidMoves([tile], {
                                left: gameState.table.leftValue,
                                right: gameState.table.rightValue
                            }).length > 0
                            : true
                    ))
                    .filter(tile => !forcedOpeningDominoId || tile.id === forcedOpeningDominoId)
                    .map(tile => tile.id);
                primeLocalDominoFlight(pendingDomino, lastPlayStartPos.current ?? undefined, handSnapshot, playableIds);
            }
            confirmSidePlay(side);
        },
        [confirmSidePlay, forcedOpeningDominoId, gameState, localPlayer?.hand, pendingDomino, primeLocalDominoFlight]
    );

    // FIX-400: Garde anti-redispatch — empêche un même client de tenter NEXT_ROUND
    // plusieurs fois pour le même (mancheNumber, roundNumber). La boucle se produisait
    // quand le resync serveur re-livrait PARTIE_END/MANCHE_END et re-déclenchait les timers.
    // La clé est remise à null quand la phase passe à PLAYING (round suivant démarré).
    const lastNextRoundKeyRef = useRef<string | null>(null);
    useEffect(() => {
        if (gameState?.phase === 'PLAYING') {
            lastNextRoundKeyRef.current = null;
        }
    }, [gameState?.phase]);

    const interceptOverlayContinue = useCallback(() => {
        // La navigation définitive quand l'overlay (qui gère déjà Scores / Historique / Gains) est fermé.
        setScoreOverlayPhase(null);
        if (gameState?.phase === 'MATCH_END') {
             handleLeaveRoom(); // Quitte la salle définitivement après la fin du match complet
        } else {
            // Guard : une seule tentative NEXT_ROUND par (manche, round)
            if (gameState && !isSoloMode) {
                const key = `${gameState.mancheNumber}_${gameState.roundNumber}`;
                if (lastNextRoundKeyRef.current === key) {
                    LogService.warn('GameScreen', `[ANTI-REDISPATCH] NEXT_ROUND already attempted for key=${key}, skipping`);
                    return;
                }
                lastNextRoundKeyRef.current = key;
            }
            handleOverlayContinue(); // Continue vers la prochaine manche
        }
    }, [gameState?.phase, gameState?.mancheNumber, gameState?.roundNumber, isSoloMode, handleLeaveRoom, handleOverlayContinue]);




    // Get opponents in RELATIVE ORDER for Anti-Clockwise visual flow
    // Order: Local (Bottom) -> Next Player (Top-Right) -> Last Player (Top-Left)
    const opponents = useMemo(() => {
        if (!gameState) return [];
        const numPlayers = gameState.players.length;
        const localIdx = gameState.players.findIndex(p => p.id === localPlayerId);
        if (localIdx === -1) return gameState.players.filter(p => p.id !== localPlayerId);

        const ordered = [];
        // First opponent (Next in turn order) -> will be placed Top-Right
        ordered.push(gameState.players[(localIdx + 1) % numPlayers]);
        // Second opponent (Last in turn order) -> will be placed Top-Left
        if (numPlayers > 2) {
            ordered.push(gameState.players[(localIdx + 2) % numPlayers]);
        }
        return ordered;
    }, [gameState?.players, localPlayerId]);

    // RENDER LOGIC

    if (!gameState) {
        if (!roomData) return <View key="loading-no-room" style={styles.loading}><Text style={styles.text}>Loading...</Text></View>;

        // Show loading screen when starting game instead of lobby
        if (isStarting) {
            return (
                <View key="loading-starting" style={styles.loading}>
                    <Text style={styles.text}>Starting game...</Text>
                    <Text style={[styles.text, { fontSize: 14, marginTop: 10, opacity: 0.7 }]}>
                        Dealing tiles and preparing the board
                    </Text>
                </View>
            );
        }

        return <LobbyScreen key="lobby-screen" roomData={roomData} currentUserId={localPlayerId} onStartGame={handleStartGame} onDeleteRoom={handleDeleteWaitingRoom} />;
    }

    const getPlayerScore = (player: Player) => {
        if (!currentDisplayState) return "";
        switch (currentDisplayState.gameMode) {
            case 'VICTOIRE': return `${player.totalRoundWins} 🏆`;
            case 'MANCHE': return `${player.mancheWins} ${player.mancheWins > 1 ? 'Manches' : 'Manche'}`;
            case 'SCORE': {
                // Points from previous manches only:
                // totalPoints = all cumulative points since game start
                // currentMancheStars = rounds won in current manche (each = +1 to totalPoints)
                // So: totalPoints - currentMancheStars = points from completed manches only
                const prevPoints = (player.totalPoints || 0) - (player.currentMancheStars || 0);
                return `${prevPoints} pts`;
            }
            case 'COCHON': return `${player.totalCochonsInfliges || 0} 🐷`;
            default: return "";
        }
    };


    return (
        <View key="game-container" style={styles.container} ref={rootRef as any} tabIndex={-1}>
            <View
                style={{ flex: 1 }}
                {...({ inert: (Platform.OS === 'web' && (showScoreOverlay || isPaused || showRoomInfo)) ? true : undefined } as any)}
            >
                <LinearGradient
                    colors={['#0a2e0a', '#4a0e0e', '#000000']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />

                <StatusBar barStyle="light-content" translucent />

                {debitFeedback && (
                    <Animated.View
                        key="debit-feedback"
                        entering={FadeInUp}
                        exiting={FadeOut}
                        style={{
                            position: 'absolute',
                            top: insets.top + 60,
                            alignSelf: 'center',
                            backgroundColor: 'rgba(0,0,0,0.8)',
                            paddingHorizontal: 20,
                            paddingVertical: 10,
                            borderRadius: 20,
                            zIndex: 9999,
                            borderWidth: 1,
                            borderColor: '#FFD700',
                        }}
                    >
                        <Text style={{ color: '#FFD700', fontWeight: 'bold', fontSize: 18 }}>{debitFeedback}</Text>
                    </Animated.View>
                )}

                <GameHeader
                    gameState={currentDisplayState}
                    insets={insets}
                    onOpenOptions={() => setShowOptions(true)}
                />

                <GameOptionsMenu
                    visible={showOptions}
                    onClose={() => setShowOptions(false)}
                    isSoloMode={isSoloMode}
                    gameState={currentDisplayState}
                    gameId={gameId}
                    roomData={roomData}
                    isBgmEnabled={isBgmEnabled}
                    onToggleBgm={async () => {
                        const newState = await SoundManager.setBgmEnabled(!isBgmEnabled);
                        setIsBgmEnabled(newState);
                    }}
                    isSfxEnabled={isSfxEnabled}
                    onToggleSfx={async () => {
                        const newState = await SoundManager.setSfxEnabled(!isSfxEnabled);
                        setIsSfxEnabled(newState);
                    }}
                    isVibrationEnabled={isVibrationEnabled}
                    onToggleVibration={async () => {
                        const newState = !isVibrationEnabled;
                        await SettingsManager.setVibrationEnabled(newState);
                        setIsVibrationEnabled(newState);
                    }}
                    onQuitGame={handleLeaveRoom}
                />



                {gameState?.phase !== 'MATCH_END' && (
                    <GameTable
                        ref={tableRef}
                        key={layoutKey}
                        gameState={gameState}
                        theme={tableTheme}
                        pendingDomino={pendingDomino}
                        onSideSelect={wrappedConfirmSidePlay}
                        skinConfig={playerSkinConfig}
                        hiddenDominoId={effectiveHiddenDominoId}
                    />
                )}


                {/* QUICK CHAT UI */}
                {!isGameOver && !isSoloMode && (
                    <QuickChat
                        onSelectMessage={triggerLocalChat}
                        onSelectEmoji={triggerLocalChat}
                    />
                )}
            </View>

            {gameState?.phase !== 'MATCH_END' && !showRoundResult && !isCurrentBoudeResultVisible && (
                <ActionFooter
                    localPlayer={localPlayerForActionFooter as any}
                    gameState={currentDisplayState}
                    localPlayerId={localPlayerId}
                    bannerState={bannerState}
                    forcedOpeningDominoId={forcedOpeningDominoId}
                    insets={insets}
                    onPlayDomino={wrappedHandlePlayDomino}
                    isPaused={isGamePaused || isMoveAnimationActive}
                    skinConfig={playerSkinConfig}
                    handSortMode={handSortMode}
                    hiddenDominoId={hiddenHandDominoId}
                    preservePlayableHighlights={preserveLocalHandHighlights}
                    preservedPlayableDominoIds={preservedPlayableDominoIds}
                />
            )}

            {/* PlayerArea rendu après ActionFooter pour que le bouton tri soit toujours au-dessus */}
            <PlayerArea
                opponents={opponents}
                localPlayer={localPlayer as any}
                gameState={currentDisplayState}
                localPlayerId={localPlayerId}
                boudedPlayerId={localBoudedPlayerId}
                playersChat={playersChat as any}
                overtime={overtime}
                isBotPlaying={isProcessingMove}
                isPaused={isGamePaused || isMoveAnimationActive}
                insets={insets}
                avatarRefs={avatarRefs}
                getPlayerScore={getPlayerScore as any}
                skinConfig={playerSkinConfig}
                handSortMode={handSortMode}
                onSelectHandSortMode={(mode) => {
                    setHandSortMode(mode);
                }}
                isSoloMode={isSoloMode}
            />

            <GameOverlays
                gameState={currentDisplayState}
                pendingDomino={pendingDomino}
                isLandscape={isLandscape}
                insets={insets}
                isSoloMode={isSoloMode}
                gameId={gameId}
                showRoomInfo={showRoomInfo}
                onCloseRoomInfo={() => {}}
                showScoreOverlay={showScoreOverlay && gameState?.phase === 'MATCH_END'}
                localPlayerId={localPlayerId}
                onOverlayContinue={interceptOverlayContinue}
                onLeaveRoom={handleLeaveRoom}
                onReplay={handleReplay}
                roomData={roomData}
                bannerState={bannerState}
                isPaused={isPaused}
                onResume={() => setIsPaused(false)}
                matchReward={matchReward}
            />

            <RewardOverlay
                visible={showRewardOverlay && !!matchReward}
                reward={matchReward}
                isWinner={isLocalMatchWinner}
                onContinue={() => setShowRewardOverlay(false)}
                playerName={localPlayer?.name ?? ''}
            />



            {/* ✅ FIX ANTI-ZOMBIE: Overlay temporaire pendant la reprise */}
            {isRejoining && (
                <View style={[StyleSheet.absoluteFillObject, { zIndex: 999 }]}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ color: '#FFD700', fontSize: 24, fontWeight: 'bold' }}>Reprise de la connexion...</Text>
                    </View>
                </View>
            )}

            {/* ✅ MancheEndFlow — résumé de la manche */}
            {(showScoreOverlay && gameState?.phase === 'MANCHE_END') && (
                <MancheEndFlow
                    gameState={gameState!}
                    visible={true}
                    localPlayerId={localPlayerId}
                    onContinue={interceptOverlayContinue}
                    isHost={isLocalHost}
                />
            )}

            {/* ✨ RoundEndFlow — résumé animé avant l'écran de score */}
            {(roundResultSnapshot ?? gameState) && (
                <RoundEndFlow
                    gameState={roundResultSnapshot ?? gameState!}
                    visible={showRoundResult || !!isCurrentBoudeResultVisible}
                    onDismiss={handleDismissRoundResult}
                    localPlayerId={localPlayerId}
                    opponents={opponents}
                    isHost={isLocalHost}
                    autoAdvanceDelay={isSoloMode ? 0 : 4000}
                    localPlayerIndex={(roundResultSnapshot ?? gameState)?.players.findIndex(p => p.id === localPlayerId) ?? 0}
                />
            )}



            {/* Popup cadeau de fin de partie */}
            <MatchRewardModal
                visible={showMatchRewardModal}
                amount={matchRewardAmount}
                onClose={() => setShowMatchRewardModal(false)}
                onClaim={() => {
                    economyService.creditAdReward(persistenceUserId, undefined, matchRewardAmount).catch(e =>
                        LogService.error('GameScreen', '[ADS-REWARD] creditAdReward failed:', e)
                    );
                }}
            />
            {flyingDomino && (
                <FlyingDomino
                    key={flyingDomino.animationId}
                    data={flyingDomino}
                    skinConfig={playerSkinConfig}
                    onFinished={() => {
                        SoundManager.playClack();
                        finishFlyingDomino('finished');
                    }}
                />
            )}
            {/* ANIMATION TEXTE BOUDÉ */}
            {localBoudedPlayerId && gameState?.phase === 'PLAYING' && (() => {
                const bPlayer = gameState?.players.find(p => p.id === localBoudedPlayerId);
                if (!bPlayer) return null;
                const isMe = bPlayer.id === localPlayerId;
                const text = isMe ? "Vous êtes boudé" : `${bPlayer.name} est boudé`;
                return (
                    <Animated.View
                        entering={FadeInUp.springify().damping(12).mass(0.8)}
                        exiting={FadeOut.duration(300)}
                        style={{
                            position: 'absolute',
                            top: isMe ? undefined : '12%',
                            bottom: isMe ? '15%' : undefined,
                            width: '100%',
                            alignItems: 'center',
                            zIndex: 9999,
                            elevation: 99,
                        }}
                        pointerEvents="none"
                    >
                        <View style={{
                            backgroundColor: 'rgba(0,0,0,0.85)',
                            paddingHorizontal: 28,
                            paddingVertical: 14,
                            borderRadius: 16,
                            borderWidth: 2,
                            borderColor: isMe ? '#FF6B6B' : '#4ECDC4',
                            shadowColor: isMe ? '#FF6B6B' : '#4ECDC4',
                            shadowOffset: { width: 0, height: 0 },
                            shadowOpacity: 0.5,
                            shadowRadius: 10,
                            elevation: 99,
                        }}>
                            <Text style={{
                                color: '#FFFFFF',
                                fontSize: 22,
                                fontWeight: '900',
                                letterSpacing: 1.5,
                                textTransform: 'uppercase',
                                textShadowColor: 'black',
                                textShadowOffset: { width: 0, height: 2 },
                                textShadowRadius: 4,
                            }}>{text}</Text>
                        </View>
                    </Animated.View>
                );
            })()}

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loading: {
        flex: 1,
        backgroundColor: '#1a1a1a',
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: { color: 'white' }
});
