import React from 'react';
import { Image as ExpoImage } from 'expo-image';
import type { ImageStyle, StyleProp } from 'react-native';

import { LogService } from '../../core/services/LogService';

type BundledImageProps = {
    /** `require(...)` d'un asset embarqué dans l'APK, ou `{ uri }` d'une image distante. */
    source: number | { uri: string };
    style?: StyleProp<ImageStyle>;
};

/**
 * Affiche une image embarquée (`require`) ou distante via `expo-image`.
 *
 * À préférer systématiquement à `Image` de `react-native` : dans l'APK release,
 * une ressource locale passée à `Image` de `react-native` peut rester vide
 * (zone d'image sans contenu), alors qu'`expo-image` résout correctement la
 * ressource Android (`res:/<id>`) pour un identifiant `require` numérique.
 */
export function BundledImage({ source, style }: BundledImageProps) {
    return (
        <ExpoImage
            source={source}
            style={style}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={0}
            onError={() => {
                const label = typeof source === 'number' ? `asset #${source}` : source.uri;
                LogService.warn('Image', `Échec du chargement de l’image ${label}`);
            }}
        />
    );
}
