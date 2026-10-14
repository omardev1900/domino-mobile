import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { isPremiumActive, PremiumEntitlement, premiumService } from '../src/core/services/premium.service';
import { LogService } from '../src/core/services/LogService';

const BENEFITS = [
    {
        icon: 'color-palette-outline' as const,
        title: 'Skin Spectre Premium',
        text: 'Un plateau et des dominos à valeurs colorées, exclusifs à Premium.',
    },
    {
        icon: 'fitness-outline' as const,
        title: 'Entraînement avancé',
        text: 'Niveaux, aides de jeu et défis pratiques pour progresser à ton rythme.',
    },
    {
        icon: 'bulb-outline' as const,
        title: 'Stratégie',
        text: 'Leçons et exercices pour mieux lire le jeu et préparer tes coups.',
    },
];

const formatDate = (date: Date): string =>
    new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);

const friendlyError = (error: unknown): string => {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('already')) return 'Ce code a déjà été utilisé.';
    if (message.includes('invalid') || message.includes('not-found')) return 'Ce code est invalide ou désactivé.';
    if (message.includes('failed-precondition')) return 'Cette action n’est plus disponible pour ce compte.';
    return 'Une erreur est survenue. Vérifie ta connexion puis réessaie.';
};

export default function PremiumScreen() {
    const router = useRouter();
    const [entitlement, setEntitlement] = useState<PremiumEntitlement | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [processing, setProcessing] = useState<'trial' | 'code' | null>(null);
    const [code, setCode] = useState('');

    const refresh = useCallback(async () => {
        setLoading(true);
        const [nextEntitlement, nextIsAdmin] = await Promise.all([
            premiumService.getEntitlement(),
            premiumService.isCurrentUserAdmin(),
        ]);
        setEntitlement(nextEntitlement);
        setIsAdmin(nextIsAdmin);
        setLoading(false);
    }, []);

    useFocusEffect(useCallback(() => {
        void refresh();
    }, [refresh]));

    const showMessage = (title: string, message: string) => Alert.alert(title, message);

    const handleTrial = async () => {
        setProcessing('trial');
        try {
            const result = await premiumService.activateTrial();
            setEntitlement(await premiumService.getEntitlement());
            showMessage('Essai Premium activé', `Ton accès gratuit est actif jusqu’au ${formatDate(new Date(result.expiresAt))}.`);
        } catch (error) {
            LogService.warn('Premium', 'Activation de l’essai refusée.', error);
            showMessage('Essai indisponible', friendlyError(error));
        } finally {
            setProcessing(null);
        }
    };

    const handleCode = async () => {
        if (!code.trim()) {
            showMessage('Code requis', 'Saisis ton code Premium.');
            return;
        }
        setProcessing('code');
        try {
            const result = await premiumService.redeemCode(code);
            setCode('');
            setEntitlement(await premiumService.getEntitlement());
            showMessage('Premium activé', `Ton accès est actif jusqu’au ${formatDate(new Date(result.expiresAt))}.`);
        } catch (error) {
            LogService.warn('Premium', 'Code Premium refusé.', error);
            showMessage('Code refusé', friendlyError(error));
        } finally {
            setProcessing(null);
        }
    };

    const premiumActive = isPremiumActive(entitlement);

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient colors={['#2D1B4E', '#15102A']} style={StyleSheet.absoluteFillObject} />
            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                    <View style={styles.topBar}>
                        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Retour">
                            <Ionicons name="arrow-back" size={23} color="#FFF" />
                        </TouchableOpacity>
                        <Text style={styles.topTitle}>PREMIUM</Text>
                        <View style={styles.backButton} />
                    </View>

                    <LinearGradient colors={['#F6C844', '#D88618']} style={styles.hero}>
                        <Ionicons name="star" size={42} color="#2A1648" />
                        <Text style={styles.heroTitle}>Passe à Premium</Text>
                        <Text style={styles.heroText}>Plus de style, d’entraînement et de stratégie.</Text>
                    </LinearGradient>

                    {loading ? (
                        <ActivityIndicator style={styles.loader} color="#FFD700" />
                    ) : premiumActive ? (
                        <View style={styles.activeCard}>
                            <Ionicons name="checkmark-circle" size={28} color="#7EE081" />
                            <View style={styles.activeCopy}>
                                <Text style={styles.activeTitle}>Premium actif</Text>
                                <Text style={styles.activeText}>Valable jusqu’au {formatDate(entitlement!.expiresAt)}.</Text>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.trialCard}>
                            <Text style={styles.trialEyebrow}>DÉCOUVRE PREMIUM</Text>
                            <Text style={styles.trialTitle}>3 jours gratuits</Text>
                            <Text style={styles.trialText}>Sans carte bancaire. Un seul essai par compte.</Text>
                            <TouchableOpacity
                                style={[styles.primaryButton, processing !== null && styles.disabledButton]}
                                onPress={handleTrial}
                                disabled={processing !== null}
                            >
                                {processing === 'trial' ? <ActivityIndicator color="#24143F" /> : <Text style={styles.primaryButtonText}>ACTIVER L’ESSAI</Text>}
                            </TouchableOpacity>
                        </View>
                    )}

                    <View style={styles.benefits}>
                        {BENEFITS.map(benefit => (
                            <View key={benefit.title} style={styles.benefit}>
                                <View style={styles.benefitIcon}><Ionicons name={benefit.icon} size={23} color="#FFD700" /></View>
                                <View style={styles.benefitCopy}>
                                    <Text style={styles.benefitTitle}>{benefit.title}</Text>
                                    <Text style={styles.benefitText}>{benefit.text}</Text>
                                </View>
                            </View>
                        ))}
                    </View>

                    <View style={styles.codeCard}>
                        <Text style={styles.codeTitle}>Tu as un code Premium ?</Text>
                        <Text style={styles.codeText}>Entre-le ici pour activer ton mois offert.</Text>
                        <View style={styles.codeRow}>
                            <TextInput
                                value={code}
                                onChangeText={setCode}
                                placeholder="DM-XXXX-XXXX-XXXX"
                                placeholderTextColor="rgba(255,255,255,0.42)"
                                autoCapitalize="characters"
                                autoCorrect={false}
                                style={styles.codeInput}
                                editable={processing === null}
                            />
                            <TouchableOpacity style={[styles.codeButton, processing !== null && styles.disabledButton]} onPress={handleCode} disabled={processing !== null}>
                                {processing === 'code' ? <ActivityIndicator color="#24143F" size="small" /> : <Text style={styles.codeButtonText}>OK</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>

                    <Text style={styles.notice}>Les abonnements mensuel et annuel arriveront dans une prochaine mise à jour.</Text>
                    {isAdmin && (
                        <TouchableOpacity onPress={() => router.push('/premium-codes' as never)}>
                            <Text style={styles.adminLink}>Gérer les codes Premium</Text>
                        </TouchableOpacity>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1A0E2E' },
    flex: { flex: 1 },
    content: { padding: 18, paddingBottom: 34, gap: 16 },
    topBar: { height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    backButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
    topTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1.2 },
    hero: { alignItems: 'center', borderRadius: 24, padding: 24, gap: 8 },
    heroTitle: { color: '#261543', fontSize: 27, fontWeight: '900' },
    heroText: { color: 'rgba(38,21,67,0.84)', fontSize: 14, fontWeight: '700', textAlign: 'center' },
    loader: { marginVertical: 28 },
    activeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 18, backgroundColor: 'rgba(81,168,92,0.18)', borderWidth: 1, borderColor: 'rgba(126,224,129,0.55)' },
    activeCopy: { flex: 1 },
    activeTitle: { color: '#7EE081', fontSize: 17, fontWeight: '900' },
    activeText: { marginTop: 3, color: '#FFF', fontSize: 13 },
    trialCard: { alignItems: 'center', padding: 20, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.38)' },
    trialEyebrow: { color: '#FFD700', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
    trialTitle: { marginTop: 5, color: '#FFF', fontSize: 24, fontWeight: '900' },
    trialText: { marginTop: 6, color: 'rgba(255,255,255,0.72)', fontSize: 13, textAlign: 'center' },
    primaryButton: { marginTop: 17, minWidth: 220, minHeight: 47, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#FFD700' },
    primaryButtonText: { color: '#24143F', fontSize: 13, fontWeight: '900' },
    disabledButton: { opacity: 0.58 },
    benefits: { gap: 10 },
    benefit: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.07)' },
    benefitIcon: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: 'rgba(255,215,0,0.13)' },
    benefitCopy: { flex: 1 },
    benefitTitle: { color: '#FFF', fontSize: 15, fontWeight: '900' },
    benefitText: { marginTop: 2, color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 17 },
    codeCard: { padding: 17, borderRadius: 18, backgroundColor: 'rgba(63,41,95,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
    codeTitle: { color: '#FFF', fontSize: 16, fontWeight: '900' },
    codeText: { marginTop: 3, color: 'rgba(255,255,255,0.7)', fontSize: 12 },
    codeRow: { flexDirection: 'row', gap: 8, marginTop: 13 },
    codeInput: { flex: 1, minHeight: 45, paddingHorizontal: 12, borderRadius: 12, color: '#FFF', fontSize: 13, fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.23)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
    codeButton: { width: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#FFD700' },
    codeButtonText: { color: '#24143F', fontSize: 13, fontWeight: '900' },
    notice: { color: 'rgba(255,255,255,0.5)', fontSize: 11, lineHeight: 16, textAlign: 'center' },
    adminLink: { color: '#FFD700', fontSize: 12, fontWeight: '800', textAlign: 'center', textDecorationLine: 'underline' },
});
