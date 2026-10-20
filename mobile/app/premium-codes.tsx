import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { premiumService } from '../src/core/services/premium.service';
import { LogService } from '../src/core/services/LogService';

const QUANTITIES = [1, 5, 10] as const;
const DURATIONS = [3, 7, 14, 30] as const;

const parseRedeemBy = (value: string): number | null => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!match) return null;
    const [, year, month, day] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 23, 59, 59, 999));
    return date.getUTCFullYear() === Number(year)
        && date.getUTCMonth() === Number(month) - 1
        && date.getUTCDate() === Number(day)
        ? date.getTime()
        : null;
};

export default function PremiumCodesScreen() {
    const router = useRouter();
    const [authorized, setAuthorized] = useState<boolean | null>(null);
    const [quantity, setQuantity] = useState<number>(1);
    const [durationDays, setDurationDays] = useState<3 | 7 | 14 | 30>(30);
    const [redeemBy, setRedeemBy] = useState('');
    const [creating, setCreating] = useState(false);
    const [codes, setCodes] = useState<string[]>([]);

    useFocusEffect(useCallback(() => {
        void premiumService.isCurrentUserAdmin().then(setAuthorized);
    }, []));

    const createCodes = async () => {
        const redeemByTimestamp = parseRedeemBy(redeemBy);
        if (!redeemByTimestamp || redeemByTimestamp <= Date.now()) {
            Alert.alert('Date requise', 'Saisis une date limite future au format AAAA-MM-JJ.');
            return;
        }
        setCreating(true);
        try {
            const result = await premiumService.createCodes(quantity, durationDays, redeemByTimestamp);
            setCodes(result.codes);
        } catch (error) {
            LogService.warn('Premium', 'Création de codes refusée.', error);
            Alert.alert('Création impossible', 'Vérifie tes droits administrateur et ta connexion.');
        } finally {
            setCreating(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient colors={['#2D1B4E', '#15102A']} style={StyleSheet.absoluteFillObject} />
            <View style={styles.header}>
                <TouchableOpacity style={styles.back} onPress={() => router.back()} accessibilityLabel="Retour">
                    <Ionicons name="arrow-back" size={23} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.title}>CODES PREMIUM</Text>
                <View style={styles.back} />
            </View>
            {authorized === null ? <ActivityIndicator style={styles.loader} color="#FFD700" /> : !authorized ? (
                <View style={styles.denied}>
                    <Ionicons name="lock-closed" size={34} color="#FFD700" />
                    <Text style={styles.deniedTitle}>Accès administrateur requis</Text>
                    <Text style={styles.deniedText}>Cet écran est réservé aux comptes d’administration.</Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.content}>
                    <Text style={styles.intro}>Crée des codes à usage unique pour les vendre ou les offrir. Ils ne sont affichés qu’une seule fois et doivent être activés avant leur date limite.</Text>
                    <Text style={styles.label}>Nombre de codes</Text>
                    <View style={styles.quantities}>
                        {QUANTITIES.map(value => (
                            <TouchableOpacity key={value} style={[styles.quantity, quantity === value && styles.quantitySelected]} onPress={() => setQuantity(value)}>
                                <Text style={[styles.quantityText, quantity === value && styles.quantityTextSelected]}>{value}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <Text style={styles.label}>Durée Premium</Text>
                    <View style={styles.durations}>
                        {DURATIONS.map(value => (
                            <TouchableOpacity key={value} style={[styles.duration, durationDays === value && styles.quantitySelected]} onPress={() => setDurationDays(value)}>
                                <Text style={[styles.durationText, durationDays === value && styles.quantityTextSelected]}>{value} j</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <Text style={styles.label}>Date limite d’activation</Text>
                    <TextInput
                        value={redeemBy}
                        onChangeText={setRedeemBy}
                        placeholder="AAAA-MM-JJ"
                        placeholderTextColor="rgba(255,255,255,0.42)"
                        autoCapitalize="none"
                        keyboardType="numbers-and-punctuation"
                        style={styles.dateInput}
                    />
                    <TouchableOpacity style={[styles.createButton, creating && styles.disabled]} disabled={creating} onPress={createCodes}>
                        {creating ? <ActivityIndicator color="#251640" /> : <Text style={styles.createText}>GÉNÉRER {quantity} CODE{quantity > 1 ? 'S' : ''} · {durationDays} J</Text>}
                    </TouchableOpacity>
                    {codes.length > 0 && (
                        <View style={styles.results}>
                            <Text style={styles.resultsTitle}>Codes créés — note-les maintenant</Text>
                            {codes.map(code => <Text key={code} selectable style={styles.code}>{code}</Text>)}
                        </View>
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1A0E2E' },
    header: { height: 58, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    back: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
    title: { color: '#FFF', fontSize: 15, fontWeight: '900', letterSpacing: 1 },
    loader: { marginTop: 42 },
    denied: { margin: 22, padding: 24, alignItems: 'center', gap: 10, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)' },
    deniedTitle: { color: '#FFF', fontSize: 18, fontWeight: '900' },
    deniedText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center' },
    content: { padding: 20, gap: 15 },
    intro: { color: 'rgba(255,255,255,0.8)', lineHeight: 21, fontSize: 14 },
    label: { marginTop: 6, color: '#FFD700', fontSize: 13, fontWeight: '900' },
    quantities: { flexDirection: 'row', gap: 10 },
    durations: { flexDirection: 'row', gap: 8 },
    quantity: { flex: 1, minHeight: 50, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
    quantitySelected: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
    quantityText: { color: '#FFF', fontSize: 17, fontWeight: '900' },
    quantityTextSelected: { color: '#251640' },
    duration: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
    durationText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
    dateInput: { minHeight: 48, borderRadius: 12, paddingHorizontal: 14, color: '#FFF', fontSize: 15, fontWeight: '700', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
    createButton: { minHeight: 50, marginTop: 5, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#FFD700' },
    createText: { color: '#251640', fontSize: 13, fontWeight: '900' },
    disabled: { opacity: 0.6 },
    results: { marginTop: 8, padding: 16, borderRadius: 16, backgroundColor: 'rgba(126,224,129,0.12)', borderWidth: 1, borderColor: 'rgba(126,224,129,0.4)', gap: 9 },
    resultsTitle: { color: '#7EE081', fontSize: 14, fontWeight: '900' },
    code: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 1.2, paddingVertical: 6 },
});
