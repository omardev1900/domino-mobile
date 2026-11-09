import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { isPremiumActive, PremiumEntitlement, premiumService } from '../src/core/services/premium.service';
import { economyService } from '../src/core/services/economy.service';
import { authService } from '../src/core/services/auth.service';
import { LogService } from '../src/core/services/LogService';
import { perfMark, perfStart } from '../src/core/services/perf';
import { PremiumHomeFeatures } from '../src/components/PremiumHomeFeatures';
import { ReplayLibraryModal } from '../src/components/game/ReplayLibraryModal';
import { storeService } from '../src/core/services/store.service';
import { PremiumBenefitsCarousel } from '../src/components/PremiumBenefitsCarousel';
import { CampaignBlockContext } from '../src/core/campaigns/CampaignBlockContext';
import { useCampaign } from '../src/core/campaigns/useCampaign';
import { CampaignModal } from '../src/components/CampaignModal';

const CELEBRATION_PARTICLES = [
    { x: -118, y: -178, color: '#FFD700' },
    { x: -66, y: -202, color: '#F6C844' },
    { x: 0, y: -220, color: '#FFF3AA' },
    { x: 68, y: -202, color: '#FFB83D' },
    { x: 120, y: -178, color: '#FFD700' },
    { x: -150, y: -98, color: '#FFF3AA' },
    { x: 150, y: -98, color: '#F6C844' },
] as const;

const formatDate = (date: Date): string =>
    new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);

const friendlyError = (error: unknown): string => {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('already')) return 'Ce code a déjà été utilisé.';
    if (message.includes('invalid') || message.includes('not-found')) return 'Ce code est invalide ou désactivé.';
    if (message.includes('failed-precondition')) return 'Cette action n’est plus disponible pour ce compte.';
    return 'Une erreur est survenue. Vérifie ta connexion puis réessaie.';
};

function PremiumCelebration({ expiresAt, bonusCoins = 0, isRenewal = false, onComplete }: { expiresAt: Date; bonusCoins?: number; isRenewal?: boolean; onComplete: () => void }) {
    const progress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        progress.setValue(0);
        const animation = Animated.timing(progress, { toValue: 1, duration: 1800, useNativeDriver: true });
        animation.start();
        const timeout = setTimeout(onComplete, 2100);
        return () => {
            animation.stop();
            clearTimeout(timeout);
        };
    }, [onComplete, progress]);

    const panelOpacity = progress.interpolate({ inputRange: [0, 0.12, 0.82, 1], outputRange: [0, 1, 1, 0] });
    const panelScale = progress.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0.78, 1, 1.06] });

    return (
        <Modal transparent animationType="none" onRequestClose={onComplete}>
            <View style={styles.celebrationOverlay} pointerEvents="none">
                <View style={styles.fireworkOrigin}>
                    {CELEBRATION_PARTICLES.map((particle, index) => (
                        <Animated.View
                            key={`${particle.x}-${particle.y}`}
                            style={[
                                styles.fireworkParticle,
                                { backgroundColor: particle.color, opacity: progress.interpolate({ inputRange: [0, 0.15, 0.76, 1], outputRange: [0, 1, 1, 0] }), transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, particle.x] }) }, { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, particle.y] }) }, { scale: progress.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0.2, 1, 0.65] }) }] },
                            ]}
                        />
                    ))}
                </View>
                <Animated.View style={[styles.celebrationCard, { opacity: panelOpacity, transform: [{ scale: panelScale }] }]}>
                    <Ionicons name="sparkles" size={46} color="#FFD700" />
                    <Text style={styles.celebrationTitle}>{isRenewal ? 'Premium renouvelé !' : 'Bienvenue Premium !'}</Text>
                    <Text style={styles.celebrationText}>Ton accès est actif jusqu’au {formatDate(expiresAt)}.</Text>
                    {bonusCoins > 0 && <Text style={styles.celebrationBonus}>+{bonusCoins.toLocaleString('fr-FR')} 🪙 coins Premium</Text>}
                </Animated.View>
            </View>
        </Modal>
    );
}

export default function PremiumScreen() {
    const router = useRouter();
    const { openCode } = useLocalSearchParams<{ openCode?: string }>();
    const { width } = useWindowDimensions();
    const cardWidth = Math.min(330, Math.max(245, width * 0.76));
    const [entitlement, setEntitlement] = useState<PremiumEntitlement | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [processing, setProcessing] = useState<'trial' | 'code' | 'portal' | null>(null);
    const [code, setCode] = useState('');
    const [showCodeModal, setShowCodeModal] = useState(false);
    const [showReplays, setShowReplays] = useState(false);
    const [showTrialConfirmation, setShowTrialConfirmation] = useState(false);
    const [celebration, setCelebration] = useState<{ expiresAt: Date; bonusCoins: number; isRenewal: boolean } | null>(null);
    const focusRunRef = useRef(0);
    const lastPaintedRunRef = useRef(0);

    const refresh = useCallback(async () => {
        const run = ++focusRunRef.current;
        const startedAt = perfStart();
        perfMark('premium.focus', { run });
        setLoading(true);
        setLoadError(false);
        // Le rôle admin ne conditionne pas l'affichage de la page Premium.
        void premiumService.isCurrentUserAdmin().then(value => {
            if (focusRunRef.current === run) setIsAdmin(value);
        }).catch(error => LogService.warn('Premium', 'Vérification administrateur impossible.', error));
        let nextEntitlement: PremiumEntitlement | null;
        try {
            nextEntitlement = await premiumService.getEntitlementForScreen();
        } catch (error) {
            if (focusRunRef.current !== run) return;
            LogService.warn('Premium', 'Chargement du statut Premium impossible.', error);
            setLoadError(true);
            setLoading(false);
            return;
        }
        if (focusRunRef.current !== run) return;
        setEntitlement(nextEntitlement);
        setLoading(false);
        perfMark('premium.dataReady', { run, ms: Date.now() - startedAt, hasEntitlement: Boolean(nextEntitlement) });
        // Équivalent de `store.framePresented` : jalon JS émis après le commit
        // qui affiche l'état Premium résolu, puis deux frames.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (lastPaintedRunRef.current === run) return;
                lastPaintedRunRef.current = run;
                perfMark('premium.firstPaint', { run, ms: Date.now() - startedAt });
            });
        });
    }, []);

    useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

    useEffect(() => {
        if (openCode === 'true') setShowCodeModal(true);
    }, [openCode]);

    const handleTrial = async () => {
        setProcessing('trial');
        try {
            const result = await premiumService.activateTrial();
            setEntitlement(await premiumService.getEntitlement());
            setCelebration({ expiresAt: new Date(result.expiresAt), bonusCoins: 0, isRenewal: false });
        } catch (error) {
            LogService.warn('Premium', 'Activation de l’essai refusée.', error);
            Alert.alert('Essai indisponible', friendlyError(error));
        } finally {
            setProcessing(null);
        }
    };

    const confirmTrial = () => setShowTrialConfirmation(true);

    const activateConfirmedTrial = () => {
        setShowTrialConfirmation(false);
        void handleTrial();
    };

    const manageSubscription = async () => {
        setProcessing('portal');
        try {
            await Linking.openURL(await premiumService.createCustomerPortal());
        } catch (error) {
            LogService.warn('Premium', 'Portail Stripe indisponible.', error);
            Alert.alert('Abonnement indisponible', 'Impossible d’ouvrir la gestion de ton abonnement. Réessaie dans quelques instants.');
        } finally {
            setProcessing(null);
        }
    };

    const handleCode = async () => {
        if (!code.trim()) {
            Alert.alert('Code requis', 'Saisis ton code Premium.');
            return;
        }
        setProcessing('code');
        try {
            const isRenewal = premiumActive;
            const result = await premiumService.redeemCode(code);
            setCode('');
            setShowCodeModal(false);
            // La Function est la source d'autorité et vient de confirmer l'activation.
            // Ne pas attendre une seconde lecture Firestore : sur réseau dégradé elle
            // peut arriver tardivement, laissant le joueur croire que rien ne s'est passé.
            setEntitlement(previous => ({
                source: 'PROMO_CODE',
                expiresAt: new Date(result.expiresAt),
                ...(previous?.trialUsedAt ? { trialUsedAt: previous.trialUsedAt } : {}),
            }));
            void premiumService.getEntitlement().then(serverEntitlement => {
                if (serverEntitlement) setEntitlement(serverEntitlement);
            });
            const currentUser = await authService.getCurrentUser();
            setCelebration({
                expiresAt: new Date(result.expiresAt),
                bonusCoins: result.bonusCoins ?? 0,
                isRenewal,
            });
            // Le rafraîchissement des coins est secondaire : le code a déjà été
            // consommé et l'accès Premium confirmé par la Function. Il ne doit
            // jamais transformer ce succès en erreur visible pour le joueur.
            if (currentUser?.uid) {
                void economyService.syncFromFirebase(currentUser.uid, { force: true }).catch(error => {
                    LogService.warn('Premium', 'Synchronisation des coins différée.', error);
                });
            }
        } catch (error) {
            LogService.warn('Premium', 'Code Premium refusé.', error);
            Alert.alert('Code refusé', friendlyError(error));
        } finally {
            setProcessing(null);
        }
    };

    const premiumActive = isPremiumActive(entitlement);
    const trialAlreadyUsed = Boolean(entitlement?.trialUsedAt);
    const globalCampaignBlock = useContext(CampaignBlockContext);
    const campaignEnabled = !loading && !loadError && !globalCampaignBlock && !showCodeModal && !showReplays && !showTrialConfirmation && !celebration && !processing;
    const { campaign, dismiss: dismissCampaign } = useCampaign('PREMIUM', campaignEnabled);

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient colors={['#2D1B4E', '#15102A']} style={StyleSheet.absoluteFillObject} />
            <View style={styles.topBar}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Retour"><Ionicons name="arrow-back" size={23} color="#FFF" /></TouchableOpacity>
                <View style={styles.titleBlock}>
                    <Text style={styles.topTitle}>PREMIUM</Text>
                    {!loading && !loadError && premiumActive && entitlement && <Text style={styles.statusText}>Actif jusqu’au {formatDate(entitlement.expiresAt)}</Text>}
                </View>
                <View style={styles.backButton} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {loading ? <View style={styles.loadingStatus}><ActivityIndicator color="#FFD700" /><Text style={styles.loadingText}>Chargement…</Text></View> : loadError ? <View style={styles.loadingStatus}><Text style={styles.loadingText}>Impossible de charger le statut Premium.</Text><TouchableOpacity accessibilityRole="button" onPress={() => { void refresh(); }} style={styles.trialButton}><Text style={styles.trialButtonText}>Réessayer</Text></TouchableOpacity></View> : <>
                {!premiumActive && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.offerRow}>
                    {!premiumActive && <LinearGradient colors={['#F6C844', '#D88618']} style={[styles.offerCard, { width: cardWidth }]}>
                        <Ionicons name="star" size={39} color="#2A1648" />
                        <View style={styles.offerCopy}>
                            <Text style={styles.offerEyebrow}>DOMINO MARTINIQUAIS</Text>
                            <Text style={styles.offerTitle}>Premium</Text>
                            <Text style={styles.offerText}>Plus de style, d’entraînement et de stratégie.</Text>
                        </View>
                    </LinearGradient>}
                    <PremiumBenefitsCarousel width={cardWidth} />

                    {trialAlreadyUsed && <View style={[styles.offerCard, styles.trialCard, { width: cardWidth }]}>
                        <View style={styles.offerCopy}><Text style={styles.trialEyebrow}>PREMIUM EXPIRÉ</Text><Text style={styles.trialTitle}>Un code ?</Text><Text style={styles.trialText}>Réactive Premium avec un code.</Text></View>
                        <TouchableOpacity style={[styles.trialButton, processing !== null && styles.disabled]} onPress={() => setShowCodeModal(true)} disabled={processing !== null}><Text style={styles.trialButtonText}>CODE</Text></TouchableOpacity>
                    </View>}

                </ScrollView>}

                {premiumActive && entitlement?.source === 'SUBSCRIPTION' && <TouchableOpacity style={[styles.subscriptionManage, processing === 'portal' && styles.disabled]} onPress={() => void manageSubscription()} disabled={processing !== null}>
                    {processing === 'portal' ? <ActivityIndicator color="#FFD700" /> : <><Ionicons name="card-outline" size={18} color="#FFD700" /><Text style={styles.subscriptionManageText}>Gérer mon abonnement</Text></>}
                </TouchableOpacity>}

                {premiumActive && <PremiumHomeFeatures active={premiumActive} onPremium={() => Alert.alert('Avantage Premium', 'Active Premium pour accéder à cette fonctionnalité.')} onReplays={() => setShowReplays(true)} onShop={() => router.push('/store?tab=PREMIUM' as never)} onWorkshop={() => {
                    void storeService.getInventory().then(inventory => router.push((inventory.ownedItems.includes('skin_premium_atelier') ? '/premium-workshop' : '/store?tab=WORKSHOP') as never)).catch(() => router.push('/store?tab=WORKSHOP' as never));
                }} onTraining={() => router.push('/training?tab=PRACTICE' as never)} />}

                {isAdmin && <TouchableOpacity onPress={() => router.push('/premium-codes' as never)}><Text style={styles.adminLink}>Gérer les codes Premium</Text></TouchableOpacity>}
                </>}
            </ScrollView>

            {!loading && !loadError && !premiumActive && !trialAlreadyUsed && <View style={styles.trialFooter}>
                <TouchableOpacity accessibilityRole="button" onPress={confirmTrial} disabled={processing !== null} style={[styles.freeTrialButton, processing !== null && styles.disabled]}>
                    {processing === 'trial' ? <ActivityIndicator color="#24143F" /> : <Text style={styles.trialButtonText}>Essayer Premium gratuitement</Text>}
                </TouchableOpacity>
            </View>}

            <ReplayLibraryModal visible={showReplays} onClose={() => setShowReplays(false)} />

            <Modal visible={showCodeModal} transparent animationType="fade" onRequestClose={() => setShowCodeModal(false)}>
                <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}><Text style={styles.modalTitle}>Activer un code</Text><TouchableOpacity onPress={() => setShowCodeModal(false)} disabled={processing === 'code'}><Ionicons name="close" size={23} color="#FFF" /></TouchableOpacity></View>
                        <Text style={styles.modalText}>Saisis le code Premium qui t’a été offert.</Text>
                        <TextInput value={code} onChangeText={setCode} placeholder="DM-XXXX-XXXX-XXXX" placeholderTextColor="rgba(255,255,255,0.42)" autoCapitalize="characters" autoCorrect={false} style={styles.codeInput} editable={processing === null} />
                        <TouchableOpacity style={[styles.activateButton, processing === 'code' && styles.disabled]} onPress={handleCode} disabled={processing === 'code'}>{processing === 'code' ? <ActivityIndicator color="#24143F" /> : <Text style={styles.activateButtonText}>ACTIVER</Text>}</TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
            <Modal visible={showTrialConfirmation} transparent animationType="fade" onRequestClose={() => setShowTrialConfirmation(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Ionicons name="sparkles" size={32} color="#FFD700" />
                        <Text style={styles.trialModalTitle}>Essayer Premium ?</Text>
                        <Text style={styles.modalText}>Active tes 3 jours gratuits. Aucun paiement ni carte bancaire ne sera demandé.</Text>
                        <View style={styles.trialModalActions}>
                            <TouchableOpacity style={styles.cancelTrialButton} onPress={() => setShowTrialConfirmation(false)}>
                                <Text style={styles.cancelTrialButtonText}>ANNULER</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.confirmTrialButton} onPress={activateConfirmedTrial}>
                                <Text style={styles.confirmTrialButtonText}>ACTIVER</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            <CampaignModal campaign={campaignEnabled ? campaign : null} onClose={dismissCampaign} />
            {celebration && <PremiumCelebration {...celebration} onComplete={() => setCelebration(null)} />}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1A0E2E' },
    subscriptionManage: { alignSelf: 'center', marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,215,0,0.55)' },
    subscriptionManageText: { color: '#FFD700', fontWeight: '800', fontSize: 13 },
    topBar: { height: 50, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    backButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
    topTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1.2 },
    titleBlock: { alignItems: 'center' },
    content: { padding: 18, paddingBottom: 34, gap: 16 },
    loadingStatus: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
    loadingText: { color: '#fff', fontSize: 14, textAlign: 'center' },
    statusText: { color: '#AEE9BB', fontSize: 13, fontWeight: '700' },
    offerRow: { gap: 12, paddingRight: 18 },
    offerCard: { height: 132, flexDirection: 'row', alignItems: 'center', borderRadius: 20, padding: 18, gap: 13 },
    offerCopy: { flex: 1 },
    offerEyebrow: { color: 'rgba(42,22,72,0.72)', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
    offerTitle: { color: '#2A1648', fontSize: 26, fontWeight: '900' },
    offerText: { color: 'rgba(42,22,72,0.82)', fontSize: 12, lineHeight: 17, fontWeight: '700' },
    trialCard: { backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.4)' },
    trialEyebrow: { color: '#FFD700', fontSize: 10, fontWeight: '900', letterSpacing: 0.9 },
    trialTitle: { marginTop: 4, color: '#FFF', fontSize: 22, fontWeight: '900' },
    trialText: { marginTop: 3, color: 'rgba(255,255,255,0.7)', fontSize: 12 },
    trialButton: { minWidth: 82, minHeight: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFD700' },
    trialFooter: { alignItems: 'center', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 14 },
    freeTrialButton: { minHeight: 48, paddingHorizontal: 20, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFD700' },
    trialButtonText: { color: '#24143F', fontSize: 12, fontWeight: '900' },
    disabled: { opacity: 0.58 },
    notice: { color: 'rgba(255,255,255,0.5)', fontSize: 11, lineHeight: 16, textAlign: 'center' },
    adminLink: { color: '#FFD700', fontSize: 12, fontWeight: '800', textAlign: 'center', textDecorationLine: 'underline' },
    modalOverlay: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: 'rgba(0,0,0,0.68)' },
    modalCard: { padding: 20, borderRadius: 21, backgroundColor: '#2D1B4E', borderWidth: 1, borderColor: 'rgba(255,215,0,0.45)' },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    modalTitle: { color: '#FFF', fontSize: 19, fontWeight: '900' },
    modalText: { marginTop: 10, color: 'rgba(255,255,255,0.72)', fontSize: 13 },
    codeInput: { marginTop: 15, minHeight: 46, paddingHorizontal: 13, borderRadius: 12, color: '#FFF', fontSize: 13, fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.24)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
    activateButton: { minHeight: 46, marginTop: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#FFD700' },
    activateButtonText: { color: '#24143F', fontSize: 13, fontWeight: '900' },
    trialModalTitle: { marginTop: 10, color: '#FFF', fontSize: 21, fontWeight: '900' },
    trialModalActions: { marginTop: 22, flexDirection: 'row', gap: 10 },
    cancelTrialButton: { flex: 1, minHeight: 45, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
    cancelTrialButtonText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
    confirmTrialButton: { flex: 1, minHeight: 45, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#FFD700' },
    confirmTrialButtonText: { color: '#24143F', fontSize: 12, fontWeight: '900' },
    celebrationOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(18, 8, 38, 0.86)' },
    fireworkOrigin: { position: 'absolute', top: '53%', left: '50%' },
    fireworkParticle: { position: 'absolute', width: 11, height: 11, marginLeft: -5.5, marginTop: -5.5, borderRadius: 6 },
    celebrationCard: { width: '82%', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 26, borderRadius: 24, backgroundColor: '#2D1B4E', borderWidth: 2, borderColor: '#FFD700' },
    celebrationTitle: { marginTop: 11, color: '#FFF', fontSize: 25, fontWeight: '900', textAlign: 'center' },
    celebrationText: { marginTop: 9, color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 20, textAlign: 'center' },
    celebrationBonus: { marginTop: 10, color: '#FFD700', fontSize: 18, fontWeight: '900', textAlign: 'center' },
});
