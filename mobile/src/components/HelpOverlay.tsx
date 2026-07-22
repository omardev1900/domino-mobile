import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    useWindowDimensions,
    ScrollView,
    Modal,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, ZoomIn, SlideInDown, useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { LeagueInfoContent } from './LeagueInfoContent';

interface HelpOverlayProps {
    visible: boolean;
    onClose: () => void;
}

type TabType = 'REGLES' | 'RECOMPENSES' | 'LIGUE' | 'DON';

export const HelpOverlay: React.FC<HelpOverlayProps> = ({ visible, onClose }) => {
    const { width, height } = useWindowDimensions();
    const isLandscape = width > height;
    const [activeTab, setActiveTab] = useState<TabType>('REGLES');

    // Animations
    const opacityValue = useSharedValue(0);
    const scaleValue = useSharedValue(0.9);

    useEffect(() => {
        if (visible) {
            opacityValue.value = withTiming(1, { duration: 300 });
            scaleValue.value = withSpring(1);
        } else {
            opacityValue.value = 0;
            scaleValue.value = 0.9;
        }
    }, [visible]);

    const animatedBackdropStyle = useAnimatedStyle(() => ({
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.8)',
        opacity: opacityValue.value
    }));

    const animatedContentStyle = useAnimatedStyle(() => ({
        opacity: opacityValue.value,
        transform: [{ scale: scaleValue.value }]
    }));

    if (!visible) return null;

    const renderTabButton = (type: TabType, label: string, icon: string) => (
        <TouchableOpacity
            style={[styles.tabButton, activeTab === type && styles.tabButtonActive]}
            onPress={() => setActiveTab(type)}
            activeOpacity={0.7}
        >
            <Text style={[styles.tabIcon, activeTab === type && styles.tabIconActive]}>{icon}</Text>
            <Text style={[styles.tabText, activeTab === type && styles.tabTextActive]}>{label}</Text>
        </TouchableOpacity>
    );

    const renderRegles = () => (
        <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
            <Section title="Le But du Jeu" icon="🎯">
                <Text style={styles.para}>Le domino martiniquais se joue à <Text style={styles.bold}>3 joueurs</Text> avec un jeu de double-six (28 dominos).</Text>
                <Text style={styles.para}>Chaque joueur reçoit <Text style={styles.bold}>7 dominos</Text>. Les 7 restants sont mis à l'écart (le "talon") et ne sont pas utilisés.</Text>
                <Text style={styles.para}>Le but est d'être le premier à vider sa main.</Text>
            </Section>

            <Section title="La Pose" icon="🧩">
                <Text style={styles.para}>On pose un domino correspondant à l'une des deux extrémités libres du plateau.</Text>
                <Text style={styles.para}>Si vous ne pouvez pas jouer, vous <Text style={styles.bold}>"boudez"</Text> (passez votre tour).</Text>
            </Section>

            <Section title="Déterminer le départ" icon="🏁">
                <Text style={styles.para}>Le joueur avec le <Text style={styles.bold}>plus gros double</Text> commence la première manche (6-6, puis 5-5...).</Text>
                <Text style={styles.para}>Pour les manches suivantes, c'est le <Text style={styles.bold}>vainqueur précédent</Text> qui commence avec le domino de son choix.</Text>
            </Section>

            <Section title="Partie Bloquée" icon="🛑">
                <Text style={styles.para}>Si plus personne ne peut jouer, la partie est bloquée. Le joueur ayant le <Text style={styles.bold}>moins de points</Text> en main remporte la manche.</Text>
                <Text style={styles.para}>En cas d'égalité parfaite, la manche est nulle.</Text>
            </Section>
            <Section title="Parties & Modes" icon="🎮">
                <Text style={styles.para}><Text style={styles.bold}>Mode Manche :</Text> Le match se termine quand un joueur atteint un nombre défini de manches gagnées.</Text>
                <Text style={styles.para}><Text style={styles.bold}>Mode Score :</Text> On cumule les points de victoire à chaque manche jusqu'à atteindre le score cible.</Text>
                <Text style={styles.para}><Text style={styles.bold}>Mode Cochon :</Text> Le match se termine quand le quota de cochons défini est atteint. Pour infliger un cochon, il faut gagner une manche en laissant au moins un adversaire à 0 victoire.</Text>
            </Section>

            <Section title="Le Cochon 🐷" icon="🐽">
                <Text style={styles.para}>Un joueur est <Text style={styles.bold}>"Cochon"</Text> s'il termine une manche avec <Text style={styles.bold}>0 étoile</Text>. Si deux joueurs sont à 0, c'est un <Text style={styles.bold}>Double Cochon</Text>.</Text>
                <Text style={styles.para}><Text style={styles.bold}>Bonus :</Text> Donner un cochon rapporte <Text style={styles.bold}>+1 point par cochon infligé</Text>. Donner un Double Cochon rapporte donc +2 points (soit 5 points au total pour la manche).</Text>
                <Text style={styles.para}><Text style={styles.bold}>Malus :</Text> Recevoir un cochon coûte <Text style={styles.bold}>-1 point</Text>.</Text>
                <Text style={styles.para}><Text style={styles.bold}>Le Chiré :</Text> Si tous les joueurs ont au moins 1 étoile (ex: 1-1-1), la manche est nulle. Aucun cochon n'est distribué.</Text>
            </Section>
        </ScrollView>
    );

    const renderRecompenses = () => (
        <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
            <Section title="Les Pièces (Coins)" icon="🪙">
                <Text style={styles.para}>C'est votre argent de jeu. Utilisez-le pour payer le <Text style={styles.bold}>Buy-in</Text> des tables Multijoueurs.</Text>
                <Text style={styles.para}>Gagnez-en en remportant des matchs ou dans les coffres de niveau.</Text>
            </Section>

            <Section title="L'Expérience (XP)" icon="⭐">
                <Text style={styles.para}>Chaque action et chaque victoire vous rapporte de l'XP.</Text>
                <Text style={styles.para}>L'XP vous fait monter de <Text style={styles.bold}>Niveau</Text>. Plus votre niveau est haut, plus vous avez de bonus sur vos futurs gains !</Text>
            </Section>

            <Section title="Les Diamants" icon="💎">
                <Text style={styles.para}>Monnaie rare obtenue lors de victoires prestigieuses (Double Cochon) ou lors de passages de certains niveaux.</Text>
            </Section>

            <Section title="Les Coffres de Niveau" icon="📦">
                <Text style={styles.para}>À chaque passage de niveau, vous recevez un coffre contenant des récompenses aléatoires ou fixes.</Text>
            </Section>
            <Section title="La Ligue des Cochons" icon="🏆">
                <Text style={styles.para}>Gagnez des points de ligue <Text style={styles.bold}>en infligeant des cochons</Text>.</Text>
                <View style={styles.gradeRow}>
                    <Text style={styles.gradeBadge}>🥉</Text>
                    <View>
                        <Text style={styles.gradeTitle}>APPRENTI</Text>
                        <Text style={styles.gradeDesc}>Le début du voyage.</Text>
                    </View>
                </View>
                <View style={styles.gradeRow}>
                    <Text style={styles.gradeBadge}>🥈</Text>
                    <View>
                        <Text style={styles.gradeTitle}>MAÎTRE</Text>
                        <Text style={styles.gradeDesc}>Vous commencez à bousculer la table.</Text>
                    </View>
                </View>
                <View style={styles.gradeRow}>
                    <Text style={styles.gradeBadge}>🥇</Text>
                    <View>
                        <Text style={styles.gradeTitle}>ROI</Text>
                        <Text style={styles.gradeDesc}>Seuls les meilleurs atteignent ce trône.</Text>
                    </View>
                </View>
                <View style={styles.gradeRow}>
                    <Text style={styles.gradeBadge}>💎</Text>
                    <View>
                        <Text style={styles.gradeTitle}>LÉGENDE</Text>
                        <Text style={styles.gradeDesc}>Votre nom est craint sur toutes les tables.</Text>
                    </View>
                </View>
            </Section>
        </ScrollView>
    );
    const renderLigue = () => (
        <View style={styles.tabContentFull}>
            <LeagueInfoContent />
        </View>
    );

    const renderDon = () => (
        <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
            <Section title="Soutenir le Domino Martiniquais" icon="🤝">
                <Text style={styles.para}>
                    Bonjour à tous et bienvenue !{"\n"}
                    Je suis Manuel Voitier, Martiniquais passionné et créateur de ce jeu. J'ai développé cette application avec un objectif de cœur : mettre à l'honneur notre tradition locale, le célèbre "Domino Cochon".
                </Text>
            </Section>

            <Section title="1️⃣ Soutenir le Développement" icon="📱">
                <Text style={styles.para}>
                    Si vous appréciez l'application et que vous souhaitez m'aider à l'améliorer (nouvelles fonctionnalités, maintenance, mises à jour), vous pouvez me soutenir directement via ce lien :
                </Text>
                <Text style={[styles.para, styles.link]}>revolut.me/manuelvoitier</Text>
            </Section>

            <Section title="2️⃣ Soutenir l'Association (Défiscalisé)" icon="🏦">
                <Text style={styles.para}>
                    Au-delà de ce jeu numérique, je suis également le Président de l'association Martinique Domino Club (MDC). Notre but est de proposer des tournois physiques de grande ampleur et de faire rayonner le domino martiniquais.
                </Text>
                <Text style={styles.para}>
                    <Text style={styles.bold}>📄 Avantage Fiscal :</Text> Nous délivrons le reçu fiscal (CERFA) vous permettant de bénéficier d'une déduction de vos impôts. Vous pouvez effectuer votre don par virement bancaire :
                </Text>
                <Text style={styles.para}><Text style={styles.bold}>Bénéficiaire :</Text> Martinique Domino Club</Text>
                <Text style={styles.para}><Text style={styles.bold}>IBAN :</Text> FR76 1010 7003 8000 9340 7864 262</Text>
            </Section>

            <Section title="Contact & Remerciements" icon="💬">
                <Text style={styles.para}>
                    Nous vous remercions du fond du cœur pour votre soutien, qu'il s'agisse d'un don, de votre participation à nos tournois, ou simplement en partageant ce jeu autour de vous !
                </Text>
                <Text style={styles.para}>
                    <Text style={styles.bold}>📞 Contact (CERFA/Partenariats) :</Text> 0696 31 43 01
                </Text>
                <Text style={[styles.para, { marginTop: 10, fontStyle: 'italic' }]}>À la MDC, pour nous le domino est un sport ! 🏆</Text>
            </Section>
        </ScrollView>
    );

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
            <View style={styles.container}>
                <Animated.View style={animatedBackdropStyle}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
                </Animated.View>

                <Animated.View style={[
                    styles.content,
                    animatedContentStyle,
                    isLandscape ? styles.contentLandscape : styles.contentPortrait
                ]}>
                    <LinearGradient
                        colors={['#1A0E2E', '#2D1B4E']}
                        style={styles.gradient}
                    >
                        {/* Close Button (Floating) */}
                        <TouchableOpacity style={styles.floatingCloseButton} onPress={onClose}>
                            <Ionicons name="close-circle" size={32} color="#FFF" />
                        </TouchableOpacity>

                        {/* Tabs Navigation (Moved to Top) */}
                        <View style={styles.tabsWrapper}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
                                {renderTabButton('REGLES', 'Règles', '🎲')}
                                {renderTabButton('RECOMPENSES', 'Récompenses', '💰')}
                                {renderTabButton('LIGUE', 'Ligue', '🏆')}
                                {renderTabButton('DON', 'Soutenir MDC', '🤝')}
                            </ScrollView>
                        </View>

                        {/* Content Area */}
                        <View style={styles.body}>
                            {activeTab === 'REGLES' && renderRegles()}
                            {activeTab === 'RECOMPENSES' && renderRecompenses()}
                            {activeTab === 'LIGUE' && renderLigue()}
                            {activeTab === 'DON' && renderDon()}
                        </View>
                    </LinearGradient>
                </Animated.View>
            </View>
        </Modal>
    );
};

const Section = ({ title, icon, children }: { title: string, icon: string, children: React.ReactNode }) => (
    <View style={styles.section}>
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>{icon}</Text>
            <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <View style={styles.sectionBody}>
            {children}
        </View>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 215, 0, 0.4)',
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
    },
    contentPortrait: {
        width: '96%',
        height: '92%',
    },
    contentLandscape: {
        width: '94%',
        height: '92%',
    },
    gradient: {
        flex: 1,
    },
    floatingCloseButton: {
        position: 'absolute',
        top: 10,
        right: 15,
        zIndex: 100,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
        elevation: 5,
    },
    tabsWrapper: {
        paddingTop: 15,
        paddingBottom: 10,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,215,0,0.2)',
    },
    tabsScroll: {
        paddingHorizontal: 20,
        paddingRight: 60, // Space for close button
        gap: 12,
    },
    tabButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    tabButtonActive: {
        backgroundColor: 'rgba(255, 215, 0, 0.15)',
        borderColor: '#FFD700',
    },
    tabIcon: {
        fontSize: 16,
        marginRight: 8,
        opacity: 0.6,
    },
    tabIconActive: {
        opacity: 1,
    },
    tabText: {
        color: 'rgba(255,255,255,0.6)',
        fontWeight: 'bold',
        fontSize: 13,
    },
    tabTextActive: {
        color: '#FFD700',
    },
    body: {
        flex: 1,
        paddingHorizontal: 20,
    },
    tabContent: {
        paddingVertical: 20,
    },
    tabContentFull: {
        flex: 1,
        paddingVertical: 20,
    },
    section: {
        marginBottom: 25,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 16,
        padding: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 10,
    },
    sectionIcon: {
        fontSize: 22,
    },
    sectionTitle: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    sectionBody: {
        paddingLeft: 4,
    },
    para: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        lineHeight: 22,
        marginBottom: 10,
    },
    bold: {
        color: '#FFD700',
        fontWeight: 'bold',
    },
    gradeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
        gap: 15,
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 10,
        borderRadius: 12,
    },
    gradeBadge: {
        fontSize: 30,
    },
    gradeTitle: {
        color: '#FFD700',
        fontWeight: '900',
        fontSize: 14,
        letterSpacing: 1,
    },
    gradeDesc: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
    },
    link: {
        color: '#6BE5FF',
        fontWeight: 'bold',
        textDecorationLine: 'underline',
    },

});
