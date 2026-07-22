import { useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import GameScreen from '../../src/screens/GameScreen';
import { authService } from '../../src/core/services/auth.service';

export default function GameRoute() {
    const params = useLocalSearchParams<{
        id: string;
        userId: string;
        authUid?: string;
        mode?: string;
        difficulty?: string;
        gameMode?: string;
        winningCondition?: string;
        turnDuration?: string;
        startingHandSize?: string;
        tableTier?: string; // 🪙 Table tier pour le calcul du buy-in et des rewards
    }>();

    const [resolvedUserId, setResolvedUserId] = useState<string | null>(params.userId ?? null);
    const [isResolvingUserId, setIsResolvingUserId] = useState(!params.userId);

    useEffect(() => {
        let cancelled = false;

        const resolveUserId = async () => {
            if (params.userId) {
                setResolvedUserId(params.userId);
                setIsResolvingUserId(false);
                return;
            }

            try {
                const currentUser = await authService.getCurrentUser();
                if (!cancelled) {
                    setResolvedUserId(currentUser?.uid ?? null);
                }
            } finally {
                if (!cancelled) {
                    setIsResolvingUserId(false);
                }
            }
        };

        resolveUserId().catch(() => {
            if (!cancelled) {
                setIsResolvingUserId(false);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [params.userId]);

    if (isResolvingUserId) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color="#FFD700" />
            </View>
        );
    }

    return (
        <GameScreen
            gameId={params.id}
            userId={resolvedUserId ?? undefined}
            authUid={params.authUid}
            mode={params.mode as 'solo' | 'multiplayer' | undefined}
            difficulty={params.difficulty as any}
            gameMode={params.gameMode as any}
            winningCondition={params.winningCondition ? Number(params.winningCondition) : undefined}
            turnDuration={params.turnDuration ? Number(params.turnDuration) : undefined}
            startingHandSize={params.startingHandSize ? Number(params.startingHandSize) : undefined}
            tableTier={params.tableTier}
        />
    );
}

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1A0E2E',
    },
});
