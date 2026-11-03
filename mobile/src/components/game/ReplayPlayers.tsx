import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { GameState, Player } from '../../core/types';
import { SkinConfig } from '../../core/store.types';
import { PlayerAvatar } from '../PlayerAvatar';
import { DominoTile } from '../DominoTile';

interface Props {
    gameState: GameState;
    localPlayerId: string;
    skinConfig?: SkinConfig;
    avatarRefs?: React.MutableRefObject<Record<string, View | null>>;
    activePlayerId?: string | null;
    showOpponentHands?: boolean;
}

export const ReplayPlayers = ({ gameState, localPlayerId, skinConfig, avatarRefs, activePlayerId, showOpponentHands = true }: Props) => {
    const { width } = useWindowDimensions();
    const tileSize = width < 600 ? 17 : 21;
    const { players } = gameState;
    const localIndex = players.findIndex(player => player.id === localPlayerId);
    if (localIndex < 0) return null;
    const local = players[localIndex];
    const right = players.length > 1 ? players[(localIndex + 1) % players.length] : undefined;
    const left = players.length > 2 ? players[(localIndex + 2) % players.length] : undefined;
    const score = (player: Player) => {
        switch (gameState.gameMode) {
            case 'VICTOIRE': return `${player.totalRoundWins} 🏆`;
            case 'MANCHE': return `${player.mancheWins} ${player.mancheWins > 1 ? 'Manches' : 'Manche'}`;
            case 'SCORE': return `${(player.totalPoints || 0) - (player.currentMancheStars || 0)} pts`;
            case 'COCHON': return `${player.totalCochonsInfliges || 0} 🐷`;
        }
    };
    const avatar = (player: Player, position: 'top-left' | 'top-right' | 'bottom') => (
        <PlayerAvatar
            player={player}
            position={position}
            layout="horizontal"
            namePlacement="below"
            size={46}
            isActive={activePlayerId === player.id}
            isBoude={gameState.phase === 'PLAYING' && gameState.boudePlayerId === player.id}
            showTimer={false}
            showHandSize
            score={score(player)}
            ptsScore={(gameState.mancheHistory ?? []).reduce((sum, round) => sum + (round.points[player.id] || 0), 0)}
            gameMode={gameState.gameMode}
            skinConfig={skinConfig}
            isSoloMode
        />
    );
    const opponentHand = (player: Player, side: 'left' | 'right') => (
        <View testID={`replay-hand-${player.id}`} style={[styles.hand, side === 'left' ? styles.handLeft : styles.handRight]}>
            {player.hand.map((domino, index) => (
                <View key={domino.id} style={[styles.handTile, { top: index * (tileSize + 3) }, side === 'left' ? styles.handTileLeft : styles.handTileRight]}>
                    <DominoTile left={domino.left} right={domino.right} size={tileSize} orientation="horizontal" disabled noMargin flat pipScale={1.4} animateOnMount={false} skinConfig={skinConfig} />
                </View>
            ))}
        </View>
    );
    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {left && <View collapsable={false} ref={element => { if (avatarRefs) avatarRefs.current[left.id] = element; }} testID="replay-player-top-left" style={[styles.player, styles.topLeft]}>{avatar(left, 'top-left')}</View>}
            {right && <View collapsable={false} ref={element => { if (avatarRefs) avatarRefs.current[right.id] = element; }} testID="replay-player-top-right" style={[styles.player, styles.topRight]}>{avatar(right, 'top-right')}</View>}
            <View collapsable={false} ref={element => { if (avatarRefs) avatarRefs.current[local.id] = element; }} testID="replay-player-bottom-left" style={[styles.player, styles.bottomLeft]}>{avatar(local, 'bottom')}</View>
            {showOpponentHands && left && opponentHand(left, 'left')}
            {showOpponentHands && right && opponentHand(right, 'right')}
        </View>
    );
};

const styles = StyleSheet.create({
    player: { position: 'absolute', zIndex: 1 },
    topLeft: { left: 0, top: 0 },
    topRight: { right: 0, top: 0 },
    bottomLeft: { left: 0, bottom: 0 },
    hand: { position: 'absolute', top: 0, width: 72, height: 180 },
    handLeft: { left: 66 },
    handRight: { right: 66 },
    handTile: { position: 'absolute' },
    handTileLeft: { left: 0 },
    handTileRight: { right: 0 },
});
