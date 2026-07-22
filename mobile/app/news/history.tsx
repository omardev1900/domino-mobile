import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    Text,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Platform,
    Image,
    Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { NewsService, NewsItem } from '../../src/core/services/news.service';

export default function NewsHistoryScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        const fetchAll = async () => {
            setLoading(true);
            try {
                const data = await NewsService.getAllNews();
                setNews(data);
            } catch (error) {
                console.error('Error fetching history:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, []);

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#2D1B4E', '#1A0E2E']}
                style={StyleSheet.absoluteFill}
            />

            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity 
                    onPress={() => router.back()}
                    className="p-2 bg-white/10 rounded-full"
                >
                    <Ionicons name="close" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>HISTORIQUE DES ACTUALITÉS</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#FFD700" />
                    <Text style={styles.loadingText}>Récupération des news...</Text>
                </View>
            ) : news.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="newspaper-outline" size={60} color="rgba(255,255,255,0.1)" />
                    <Text style={styles.emptyText}>Aucune actualité pour le moment.</Text>
                </View>
            ) : (
                <ScrollView 
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
                    showsVerticalScrollIndicator={false}
                >
                    {news.map((item, index) => (
                        <Animated.View 
                            key={item.id}
                            entering={FadeInUp.delay(index * 100).duration(500)}
                            style={styles.newsCard}
                        >
                            <TouchableOpacity 
                                activeOpacity={0.9}
                                onPress={() => toggleExpand(item.id)}
                            >
                                <LinearGradient
                                    colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                                    style={styles.cardGradient}
                                >
                                    {item.imageUrl && (
                                        <View style={styles.imageContainer}>
                                            <Image 
                                                source={{ uri: item.imageUrl }} 
                                                style={styles.cardImage}
                                                resizeMode="cover"
                                            />
                                        </View>
                                    )}
                                    <View style={styles.cardHeader}>
                                        <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
                                        {item.priority > 0 && (
                                            <View style={styles.pinnedBadge}>
                                                <Ionicons name="pin" size={10} color="#000" />
                                                <Text style={styles.pinnedText}>IMPORTANT</Text>
                                            </View>
                                        )}
                                    </View>

                                    <Text style={styles.titleText}>{item.title}</Text>
                                    
                                    <Text style={styles.contentText}>
                                        {expandedId === item.id && item.fullText ? item.fullText : item.content}
                                    </Text>

                                    {item.fullText && (
                                        <View style={styles.expandRow}>
                                            <Text style={styles.expandText}>
                                                {expandedId === item.id ? "Réduire" : "Lire la suite"}
                                            </Text>
                                            <Ionicons 
                                                name={expandedId === item.id ? "chevron-up" : "chevron-down"} 
                                                size={16} 
                                                color="#42A5F5" 
                                            />
                                        </View>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </Animated.View>
                    ))}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1A0E2E',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 2,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: 'rgba(255,255,255,0.5)',
        marginTop: 15,
        fontSize: 14,
    },
    scrollContent: {
        padding: 20,
        gap: 16,
    },
    newsCard: {
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.15)',
    },
    cardGradient: {
        padding: 20,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    dateText: {
        color: '#FFD700',
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        opacity: 0.8,
    },
    pinnedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFD700',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        gap: 3,
    },
    pinnedText: {
        color: '#000',
        fontSize: 9,
        fontWeight: '900',
    },
    titleText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 10,
    },
    contentText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        lineHeight: 22,
    },
    expandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 15,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
        paddingTop: 10,
    },
    expandText: {
        color: '#42A5F5',
        fontSize: 13,
        fontWeight: '700',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 16,
        textAlign: 'center',
        marginTop: 20,
    },
    imageContainer: {
        width: '100%',
        height: 150,
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 15,
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    cardImage: {
        width: '100%',
        height: '100%',
    }
});
