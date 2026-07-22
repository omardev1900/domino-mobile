import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { MatchRecord } from '../core/services/stats.service';
import { getAvatarImage, AvatarId } from '../core/avatars';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

interface MatchHistoryProps {
    history: MatchRecord[];
}

const MatchHistoryItem: React.FC<{ record: MatchRecord }> = ({ record }) => {
    const isWin = record.result === 'WIN';
    const isDraw = record.result === 'DRAW';
    const date = new Date(record.timestamp);
    const formattedDate = date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });

    const statusColor = isWin ? '#4CAF50' : (isDraw ? '#FF9800' : '#FF5252');
    const resultLabel = isWin ? 'VICTOIRE' : (isDraw ? 'CHIRÉ' : 'DÉFAITE');

    return (
        <BlurView intensity={20} tint="light" style={styles.recordItem}>
            <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />

            <View style={styles.recordMain}>
                <View style={styles.recordHeader}>
                    <Text style={[styles.resultText, { color: statusColor }]}>
                        {resultLabel}
                    </Text>
                    <Text style={styles.dateText}>{formattedDate}</Text>
                </View>

                <View style={styles.matchDetails}>
                    <View style={styles.opponentsGroup}>
                        {record.opponents.map((opp, idx) => (
                            <View key={idx} style={[styles.miniAvatar, { marginLeft: idx > 0 ? -10 : 0 }]}>
                                <Image
                                    source={getAvatarImage(opp.avatarId as AvatarId)}
                                    style={styles.miniAvatarImg}
                                    contentFit="cover"
                                    cachePolicy="memory-disk"
                                />
                            </View>
                        ))}
                        <Text style={styles.opponentsText} numberOfLines={1}>
                            vs {record.opponents.map(o => o.name).join(', ')}
                        </Text>
                    </View>

                    <View style={styles.statsGroup}>
                        <View style={styles.statMini}>
                            <Ionicons name="trophy-outline" size={12} color="#FFD700" />
                            <Text style={styles.statMiniText}>{record.score} pts</Text>
                        </View>
                        {record.cochons > 0 && (
                            <View style={[styles.statMini, { marginLeft: 8 }]}>
                                <Text style={{ fontSize: 10 }}>🐷</Text>
                                <Text style={styles.statMiniText}>{record.cochons}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>
        </BlurView>
    );
};

export const MatchHistory: React.FC<MatchHistoryProps> = ({ history }) => {
    if (history.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Ionicons name="time-outline" size={48} color="rgba(255,255,255,0.3)" />
                <Text style={styles.emptyText}>Aucun match récent</Text>
            </View>
        );
    }

    return (
        <FlatList
            data={history}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <MatchHistoryItem record={item} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
        />
    );
};

const styles = StyleSheet.create({
    listContent: {
        paddingVertical: 10,
    },
    recordItem: {
        flexDirection: 'row',
        borderRadius: 12,
        marginBottom: 10,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    statusIndicator: {
        width: 4,
        height: '100%',
    },
    recordMain: {
        flex: 1,
        padding: 12,
    },
    recordHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    resultText: {
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1,
    },
    dateText: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.5)',
        fontWeight: '600',
    },
    matchDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    opponentsGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    miniAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#1a1a1a',
        overflow: 'hidden',
        backgroundColor: '#333',
    },
    miniAvatarImg: {
        width: '100%',
        height: '100%',
    },
    opponentsText: {
        color: '#fff',
        fontSize: 12,
        marginLeft: 8,
        fontWeight: '500',
        opacity: 0.9,
    },
    statsGroup: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statMini: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    statMiniText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
        marginLeft: 4,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        color: 'rgba(255,255,255,0.4)',
        marginTop: 12,
        fontSize: 14,
        fontWeight: '600',
    }
});
