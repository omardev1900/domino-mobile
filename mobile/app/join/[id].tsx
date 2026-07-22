import React, { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, ActivityIndicator } from 'react-native';

export default function JoinRoute() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();

    useEffect(() => {
        if (!id) return;
        
        // Rediriger vers le lobby avec l'intention de rejoindre la table
        // Le composant lobby gèrera l'authentification et l'insertion du code
        router.replace({ pathname: '/lobby', params: { autoJoinRoomId: id } });
    }, [id, router]);

    return (
        <View style={{ flex: 1, backgroundColor: '#1A0E2E', justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#FFD700" />
            <Text style={{ color: '#FFF', marginTop: 20 }}>Ouverture de la table {id}...</Text>
        </View>
    );
}
