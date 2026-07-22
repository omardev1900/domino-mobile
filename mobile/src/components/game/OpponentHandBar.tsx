import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';

interface OpponentHandBarProps {
    /** Nombre de dominos restants dans la main (0–7) */
    handSize: number;
    /** Position de l'adversaire — détermine l'alignement de la barre */
    position: 'top-left' | 'top-right';
    /** Largeur de l'écran en px, pour le calcul adaptatif des tuiles */
    screenWidth: number;
    /**
     * Hauteur du container avatar (size + 12px de padding Animated.View).
     * Utilisé pour centrer la barre verticalement sur l'avatar et non sur tout le bloc.
     */
    avatarContainerHeight: number;
}

/**
 * Affiche la main d'un adversaire sous forme de rectangles blancs face cachée.
 * Placé à droite du bloc avatar pour top-left, à gauche pour top-right.
 * La taille des tuiles s'adapte à la largeur d'écran.
 * Le marginTop aligne la barre sur le centre de l'avatar, pas du bloc entier.
 */
export const OpponentHandBar: React.FC<OpponentHandBarProps> = ({
    handSize,
    position,
    screenWidth,
    avatarContainerHeight,
}) => {
    const tileSize = useMemo(() => {
        if (screenWidth >= 400) {
            return { w: 16, h: 32, gap: 3 };
        } else if (screenWidth >= 360) {
            return { w: 15, h: 30, gap: 3 };
        } else {
            return { w: 14, h: 28, gap: 2 };
        }
    }, [screenWidth]);

    // Centrage vertical : aligner le milieu des tuiles sur le milieu de l'avatar
    const marginTop = useMemo(
        () => Math.max(0, Math.floor((avatarContainerHeight - tileSize.h) / 2)),
        [avatarContainerHeight, tileSize.h]
    );

    // Barre vide si handSize = 0
    if (handSize <= 0) return null;

    const tiles = Array.from({ length: handSize });

    return (
        <Animated.View
            entering={FadeIn.duration(300)}
            layout={Layout.springify().damping(14).stiffness(120)}
            style={[
                styles.container,
                position === 'top-right' ? styles.alignRight : styles.alignLeft,
                { marginTop },
            ]}
        >
            {tiles.map((_, i) => (
                <Animated.View
                    key={i}
                    exiting={FadeOut.duration(200)}
                    style={[
                        styles.tile,
                        {
                            width: tileSize.w,
                            height: tileSize.h,
                            marginHorizontal: tileSize.gap / 2,
                        },
                    ]}
                />
            ))}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start', // Ne pas s'étirer sur toute la hauteur du parent
        paddingHorizontal: 3,
    },
    alignLeft: {
        justifyContent: 'flex-start',
    },
    alignRight: {
        justifyContent: 'flex-end',
    },
    tile: {
        backgroundColor: '#FFFFFF',
        borderRadius: 2,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.25)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
        elevation: 2,
    },
});
