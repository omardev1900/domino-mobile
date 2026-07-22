import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Text, Animated as RNAnimated, Image } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, useAnimatedStyle, withTiming, Easing, withRepeat, withSequence, FadeIn, FadeOut, ZoomIn, cancelAnimation } from 'react-native-reanimated';
import { Player } from '../core/types';
import { getAvatarImage, AvatarId } from '../core/avatars';
import { Ionicons } from '@expo/vector-icons';
import { DominoTile } from './DominoTile';
import { SkinConfig } from '../core/store.types';
import { ChatBubble } from './ChatBubble';
import { AvatarFrame } from './AvatarFrame';
import { LEAGUE_FRAMES_ENABLED, LEAGUE_GRADE_COLORS } from '../core/economy.constants';
import { LeagueGrade } from '../core/economy.types';
import { GradeBadge } from './GradeBadge';

interface PlayerAvatarProps {
    player: Player;
    isActive: boolean;
    showTimer?: boolean;
    timerDuration?: number;
    timerProgress?: number; // 0-1
    size?: number;
    position?: 'top-left' | 'top-right' | 'bottom' | 'top-center';
    layout?: 'vertical' | 'horizontal';
    namePlacement?: 'above' | 'below'; // Where to place the name in vertical layout
    score?: string; // Current score text (subtitle)
    ptsScore?: number; // True accumulated points (Camion) from previous manches
    showHandSize?: boolean; // Show remaining tiles count
    isPaused?: boolean; // NEW: Pause the timer
    onTimeout?: () => void; // Callback when timer expires
    isBoude?: boolean; // NEW: Player is currently blocked
    chatContent?: string | null; // NEW: Chat message or emoji
    overtime?: number | null; // NEW: Explicit 5s Overtime
    isBotPlaying?: boolean; // NEW: Show bot indicator
    gameMode?: string; // NEW: The current game mode to conditionally show specific stats
    showHandDominoes?: boolean; // NEW: Reveal remaining dominoes in hand
    skinConfig?: SkinConfig; // NEW: Skin configuration for dominoes
    dimmed?: boolean; // NEW: Theatrical focus (dimmed if waiting)
    isSoloMode?: boolean; // Hide bot league visuals in solo only
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
    player,
    isActive,
    showTimer = false,
    timerDuration = 20,
    timerProgress = 1,
    size = 60,
    position = 'bottom',
    layout = 'vertical',
    namePlacement = 'below',
    score,
    ptsScore = 0,
    showHandSize = true,
    isPaused = false,
    onTimeout,
    isBoude = false,
    chatContent,
    overtime = null,
    isBotPlaying = false,
    gameMode,
    showHandDominoes = false,
    skinConfig,
    dimmed = false,
    isSoloMode = false,
}) => {
    const strokeWidth = 3; // Reduced from 4
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    const animatedProgress = useSharedValue(1);
    const breatheValue = useSharedValue(1);
    const pingValue = useSharedValue(0); // NEW: Pulsing halo
    const boudeBlink = useSharedValue(1); // R2-B1 : clignotement continu pendant le Boudé
    const [secondsLeft, setSecondsLeft] = useState(timerDuration);
    const scaleAnim = useRef(new RNAnimated.Value(1)).current;
    const opacityAnim = useRef(new RNAnimated.Value(1)).current; // NEW: Theatrical focus
    // FIX: Référence de montage pour éviter setState/animations après unmount
    const isMountedRef = useRef(true);

    // FIX: Annulation globale de toutes les animations Reanimated à l'unmount
    // Évite le crash RetryableMountingLayerException sur Android Fabric
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            cancelAnimation(animatedProgress);
            cancelAnimation(breatheValue);
            cancelAnimation(pingValue);
            cancelAnimation(boudeBlink);
        };
    }, []);

    // Theatrical Focus Transition
    useEffect(() => {
        RNAnimated.timing(opacityAnim, {
            toValue: dimmed ? 0.45 : 1, // 45% opacity for waiting players
            duration: 400,
            useNativeDriver: true
        }).start();
    }, [dimmed]);

    // R2-B1 : Clignotement continu de l'avatar pendant l'état Boudé
    useEffect(() => {
        if (isBoude) {
            boudeBlink.value = withRepeat(
                withSequence(
                    withTiming(0.25, { duration: 250 }),
                    withTiming(1, { duration: 250 })
                ),
                -1,
                true
            );
        } else {
            boudeBlink.value = withTiming(1, { duration: 150 });
        }
    }, [isBoude]);

    // Timer Countdown Effect
    useEffect(() => {
        if (showTimer && isActive && !isPaused && !isBoude) {
            // Start countdown
            const interval = setInterval(() => {
                // FIX: Ne pas mettre à jour l'état si le composant est démonté
                if (!isMountedRef.current) {
                    clearInterval(interval);
                    return;
                }
                setSecondsLeft(prev => {
                    const newValue = prev - 1;
                    if (newValue < 0) return 0;
                    return newValue;
                });
            }, 1000);

            // Animate ring (approximate remaining time)
            const remainingDuration = secondsLeft * 1000;
            animatedProgress.value = withTiming(0, {
                duration: remainingDuration,
                easing: Easing.linear,
            });

            // Breathing effect for active player
            breatheValue.value = withRepeat(
                withSequence(
                    withTiming(1.1, { duration: 1000 }),
                    withTiming(1, { duration: 1000 })
                ),
                -1,
                true
            );

            // Ping Halo effect for active player
            pingValue.value = 0;
            pingValue.value = withRepeat(
                withTiming(1, { duration: 1500, easing: Easing.out(Easing.ease) }),
                -1,
                false
            );

            return () => {
                clearInterval(interval);
                // We don't reset breatheValue here to allow it to stay at 1 when paused
            };
        } else {
            // Paused or not active
            if (isPaused) {
                // Keep current progress
                animatedProgress.value = animatedProgress.value;
                breatheValue.value = withTiming(1);
                pingValue.value = 0;
            } else {
                animatedProgress.value = 1;
                setSecondsLeft(timerDuration);
                breatheValue.value = 1;
                pingValue.value = 0;
            }
        }
    }, [showTimer, isActive, isPaused, timerDuration, isBoude]);

    const animatedAvatarStyle = useAnimatedStyle(() => ({
        transform: [{ scale: breatheValue.value }],
    }));

    const pingStyle = useAnimatedStyle(() => ({
        transform: [{ scale: 1 + pingValue.value * 0.8 }], // Expands up to 1.8x
        opacity: 0.6 * (1 - pingValue.value) // Fades out as it expands
    }));

    // Timeout Trigger Effect
    useEffect(() => {
        if (showTimer && isActive && !isBoude && secondsLeft === 0) {
            if (onTimeout) {
                onTimeout();
            }
        }
    }, [secondsLeft, showTimer, isActive, isBoude, onTimeout]);

    // BOMB ANIMATION EFFECT (Scale pulse at 0s or Overtime)
    useEffect(() => {
        const shouldPulse = showTimer && isActive && !isPaused && !isBoude && (secondsLeft === 0 || (overtime !== null && overtime > 0));

        if (shouldPulse) {
            const animation = RNAnimated.loop(
                RNAnimated.sequence([
                    RNAnimated.timing(scaleAnim, {
                        toValue: 1.15,
                        duration: 150,
                        useNativeDriver: true
                    }),
                    RNAnimated.timing(scaleAnim, {
                        toValue: 1,
                        duration: 150,
                        useNativeDriver: true
                    }),
                ])
            );
            animation.start();
            return () => {
                animation.stop();
                scaleAnim.setValue(1);
            };
        } else {
            scaleAnim.setValue(1);
        }
    }, [secondsLeft, overtime, showTimer, isActive, isPaused, isBoude]);

    const animatedProps = useAnimatedProps(() => ({
        strokeDashoffset: circumference * (1 - animatedProgress.value),
    }));

    const isHorizontal = layout === 'horizontal';
    const isTopLeft = position === 'top-left';
    const isTopRight = position === 'top-right';
    const isTopOpponent = isTopLeft || isTopRight;
    const isLocalPlayer = position === 'bottom';
    const hideLeagueVisuals = isSoloMode && player.status === 'BOT';

    // L'image de l'avatar est sûrement gérée par getAvatarImage 
    // qui recourt au placeholder 'avatar_default' si non trouvée
    const avatarImage = getAvatarImage(player.avatarId);

    // Image scaling factor to zoom into the face (top portion)
    const imageScale = 1.8;
    const imageSize = size * imageScale;
    const imageOffset = -(imageSize - size) * 0.25;
    const boudeBlinkStyle = useAnimatedStyle(() => {
        return {
            opacity: boudeBlink.value
        };
    });

    // R2-B1 : quand le joueur est boudé, on masque le compteur/anneau/halo — avatar normal + clignotement
    const showTimerUi = showTimer && isActive && !isBoude;

    return (
        <RNAnimated.View style={[
            styles.container,
            isHorizontal && position !== 'top-right' && styles.containerRow,
            isHorizontal && position === 'top-right' && styles.containerRowReverse,
            { transform: [{ scale: scaleAnim }], opacity: opacityAnim }
        ]}>
            <Animated.View style={[
                boudeBlinkStyle,
                isHorizontal && position !== 'top-right' && styles.containerRow,
                isHorizontal && position === 'top-right' && styles.containerRowReverse,
            ]}>
                {chatContent && (
                    <ChatBubble
                        content={chatContent}
                        position={position?.startsWith('top') ? 'bottom' : 'top'}
                    />
                )}
                {/* Name above avatar in vertical layout */}
                {!isHorizontal && namePlacement === 'above' && (
                    <View style={styles.nameContainerVertical}>
                        <Text style={[styles.playerName, styles.nameVertical]} numberOfLines={1}>{player.name}</Text>
                        <Text style={styles.mancheZetwal}>{player.currentMancheStars || 0} ⭐</Text>
                        {score && <Text style={styles.playerScore}>{score}</Text>}
                        {showHandSize && (
                            <View style={styles.handSizeBadge}>
                                <Ionicons name="documents-outline" size={10} color="#FFF" style={{ opacity: 0.6 }} />
                                <Text style={styles.handSizeText}>{player.handSize}/7</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Wrapper colonne avatar+nom pour le mode horizontal+namePlacement=below */}
                <View style={isHorizontal && namePlacement === 'below' ? styles.avatarColumnWrapper : undefined}>
                <Animated.View style={[{ width: size + 12, height: size + 12, alignItems: 'center', justifyContent: 'center' }, animatedAvatarStyle]}>
                    
                    {/* Pulsing Ping Halo */}
                    {showTimerUi && (
                        <Animated.View style={[
                            {
                                position: 'absolute',
                                width: size,
                                height: size,
                                borderRadius: size / 2,
                                backgroundColor: '#FFD700',
                            },
                            pingStyle
                        ]} />
                    )}

                    {/* Avatar Circle */}
                    <View
                        style={[
                            styles.avatar,
                            {
                                width: size,
                                height: size,
                                borderRadius: size / 2,
                                borderWidth: isActive ? 3 : 2,
                                borderColor: isActive
                                    ? '#FFD700'
                                    : (!hideLeagueVisuals && player.leagueGrade && typeof LEAGUE_GRADE_COLORS !== 'undefined' && LEAGUE_GRADE_COLORS[player.leagueGrade as LeagueGrade])
                                        || '#78909C', // [R3-M2] Gris-bleu visible pour les joueurs sans grade
                                overflow: 'hidden',
                                backgroundColor: (showTimerUi && (secondsLeft === 0 || overtime !== null)) ? '#FF0000' : 'rgba(50,50,50,0.9)'
                            },
                            isActive && styles.activeGlow,
                        ]}
                    >
                        <Image
                            source={avatarImage}
                            style={{
                                width: imageSize,
                                height: imageSize,
                                position: 'absolute',
                                top: imageOffset,
                                left: (size - imageSize) / 2,
                                opacity: showTimerUi ? 0 : 1,
                            }}
                            resizeMode="cover"
                        />
                        {showTimerUi && (
                            <Text style={[
                                styles.countdown,
                                { fontSize: size / 2.2 },
                                (secondsLeft === 0 || overtime !== null) && {
                                    color: (overtime !== null && overtime > 0) ? '#FFFFFF' : '#FFD700',
                                    fontWeight: 'bold',
                                    fontSize: (size / 2.2) * 1.2
                                }
                            ]}>
                                {overtime !== null ? overtime : secondsLeft}
                            </Text>
                        )}
                        
                        {/* L'overlay est supprimé ici pour laisser l'avatar visible */}


                        {/* DISCONNECTED OVERLAY (Priorité sur Bot) */}
                        {player.status === 'DISCONNECTED' ? (
                            <View style={styles.disconnectedOverlay}>
                                <Ionicons name="wifi" size={24} color="#FFF" style={{ opacity: 0.5, marginBottom: -8 }} />
                                <Text style={styles.disconnectedIcon}>/</Text>
                                <Text style={styles.disconnectedText}>DÉCONNECTÉ</Text>
                            </View>
                        ) : isBotPlaying && (
                            <View style={styles.botOverlay}>
                                <Text style={styles.botText}>BOT...</Text>
                            </View>
                        )}
                    </View>

                    {/* Cadre de Ligue des Cochons (Placé hors du overflow: hidden pour ne pas être rogné) */}
                    {LEAGUE_FRAMES_ENABLED && !hideLeagueVisuals && player.activeFrame && (
                        <AvatarFrame frameId={player.activeFrame} size={size} />
                    )}

                    {/* Timer Ring */}
                    {showTimerUi && (
                        <Svg
                            width={size + 12}
                            height={size + 12}
                            style={styles.timerSvg}
                        >
                            <Circle
                                cx={(size + 12) / 2}
                                cy={(size + 12) / 2}
                                r={radius + 4}
                                stroke="rgba(255,255,255,0.2)"
                                strokeWidth={strokeWidth}
                                fill="none"
                            />
                            <AnimatedCircle
                                cx={(size + 12) / 2}
                                cy={(size + 12) / 2}
                                r={radius + 4}
                                stroke="#4CAF50"
                                strokeWidth={strokeWidth}
                                fill="none"
                                strokeDasharray={circumference}
                                strokeDashoffset={circumference}
                                strokeLinecap="round"
                                animatedProps={animatedProps}
                                transform={`rotate(-90, ${(size + 12) / 2}, ${(size + 12) / 2})`}
                            />
                        </Svg>
                    )}

                    {/* Overlaid Hand Size Badge for Horizontal Layout */}
                    {showHandSize && isHorizontal && (
                        <View style={[
                            styles.handBadgeOverlaid,
                            position === 'top-right' ? styles.handBadgeBottomLeft : styles.handBadgeBottomRight
                        ]}>
                            <Text style={styles.handBadgeText}>{player.handSize}</Text>
                        </View>
                    )}
                </Animated.View>

                {/* Nom sous l'avatar en layout horizontal + namePlacement=below */}
                {isHorizontal && namePlacement === 'below' && (
                    <>
                        <Text style={styles.nameUnderAvatar} numberOfLines={1}>{player.name}</Text>
                        {/* Stats sous le nom (adversaires uniquement) */}
                        {position?.startsWith('top') && (
                            <View style={styles.opponentStatsUnderName}>
                                {gameMode === 'COCHON' && (
                                    <View style={styles.opponentStatCol}>
                                        <Text style={styles.statLabelCochon}>🐷</Text>
                                        <Text style={styles.statValueCochon}>{player.totalCochonsInfliges || 0}</Text>
                                    </View>
                                )}
                                <View style={styles.opponentStatCol}>
                                    <Text style={styles.statLabelV}>V</Text>
                                    <Text style={styles.statValueV}>
                                        {gameMode === 'VICTOIRE' ? (player.totalRoundWins || 0) : (player.currentMancheStars || 0)}
                                    </Text>
                                </View>
                                <View style={styles.opponentStatCol}>
                                    <Text style={styles.statLabelPTS}>PTS</Text>
                                    <Text style={styles.statValuePTS}>{ptsScore}</Text>
                                </View>
                            </View>
                        )}
                        {/* BOUDÉ sous les stats pour les adversaires */}
                        {position?.startsWith('top') && isBoude && (
                            <Animated.View entering={ZoomIn.duration(300)} style={styles.boudeBadgeBottom}>
                                <Text style={styles.boudeBadgeText}>🚫 BOUDÉ</Text>
                            </Animated.View>
                        )}
                    </>
                )}
                </View>

                {/* Name below avatar in vertical layout */}
                {
                    !isHorizontal && namePlacement === 'below' && (
                        <View style={styles.nameContainerVerticalBelow}>
                            <Text style={[styles.playerName, styles.nameVertical]} numberOfLines={1}>{player.name}</Text>
                            <Text style={styles.mancheZetwal}>{player.currentMancheStars || 0} ⭐</Text>
                            {score && <Text style={styles.playerScore}>{score}</Text>}
                            {showHandSize && (
                                <View style={styles.handSizeBadge}>
                                    <Ionicons name="documents-outline" size={10} color="#FFF" style={{ opacity: 0.6 }} />
                                    <Text style={styles.handSizeText}>{player.handSize}/7</Text>
                                </View>
                            )}
                        </View>
                    )
                }

                {/* Info Block for Horizontal Layout — masqué pour adversaires si stats sous le nom */}
                        <View style={[
                            styles.opponentInfoBlock,
                            position === 'top-right' ? styles.opponentInfoBlockRight : styles.opponentInfoBlockLeft,
                            (position?.startsWith('top') && namePlacement === 'below') && styles.hidden,
                        ]}>
                            {/* BOUDÉ LABEL FOR LOCAL PLAYER (Shows ABOVE name) */}
                            {!position?.startsWith('top') && isBoude && (
                                <Animated.View entering={ZoomIn.duration(300)} style={styles.boudeBadgeTop}>
                                    <Text style={styles.boudeBadgeText}>🚫 BOUDÉ</Text>
                                </Animated.View>
                            )}

                            {namePlacement !== 'below' && (
                                <Text style={styles.opponentNameText} numberOfLines={1}>{player.name}</Text>
                            )}
                            <View style={styles.opponentStatsRow}>
                                {gameMode === 'COCHON' && (
                                    <View style={styles.opponentStatCol}>
                                        <Text style={styles.statLabelCochon}>🐷</Text>
                                        <Text style={styles.statValueCochon}>{player.totalCochonsInfliges || 0}</Text>
                                    </View>
                                )}
                                <View style={styles.opponentStatCol}>
                                    <Text style={styles.statLabelV}>V</Text>
                                    <Text style={styles.statValueV}>
                                        {gameMode === 'VICTOIRE' ? (player.totalRoundWins || 0) : (player.currentMancheStars || 0)}
                                    </Text>
                                </View>
                                <View style={styles.opponentStatCol}>
                                    <Text style={styles.statLabelPTS}>PTS</Text>
                                    <Text style={styles.statValuePTS}>{ptsScore}</Text>
                                </View>
                            </View>

                            {/* BOUDÉ LABEL FOR OPPONENTS (Shows BELOW stats) */}
                            {position?.startsWith('top') && isBoude && (
                                <Animated.View entering={ZoomIn.duration(300)} style={styles.boudeBadgeBottom}>
                                    <Text style={styles.boudeBadgeText}>🚫 BOUDÉ</Text>
                                </Animated.View>
                            )}

                        </View>
                {/* RENDER REMAINING HAND ON BOUDE */}
                {showHandDominoes && player.hand && player.hand.length > 0 && (
                    <Animated.View
                        entering={FadeIn.delay(300)}
                        style={[
                            styles.handRevealContainer,
                            isHorizontal && (position === 'top-right' ? styles.handRevealRight : styles.handRevealLeft)
                        ]}
                    >
                        {player.hand.map((domino) => (
                            <DominoTile
                                key={domino.id}
                                left={domino.left}
                                right={domino.right}
                                size={18}
                                noMargin
                                skinConfig={skinConfig}
                                orientation="vertical"
                                entering={ZoomIn.delay(400)}
                            />
                        ))}
                    </Animated.View>
                )}
            </Animated.View>
        </RNAnimated.View >
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    containerRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    containerRowReverse: {
        flexDirection: 'row-reverse',
        alignItems: 'center',
    },
    avatar: {
        backgroundColor: 'rgba(50,50,50,0.9)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    activeGlow: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 10,
        elevation: 15,
    },
    defaultAvatar: {
        opacity: 0.9,
    },
    countdown: {
        color: '#FFD700',
        fontWeight: 'bold',
    },
    timerSvg: {
        position: 'absolute',
        top: 0,
        left: 0,
    },
    nameContainerVertical: {
        marginBottom: 6,
    },
    nameContainerVerticalBelow: {
        marginTop: 6,
    },
    playerName: {
        color: '#FFFFFF',
        fontSize: 10, // Reduced from 12
        fontWeight: 'bold',
        textAlign: 'center',
    },
    nameVertical: {
        maxWidth: 65, // Reduced from 80
    },
    playerScore: {
        color: '#FFD700',
        fontSize: 9, // Reduced from 10
        fontWeight: 'bold',
        textAlign: 'center',
        marginTop: 1,
    },
    mancheZetwal: {
        color: '#FFD700',
        fontSize: 10, // Reduced from 11
        fontWeight: '900',
        textAlign: 'center',
        marginTop: 1, // Reduced from 2
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    handSizeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        marginTop: 2,
        backgroundColor: 'rgba(0,0,0,0.3)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    handSizeText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '600',
        opacity: 0.8,
    },
    boudeBadgeTop: {
        backgroundColor: '#C0392B',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
        marginBottom: 3,
        alignSelf: 'center',
    },
    boudeBadgeBottom: {
        backgroundColor: '#C0392B',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
        marginTop: 3,
        alignSelf: 'center',
    },
    boudeBadgeText: {
        color: '#FFF',
        fontWeight: '900',
        fontSize: 8,
        letterSpacing: 0.5,
    },
    botOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 5,
    },
    botText: {
        color: '#FFD700',
        fontWeight: 'bold',
        fontSize: 10,
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    disconnectedOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(50, 50, 50, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 6,
    },
    disconnectedIcon: {
        color: '#E74C3C',
        fontSize: 32,
        fontWeight: '900',
        position: 'absolute',
        top: '20%',
        textShadowColor: 'rgba(0,0,0,1)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    disconnectedText: {
        color: '#E74C3C',
        fontWeight: '900',
        fontSize: 9,
        marginTop: 18,
        letterSpacing: -0.5,
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    handBadgeOverlaid: {
        position: 'absolute',
        backgroundColor: '#FFF',
        width: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#000',
        zIndex: 10,
    },
    handBadgeBottomLeft: {
        bottom: 0,
        left: -3,
    },
    handBadgeBottomRight: {
        bottom: 0,
        right: -3,
    },
    handBadgeText: {
        color: '#000',
        fontSize: 13,
        fontWeight: 'bold',
    },
    opponentInfoBlock: {
        backgroundColor: 'rgba(40, 30, 30, 0.8)', // More discrete
        borderRadius: 6,
        padding: 5,
        paddingVertical: 6,
        minWidth: 70, // Reduced from 80
    },
    opponentInfoBlockLeft: {
        marginLeft: 6,
    },
    opponentInfoBlockRight: {
        marginRight: 6,
    },
    opponentNameText: {
        color: '#FFFFFF',
        fontSize: 9, // Reduced from 11
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 4,
        textAlign: 'center',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        paddingBottom: 2,
    },
    opponentStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingHorizontal: 4,
    },
    opponentStatCol: {
        alignItems: 'center',
    },
    statLabelV: {
        color: '#4CAF50',
        fontSize: 9,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    statValueV: {
        color: '#4CAF50',
        fontSize: 11, // Reduced from 14
        fontWeight: '900',
    },
    statLabelPTS: {
        color: '#FFD700',
        fontSize: 9,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    statValuePTS: {
        color: '#FFD700',
        fontSize: 11, // Reduced from 14
        fontWeight: '900',
    },
    statLabelCochon: {
        fontSize: 9,
        marginBottom: 2,
    },
    statValueCochon: {
        color: '#FF9800',
        fontSize: 11, // Reduced from 14
        fontWeight: '900',
    },
    handRevealContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 4,
        marginTop: 10,
        maxWidth: 140,
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: 6,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: 'rgba(255,215,0,0.5)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 6,
        elevation: 10,
    },
    handRevealLeft: {
        position: 'absolute',
        top: 60,
        left: -10,
    },
    handRevealRight: {
        position: 'absolute',
        top: 60,
        right: -10,
    },
    // Wrapper colonne pour avatar + nom en-dessous (mode horizontal + namePlacement=below)
    avatarColumnWrapper: {
        alignItems: 'center',
    },
    nameUnderAvatar: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
        textAlign: 'center',
        maxWidth: 70,
        marginTop: 2,
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    // Ligne stats (V, PTS) affichée sous le nom dans avatarColumnWrapper
    opponentStatsUnderName: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        marginTop: 3,
        backgroundColor: 'rgba(40, 30, 30, 0.8)',
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 4,
    },
    // Cache l'opponentInfoBlock quand les stats sont déplacées sous le nom
    hidden: {
        display: 'none',
    },
});
