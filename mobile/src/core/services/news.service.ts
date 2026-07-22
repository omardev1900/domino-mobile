import {
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    Timestamp
} from 'firebase/firestore';
import { db } from './firebase';

export interface NewsItem {
    id: string;
    title: string;
    content: string;
    fullText?: string;
    imageUrl?: string;
    createdAt: number;
    active: boolean;
    priority: number;
}

const NEWS_COLLECTION = 'news';

export const NewsService = {
    /**
     * Récupère les actualités à la une (pour le carousel de la home)
     */
    getFeaturedNews: async (count: number = 5): Promise<NewsItem[]> => {
        try {
            const q = query(
                collection(db, NEWS_COLLECTION),
                where('active', '==', true),
                orderBy('priority', 'desc'),
                orderBy('createdAt', 'desc'),
                limit(count)
            );

            const snapshot = await getDocs(q);
            return snapshot.docs.map(NewsService.mapDocToNews);
        } catch (error) {
            console.error('[NewsService] Error fetching featured news:', error);
            return [];
        }
    },

    /**
     * Récupère l'historique complet des news actives
     */
    getAllNews: async (): Promise<NewsItem[]> => {
        try {
            const q = query(
                collection(db, NEWS_COLLECTION),
                where('active', '==', true),
                orderBy('createdAt', 'desc')
            );

            const snapshot = await getDocs(q);
            return snapshot.docs.map(NewsService.mapDocToNews);
        } catch (error) {
            console.error('[NewsService] Error fetching all news:', error);
            return [];
        }
    },

    /**
     * Transforme un document Firestore en NewsItem
     */
    mapDocToNews: (doc: any): NewsItem => {
        const data = doc.data();
        return {
            id: doc.id,
            title: data.title || '',
            content: data.content || '',
            fullText: data.fullText || '',
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now(),
            active: data.active ?? true,
            priority: data.priority ?? 0,
            imageUrl: data.imageUrl,
        };
    }
};
