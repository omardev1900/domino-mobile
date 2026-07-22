import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { GameState, Player, Domino } from '../../../core/types';
import SoundManager from '../../../core/audio/SoundManager';
import { RoundEndBanner } from './RoundEndBanner';
import { PlayerRevealBlock } from './PlayerRevealBlock';
import { WinnerHighlight } from './WinnerHighlight';

interface RoundEndFlowProps {
    gameState: GameState;
    visible: boolean;
    onDismiss: () => void;
    localPlayerId: string;
    opponents: Player[];
    skipAnimation?: boolean;
    isHost?: boolean;
    /** Délai en ms avant passage automatique (hôte uniquement). 0 = désactivé. */
    autoAdvanceDelay?: number;
    /** Index 0-based du joueur local dans players[] pour échelonner les fallbacks non-hôte */
    localPlayerIndex?: number;
}

type FlowPhase = 'idle' | 'dimming' | 'reveal' | 'counting' | 'result';

export const RoundEndFlow: React.FC<RoundEndFlowProps> = ({ gameState, visible, onDismiss, localPlayerId, opponents, skipAnimation, isHost, autoAdvanceDelay, localPlayerIndex = 0 }) => {
    const [phase, setPhase] = useState<FlowPhase>('idle');
    const [countsCompleted, setCountsCompleted] = useState(0);
    const [skipCountingNow, setSkipCountingNow] = useState(false);

    const isBoude = gameState.phase === 'BOUDE';

    // Calcul du vainqueur
    const handScore = (hand: Domino[]) => hand.reduce((s, d) => s + d.left + d.right, 0);
    const winner = (() => {
        if (isBoude) {
            const minScore = Math.min(...gameState.players.map(p => handScore(p.hand)));
            const winners = gameState.players.filter(p => handScore(p.hand) === minScore);
            return winners.length === 1 ? winners[0] : null; // null = tie
        }
        return gameState.players.find(p => p.id === gameState.firstPlayerOfRound) ?? null;
    })();

    const isTie = winner === null;

    useEffect(() => {
        const timeouts: ReturnType<typeof setTimeout>[] = [];

        if (!visible) {
            setPhase('idle');
            setCountsCompleted(0);
            setSkipCountingNow(false);
            return;
        }

        if (phase === 'idle') {
            if (skipAnimation) {
                setPhase('result');
                return;
            }

            // Démarre la phase 1
            setPhase('dimming');
            if (isBoude) {
                if (gameState.phase === 'PARTIE_END') {
                    SoundManager.playSound('roundEnd');
                } else if (gameState.phase === 'MANCHE_END' || gameState.phase === 'BOUDE') {
                    SoundManager.playSound('mancheEnd');
                }
            }

            // Timeline (Accélérée)
            timeouts.push(setTimeout(() => {
                setPhase('reveal');
                // Simulate clack sounds
                const totalDominoes = gameState.players.reduce((sum, p) => sum + p.hand.length, 0);
                const clacks = Math.min(totalDominoes, 5);
                for (let i = 0; i < clacks; i++) {
                    timeouts.push(setTimeout(() => SoundManager.playSound(`clack${(i % 3) + 1}` as any), i * 100));
                }

                timeouts.push(setTimeout(() => {
                    const playersWithDominoes = gameState.players.filter(p => p.hand.length > 0).length;
                    if (playersWithDominoes === 0) {
                        // Empty hand case: nobody has dominos, jump straight to result
                        setPhase('result');
                    } else {
                        setPhase('counting');
                    }
                }, 800));

            }, 600));
        }

        return () => {
            timeouts.forEach(clearTimeout);
        };
    }, [visible, skipAnimation]);

    // Handle counting completion
    const totalPlayersWithDominoes = gameState.players.filter(p => p.hand.length > 0).length;

    useEffect(() => {
        if (phase === 'counting' && countsCompleted >= totalPlayersWithDominoes) {
            setPhase('result');
        }
    }, [countsCompleted, phase, winner, totalPlayersWithDominoes]);

    const handleContinuePress = () => {
        if (phase === 'counting') {
            // Skip : afficher les totaux immédiatement
            setSkipCountingNow(true);
            setPhase('result');
            // Auto-dismiss après 500ms pour laisser le temps de voir les totaux
            setTimeout(() => {
                onDismiss();
            }, 500);
        } else {
            // Phase reveal ou result : fermer directement
            onDismiss();
        }
    };

    if (!visible || phase === 'idle') return null;

    const localPlayer = gameState.players.find(p => p.id === localPlayerId);

    return (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 1000, elevation: 1000 }]} pointerEvents="box-none">
            
            {/* TEMPORAIRE : Masqué pour test de l'affichage sans bannière */}
            <RoundEndBanner isBoude={isBoude} visible={false} />

            {/* Players */}
            {localPlayer && localPlayer.hand.length > 0 && (
                <PlayerRevealBlock 
                    player={localPlayer} 
                    position="bottom" 
                    phase={phase} 
                    onCountComplete={() => setCountsCompleted(c => c + 1)} 
                    skipCounting={skipCountingNow}
                />
            )}
            {opponents[0] && opponents[0].hand.length > 0 && (
                <PlayerRevealBlock 
                    player={opponents[0]} 
                    position="top-right" 
                    phase={phase} 
                    onCountComplete={() => setCountsCompleted(c => c + 1)} 
                    skipCounting={skipCountingNow}
                />
            )}
            {opponents[1] && opponents[1].hand.length > 0 && (
                <PlayerRevealBlock 
                    player={opponents[1]} 
                    position="top-left" 
                    phase={phase} 
                    onCountComplete={() => setCountsCompleted(c => c + 1)} 
                    skipCounting={skipCountingNow}
                />
            )}

            <WinnerHighlight 
                winner={winner} 
                isTie={isTie} 
                isBoude={isBoude}
                localPlayerId={localPlayerId}
                visible={phase !== 'idle' && phase !== 'dimming'} 
                onContinue={handleContinuePress}
                isHost={isHost}
                autoAdvanceDelay={autoAdvanceDelay}
                localPlayerIndex={localPlayerIndex}
            />
        </View>
    );
};
