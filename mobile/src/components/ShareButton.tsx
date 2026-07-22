import React, { useRef, useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, View, Platform, Share, Image } from 'react-native';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';
import { Ionicons } from '@expo/vector-icons';

const APP_URL = 'https://play.domino-martinique.online/';
const APP_NAME = 'Martinique Domino Cochon';

// ── Textes de partage ─────────────────────────────────────────────────────────

export function buildWinShareText(params: {
    playerName: string;
    cochons: number;
    gradeLabel: string;
}): string {
    const { cochons, gradeLabel } = params;
    return (
        `Je viens de gagner une partie de Domino ! 🎲🏆\n` +
        `🐷 ${cochons} cochon${cochons > 1 ? 's' : ''} infligé${cochons > 1 ? 's' : ''}\n` +
        `🏅 Rang : ${gradeLabel}\n` +
        `Vini joué épi mwen 👉 ${APP_URL}`
    );
}

export function buildGradeShareText(params: {
    gradeLabel: string;
    totalCochons: number;
}): string {
    const { gradeLabel, totalCochons } = params;
    return (
        `Je viens de passer au palier ${gradeLabel} ! 🏆🐷\n` +
        `🐷 ${totalCochons} cochon${totalCochons > 1 ? 's' : ''} infligés au total\n` +
        `Vini joué épi mwen 👉 ${APP_URL}`
    );
}

// ── Bouton partage texte (fin de partie) ──────────────────────────────────────

interface ShareTextButtonProps {
    text: string;
    label?: string;
    /** Contenu à capturer comme image (carte victoire). Sinon, texte seul. */
    cardContent?: React.ReactNode;
    iconOnly?: boolean;
    buttonStyle?: any;
    wrapperStyle?: any;
    iconColor?: string;
    iconSize?: number;
}

export function ShareTextButton({ text, label = 'Partager', cardContent, iconOnly = false, buttonStyle, wrapperStyle, iconColor = "#1A0E2E", iconSize = 18 }: ShareTextButtonProps) {
    const viewShotRef = useRef<ViewShot>(null);
    const [sharing, setSharing] = useState(false);

    const handleShare = async () => {
        if (sharing) return;
        setSharing(true);
        try {
            if (Platform.OS === 'web') {
                if (navigator.share) {
                    await navigator.share({ text });
                } else {
                    await navigator.clipboard.writeText(text);
                }
                return;
            }
            const isAvailable = await Sharing.isAvailableAsync();
            if (isAvailable && cardContent && viewShotRef.current) {
                const uri = await (viewShotRef.current as any).capture();
                await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: APP_NAME });
                return;
            }
            // Fallback : texte seul
            await Share.share({ message: text });
        } catch (_) {
            // Annulé par l'utilisateur
        } finally {
            setSharing(false);
        }
    };

    return (
        <View style={[styles.shareBtnWrapper, wrapperStyle]}>
            {cardContent && (
                <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }} style={styles.offscreen}>
                    {cardContent}
                </ViewShot>
            )}
            <TouchableOpacity style={buttonStyle || styles.shareBtn} onPress={handleShare} activeOpacity={0.8} disabled={sharing}>
                <Ionicons name="share-social" size={iconSize} color={iconColor} />
                {!iconOnly && <Text style={styles.shareBtnText}>{label}</Text>}
            </TouchableOpacity>
        </View>
    );
}

// ── Bouton partage image (passage de palier) ──────────────────────────────────

interface ShareImageButtonProps {
    /** Le composant à capturer comme image (carte de palier) */
    children: React.ReactNode;
    text: string;
    label?: string;
}

export function ShareImageButton({ children, text, label = 'Partager' }: ShareImageButtonProps) {
    const viewShotRef = useRef<ViewShot>(null);
    const [sharing, setSharing] = useState(false);

    const handleShare = async () => {
        if (sharing || !viewShotRef.current) return;
        setSharing(true);
        try {
            if (Platform.OS === 'web') {
                if (navigator.share) {
                    await navigator.share({ text });
                } else {
                    await navigator.clipboard.writeText(text);
                }
                return;
            }
            const isAvailable = await Sharing.isAvailableAsync();
            if (!isAvailable) return;

            const uri = await (viewShotRef.current as any).capture();
            await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: `Partager sur ${APP_NAME}` });
        } catch (_) {
            // Annulé par l'utilisateur
        } finally {
            setSharing(false);
        }
    };

    return (
        <View style={styles.shareBtnWrapper}>
            <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }} style={styles.offscreen}>
                {children}
            </ViewShot>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.8} disabled={sharing}>
                <Ionicons name="share-social" size={18} color="#1A0E2E" />
                <Text style={styles.shareBtnText}>{label}</Text>
            </TouchableOpacity>
        </View>
    );
}

// ── Carte victoire à capturer ─────────────────────────────────────────────────

interface WinShareCardProps {
    playerName: string;
    cochons: number;
    gradeLabel: string;
}

export function WinShareCard({ playerName, cochons, gradeLabel }: WinShareCardProps) {
    return (
        <View style={styles.winCard}>
            <Image
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                source={require('../assets/images/logo.png')}
                style={styles.winCardLogo}
                resizeMode="contain"
            />
            <Text style={styles.winCardTitle}>🏆 Victoire !</Text>
            <Text style={styles.winCardPlayer}>{playerName}</Text>
            <Text style={styles.winCardDetail}>🐷 {cochons} cochon{cochons > 1 ? 's' : ''} infligé{cochons > 1 ? 's' : ''}</Text>
            <Text style={styles.winCardGrade}>🏅 {gradeLabel}</Text>
            <Text style={styles.winCardCta}>Vini joué épi mwen 👉</Text>
            <Text style={styles.winCardUrl}>{APP_URL}</Text>
        </View>
    );
}

// ── Carte palier à capturer ───────────────────────────────────────────────────

interface GradeShareCardProps {
    playerName: string;
    gradeLabel: string;
    gradeIcon: string;
    totalCochons: number;
    accentColor: string;
    compact?: boolean;
}

export function GradeShareCard({ playerName, gradeLabel, gradeIcon, totalCochons, accentColor, compact = false }: GradeShareCardProps) {
    return (
        <View style={[styles.card, compact && styles.cardCompact, { borderColor: accentColor }]}>
            <Text style={styles.cardAppName}>🎲 {APP_NAME}</Text>
            <Text style={styles.cardPlayerName}>{playerName}</Text>
            <Text style={styles.cardGradeIcon}>{gradeIcon}</Text>
            <Text style={[styles.cardGradeLabel, { color: accentColor }]}>{gradeLabel}</Text>
            <Text style={styles.cardCochons}>🐷 {totalCochons} cochons infligés</Text>
            <Text style={styles.cardUrl}>{APP_URL}</Text>
        </View>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    shareBtnWrapper: {
        alignItems: 'center',
    },
    offscreen: {
        position: 'absolute',
        top: -9999,
        left: -9999,
        opacity: 0,
    },
    shareBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FFD700',
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 20,
        alignSelf: 'center',
        marginTop: 10,
    },
    shareBtnText: {
        color: '#1A0E2E',
        fontWeight: '800',
        fontSize: 13,
    },
    winCard: {
        width: 320,
        backgroundColor: '#1A0E2E',
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#FFD700',
        padding: 24,
        alignItems: 'center',
        gap: 6,
    },
    winCardLogo: {
        width: 120,
        height: 80,
        marginBottom: 4,
    },
    winCardTitle: {
        color: '#FFD700',
        fontSize: 22,
        fontWeight: '900',
    },
    winCardPlayer: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '800',
    },
    winCardDetail: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 15,
        fontWeight: '600',
    },
    winCardGrade: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        fontWeight: '600',
    },
    winCardCta: {
        color: '#FFD700',
        fontSize: 13,
        fontWeight: '700',
        marginTop: 8,
    },
    winCardUrl: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 11,
    },
    card: {
        width: 300,
        backgroundColor: '#1A0E2E',
        borderRadius: 20,
        borderWidth: 2,
        padding: 24,
        alignItems: 'center',
        gap: 8,
    },
    cardCompact: {
        width: 220,
        padding: 16,
        gap: 4,
    },
    cardAppName: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 1,
    },
    cardPlayerName: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: '900',
    },
    cardGradeIcon: {
        fontSize: 48,
        marginVertical: 4,
    },
    cardGradeLabel: {
        fontSize: 18,
        fontWeight: '900',
        textAlign: 'center',
    },
    cardCochons: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        fontWeight: '600',
    },
    cardUrl: {
        color: 'rgba(255,255,255,0.35)',
        fontSize: 11,
        marginTop: 8,
    },
});
