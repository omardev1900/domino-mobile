import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { AppState, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { authService } from '../core/services/auth.service';
import { isPremiumActive, premiumService } from '../core/services/premium.service';
import { storeService } from '../core/services/store.service';

const expirationNoticeKey = (userId: string, expiresAt: Date) =>
    `@premium_expiration_notice:${userId}:${expiresAt.getTime()}`;

/** Displays the end-of-trial notice once and routes directly to code activation. */
export function PremiumExpiryModal() {
    const router = useRouter();
    const [visible, setVisible] = useState(false);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        let active = true;

        const checkExpiration = async () => {
            try {
                const user = await authService.getCurrentUser();
                if (!user || user.uid.startsWith('guest_')) return;

                const entitlement = await premiumService.getEntitlement(user.uid);
                if (!entitlement || isPremiumActive(entitlement)) return;

                await storeService.removeExpiredPremiumEquipment(user.uid);
                if (entitlement.source !== 'TRIAL') return;

                const key = expirationNoticeKey(user.uid, entitlement.expiresAt);
                if (await AsyncStorage.getItem(key)) return;

                await AsyncStorage.setItem(key, 'shown');
                if (active) setVisible(true);
            } finally {
                if (active) setChecking(false);
            }
        };

        void checkExpiration();
        const subscription = AppState.addEventListener('change', state => {
            if (state === 'active') void checkExpiration();
        });
        return () => {
            active = false;
            subscription.remove();
        };
    }, []);

    if (checking) return null;

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={() => setVisible(false)}>
            <View style={styles.overlay}>
                <View style={styles.card}>
                    <View style={styles.icon}><Ionicons name="time-outline" size={32} color="#FFD700" /></View>
                    <Text style={styles.title}>Ton essai Premium est terminé</Text>
                    <Text style={styles.text}>
                        Tes avantages Premium, skins et avatars exclusifs ne sont plus disponibles.
                    </Text>
                    <Text style={styles.question}>Tu as un code Premium ?</Text>
                    <View style={styles.actions}>
                        <TouchableOpacity style={styles.secondaryButton} onPress={() => setVisible(false)}>
                            <Text style={styles.secondaryText}>PLUS TARD</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={() => {
                                setVisible(false);
                                router.push('/premium?openCode=true' as never);
                            }}
                        >
                            <Text style={styles.primaryText}>J’AI UN CODE</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(6, 3, 14, 0.76)' },
    card: { width: '100%', maxWidth: 380, padding: 24, borderRadius: 24, alignItems: 'center', backgroundColor: '#271641', borderWidth: 1, borderColor: 'rgba(255, 215, 0, 0.46)' },
    icon: { width: 64, height: 64, marginBottom: 14, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,215,0,0.12)' },
    title: { color: '#FFF', fontSize: 21, fontWeight: '900', textAlign: 'center' },
    text: { marginTop: 12, color: 'rgba(255,255,255,0.78)', fontSize: 14, lineHeight: 20, textAlign: 'center' },
    question: { marginTop: 18, color: '#FFD700', fontSize: 15, fontWeight: '900', textAlign: 'center' },
    actions: { width: '100%', marginTop: 22, flexDirection: 'row', gap: 10 },
    secondaryButton: { flex: 1, minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.26)' },
    secondaryText: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '900' },
    primaryButton: { flex: 1.2, minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFD700' },
    primaryText: { color: '#251640', fontSize: 11, fontWeight: '900' },
});
