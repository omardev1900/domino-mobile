import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    StyleSheet,
    Text,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    ScrollView,
    useWindowDimensions,
    Platform,
} from "react-native";
import { useRouter, useNavigation, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
    FadeInUp,
    FadeInLeft,
    FadeIn,
} from "react-native-reanimated";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
    createRoom,
    joinRoom,
    listenToPublicRooms,
    findHostedWaitingRoom,
    findActiveRoomForUser,
    deleteWaitingRoomIfOwner,
    RoomOptions,
    auth,
} from "../src/core/services/firebase";
import { PlayerProfile, GameMode, GameRoom } from "../src/core/types";
import { authService } from "../src/core/services/auth.service";
import { roomNameSchema } from "../src/core/validation/schemas";
import { FlatList } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { HAND_SIZE, TURN_DURATION_SECONDS } from "../src/core/constants";
import { economyService } from "../src/core/services/economy.service";
import { TABLE_CONFIGS } from "../src/core/economy.constants";
import { TableTier } from "../src/core/economy.types";
import { EconomyHeader } from "../src/components/EconomyHeader";
import { GameModeCard } from "../src/components/GameModeCard";
import { SelectedModeHeader } from "../src/components/SelectedModeHeader";

type LobbyTab = "CREATE" | "JOIN" | "PUBLIC";

const MODE_LABELS: Record<GameMode, string> = {
    VICTOIRE: "Victoire",
    MANCHE: "Manche",
    SCORE: "Score",
    COCHON: "Cochon",
};

const MODE_UNIT_LABELS: Record<GameMode, string> = {
    VICTOIRE: "Victoires",
    MANCHE: "Manches",
    SCORE: "Points",
    COCHON: "Cochons",
};

export default function LobbyScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();
    const isLandscape = width > height;

    // — Shared state —
    const [loading, setLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState<PlayerProfile | null>(null);
    const [activeTab, setActiveTab] = useState<LobbyTab>("CREATE");
    const [hostedWaitingRoomId, setHostedWaitingRoomId] = useState<
        string | null
    >(null);

    // — JOIN tab state —
    const [roomIdToJoin, setRoomIdToJoin] = useState("");
    const { autoJoinRoomId } = useLocalSearchParams<{
        autoJoinRoomId?: string;
    }>();

    useEffect(() => {
        if (autoJoinRoomId) {
            setRoomIdToJoin(autoJoinRoomId);
            setActiveTab("JOIN");
        }
    }, [autoJoinRoomId]);

    // — CREATE tab state —
    const [isPrivateRoom, setIsPrivateRoom] = useState(false);
    const [roomNameInput, setRoomNameInput] = useState("");
    const [roomError, setRoomError] = useState<string | null>(null);
    const [gameMode, setGameMode] = useState<GameMode>("COCHON");
    const [winningCondition, setWinningCondition] = useState(__DEV__ ? 1 : 10);
    const [turnDuration, setTurnDuration] = useState(TURN_DURATION_SECONDS);
    const [startingHandSize, setStartingHandSize] = useState(HAND_SIZE);
    // Phase 7 : le sélecteur de table sera dans l'UI — fixé à DEBUTANT pour l'instant
    const [tableTier] = useState<TableTier>("DEBUTANT");
    const [debitFeedback, setDebitFeedback] = useState<string | null>(null);
    const [economyRefresh, setEconomyRefresh] = useState(0);
    const [uiStep, setUiStep] = useState<"MODE" | "CONFIG">("MODE");

    // --- Calculs de Scaling Dynamique (4 colonnes) ---
    const HORIZONTAL_PADDING = 48;
    const GAP = 10;
    const availableWidth = width - HORIZONTAL_PADDING - GAP * 3;
    const colWidth = availableWidth / 4;

    const dynamicEmojiSize = Math.max(colWidth * 0.35, 24);
    const dynamicTitleSize = Math.max(colWidth * 0.14, 11);

    // — PUBLIC tab state —
    const [publicRooms, setPublicRooms] = useState<GameRoom[]>([]);
    const [loadingPublicRooms, setLoadingPublicRooms] = useState(false);

    useFocusEffect(
        useCallback(() => {
            const loadUser = async () => {
                try {
                    // Always refresh from storage to get latest profile data
                    const user = await authService.refreshUserFromStorage();
                    if (user) {
                        if (user.uid.startsWith("guest_")) {
                            // Guard: Anons cannot stay in lobby
                            router.replace({
                                pathname: "/login",
                                params: { autoJoinRoomId },
                            });
                            return;
                        }
                        // Enrichir le profil avec leagueGrade + activeFrame pour que
                        // les adversaires voient le niveau en salle d'attente et en jeu
                        const eco = await economyService.getEconomy();
                        const enrichedUser: PlayerProfile = {
                            ...user,
                            leagueGrade: eco.leagueGrade ?? undefined,
                            activeFrame: eco.activeFrame ?? undefined,
                        };
                        setCurrentUser(enrichedUser);
                        const activeRoom = await findActiveRoomForUser(
                            user.uid,
                        );
                        if (activeRoom) {
                            router.replace({
                                pathname: "/game/[id]",
                                params: {
                                    id: activeRoom,
                                    userId: user.uid,
                                    tableTier,
                                },
                            });
                            return;
                        }
                        const hostedRoom = await findHostedWaitingRoom(
                            user.uid,
                        );
                        setHostedWaitingRoomId(hostedRoom);
                        setEconomyRefresh((v) => v + 1); // refresh EconomyHeader
                    } else {
                        // No user at all -> Login
                        router.replace({
                            pathname: "/login",
                            params: { autoJoinRoomId },
                        });
                    }
                } catch (error) {
                    console.error("[Lobby] Error loading user:", error);
                }
            };
            loadUser();
        }, []),
    );

    useEffect(() => {
        let unsubscribe: (() => void) | null = null;
        let retryInterval: any = null;

        const startListening = () => {
            if (activeTab === "PUBLIC") {
                setLoadingPublicRooms(true);
                unsubscribe = listenToPublicRooms(
                    (rooms) => {
                        setPublicRooms(rooms);
                        setLoadingPublicRooms(false);
                    },
                    (error) => {
                        console.log("Error listening to rooms", error);
                        setLoadingPublicRooms(false);
                        // Retenter plus tard si erreur (ex: déconnexion passagère)
                    },
                );
            }
        };

        startListening();

        // Robustness: Re-check every 30s if we are in public tab
        if (activeTab === "PUBLIC") {
            retryInterval = setInterval(() => {
                if (!unsubscribe) startListening();
            }, 30000);
        }

        return () => {
            if (unsubscribe) unsubscribe();
            if (retryInterval) clearInterval(retryInterval);
        };
    }, [activeTab]);

    // ─── Actions ────────────────────────────────────────────────────

    const requireAccountForMultiplayer = (): boolean => {
        if (!auth.currentUser) {
            Alert.alert(
                "Connexion requise",
                "Vous devez être connecté pour jouer en Multijoueur.",
            );
            router.push("/login");
            return false;
        }
        if (auth.currentUser.isAnonymous) {
            Alert.alert(
                "Compte Gratuit Requis",
                "Le mode Multijoueur est réservé aux comptes inscrits. Créez un compte gratuit pour défier d'autres joueurs !",
                [
                    { text: "Plus tard", style: "cancel" },
                    {
                        text: "Créer un compte",
                        onPress: () => router.push("/login"),
                    },
                ],
            );
            return false;
        }
        return true;
    };

    /**
     * Vérifie uniquement si le solde est suffisant sans débiter.
     * Le débit réel se fera au lancement de la partie dans GameScreen.
     * @returns true si OK, false si solde insuffisant
     */
    const checkBalanceOnly = async (): Promise<boolean> => {
        const tableConfig = TABLE_CONFIGS[tableTier];
        if (tableConfig.buyIn <= 0) return true;

        const economy = await economyService.getEconomy();
        const hasEnough = economy.coins >= tableConfig.buyIn;

        if (!hasEnough) {
            Alert.alert(
                "Coins insuffisants 🪙",
                `Il vous faut ${tableConfig.buyIn} coins pour la ${tableConfig.label}.`,
                [{ text: "OK", style: "cancel" }],
            );
        }
        return hasEnough;
    };

    const handleDeleteHostedWaitingRoom = async (roomId?: string | null) => {
        if (!currentUser || !roomId) return;
        try {
            setLoading(true);
            const deleted = await deleteWaitingRoomIfOwner(
                roomId,
                currentUser.uid,
            );
            if (deleted) {
                setHostedWaitingRoomId(null);
                Alert.alert(
                    "Table supprimée",
                    "Votre table vide a bien été supprimée.",
                );
            }
        } catch (error: any) {
            Alert.alert(
                "Suppression impossible",
                error?.message || "Impossible de supprimer cette table.",
            );
            const hostedRoom = await findHostedWaitingRoom(currentUser.uid);
            setHostedWaitingRoomId(hostedRoom);
        } finally {
            setLoading(false);
        }
    };

    const ensureNoConflictingActiveRoom = async (targetRoomId?: string) => {
        if (!currentUser) return false;
        const activeRoom = await findActiveRoomForUser(currentUser.uid);
        if (!activeRoom || activeRoom === targetRoomId) return false;

        Alert.alert(
            "Partie en cours",
            "Vous êtes déjà dans une partie active. Rejoignez-la avant d’ouvrir une autre salle.",
            [
                { text: "Annuler", style: "cancel" },
                {
                    text: "Rejoindre la partie",
                    onPress: () =>
                        router.push({
                            pathname: "/game/[id]",
                            params: {
                                id: activeRoom,
                                userId: currentUser.uid,
                                tableTier,
                            },
                        }),
                },
            ],
        );
        return true;
    };

    const handleCreateRoom = async () => {
        if (!requireAccountForMultiplayer()) return;
        if (!currentUser) return;

        // ❌ Vérification : l'utilisateur héberge déjà une table en attente
        const hostedRoom = await findHostedWaitingRoom(currentUser.uid);
        if (hostedRoom) {
            setHostedWaitingRoomId(hostedRoom);
            Alert.alert(
                "Table existante",
                "Vous êtes déjà l'hôte d'une table en attente. Rejoignez-la ou attendez qu'elle soit fermée.",
                [
                    { text: "Annuler", style: "cancel" },
                    {
                        text: "Rejoindre ma table",
                        onPress: () =>
                            router.push({
                                pathname: "/game/[id]",
                                params: {
                                    id: hostedRoom,
                                    userId: currentUser.uid,
                                    tableTier,
                                },
                            }),
                    },
                    {
                        text: "Supprimer ma table",
                        style: "destructive",
                        onPress: () =>
                            handleDeleteHostedWaitingRoom(hostedRoom),
                    },
                ],
            );
            return;
        }

        // ❌ Vérification : l'utilisateur est déjà dans une partie active
        const activeRoom = await findActiveRoomForUser(currentUser.uid);
        if (activeRoom) {
            Alert.alert(
                "Partie en cours",
                "Vous êtes déjà dans une partie active. Terminez-la avant d'en créer une nouvelle.",
                [
                    { text: "Annuler", style: "cancel" },
                    {
                        text: "Rejoindre la partie",
                        onPress: () =>
                            router.push({
                                pathname: "/game/[id]",
                                params: {
                                    id: activeRoom,
                                    userId: currentUser.uid,
                                    tableTier,
                                },
                            }),
                    },
                ],
            );
            return;
        }

        if (!(await checkBalanceOnly())) return; // ❌ Solde insuffisant

        setRoomError(null);
        const result = roomNameSchema.safeParse(roomNameInput);
        if (!result.success) {
            setRoomError(result.error.issues[0].message);
            return;
        }

        try {
            setLoading(true);
            // [R3-M2] Garantir leagueGrade + activeFrame dans le profil écrit en Firestore
            // (ne pas dépendre du state React qui peut être en retard)
            const eco = await economyService.getEconomy();
            const enrichedProfile = {
                ...currentUser,
                leagueGrade: eco.leagueGrade ?? undefined,
                activeFrame: eco.activeFrame ?? undefined,
            };
            const options: RoomOptions = {
                gameMode,
                winningCondition,
                turnDuration,
                startingHandSize,
            };
            const newRoomId = await createRoom(
                enrichedProfile,
                isPrivateRoom,
                result.data || undefined,
                undefined,
                options,
            );
            setHostedWaitingRoomId(newRoomId);
            // ✅ Navigation vers la salle (le débit se fera au Start)
            router.push({
                pathname: "/game/[id]",
                params: { id: newRoomId, userId: currentUser.uid, tableTier },
            });
        } catch (error) {
            Alert.alert("Erreur", "Impossible de créer la table.");
        } finally {
            setLoading(false);
        }
    };

    const handleJoinRoom = async () => {
        if (!requireAccountForMultiplayer()) return;
        if (!roomIdToJoin.trim() || !currentUser) return;
        const cleanRoomId = roomIdToJoin.trim().toUpperCase();
        if (
            cleanRoomId.length < 5 ||
            cleanRoomId.length > 20 ||
            !/^[a-zA-Z0-9]+$/.test(cleanRoomId)
        ) {
            Alert.alert(
                "Code invalide",
                "Le code de la table doit contenir environ 6 caractères alphanumériques.",
            );
            return;
        }
        if (await ensureNoConflictingActiveRoom(cleanRoomId)) return;
        if (!(await checkBalanceOnly())) return; // ❌ Solde insuffisant
        try {
            setLoading(true);
            // [R3-M2] Enrichissement garanti avant joinRoom
            const eco = await economyService.getEconomy();
            const enrichedProfile = {
                ...currentUser,
                leagueGrade: eco.leagueGrade ?? undefined,
                activeFrame: eco.activeFrame ?? undefined,
            };
            await joinRoom(cleanRoomId, enrichedProfile);
            router.push({
                pathname: "/game/[id]",
                params: { id: cleanRoomId, userId: currentUser.uid, tableTier },
            });
        } catch (error: any) {
            Alert.alert("Erreur", error.message || "Impossible de rejoindre.");
        } finally {
            setLoading(false);
        }
    };

    const handleJoinPublicRoom = async (roomId: string) => {
        if (!requireAccountForMultiplayer()) return;
        if (!currentUser) return;
        if (await ensureNoConflictingActiveRoom(roomId)) return;
        if (!(await checkBalanceOnly())) return; // ❌ Solde insuffisant
        try {
            setLoading(true);
            // [R3-M2] Enrichissement garanti avant joinRoom
            const eco = await economyService.getEconomy();
            const enrichedProfile = {
                ...currentUser,
                leagueGrade: eco.leagueGrade ?? undefined,
                activeFrame: eco.activeFrame ?? undefined,
            };
            await joinRoom(roomId, enrichedProfile);
            router.push({
                pathname: "/game/[id]",
                params: { id: roomId, userId: currentUser.uid, tableTier },
            });
        } catch (error: any) {
            Alert.alert("Erreur", error.message || "Impossible de rejoindre.");
        } finally {
            setLoading(false);
        }
    };

    // ─── Tabs ───────────────────────────────────────────────────────

    const renderTabs = () => (
        <View style={styles.tabContainer}>
            {[
                { key: "CREATE" as LobbyTab, label: "Créer" },
                { key: "JOIN" as LobbyTab, label: "Rejoindre" },
                { key: "PUBLIC" as LobbyTab, label: "Publiques" },
            ].map((tab) => (
                <TouchableOpacity
                    key={tab.key}
                    style={[
                        styles.tabButton,
                        activeTab === tab.key && styles.activeTab,
                    ]}
                    onPress={() => setActiveTab(tab.key)}
                >
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === tab.key && styles.activeTabText,
                        ]}
                        numberOfLines={1}
                    >
                        {tab.label}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    // ─── CREATE Tab ─────────────────────────────────────────────────

    const renderCreateTab = () => (
        <Animated.View
            entering={FadeIn.delay(200)}
            style={styles.createContent}
        >
            {hostedWaitingRoomId ? (
                <View style={styles.hostedRoomCard}>
                    <Text style={styles.hostedRoomTitle}>
                        Table en attente détectée
                    </Text>
                    <Text style={styles.hostedRoomCode}>
                        Code : {hostedWaitingRoomId}
                    </Text>
                    <Text style={styles.hostedRoomText}>
                        Vous avez déjà une table en attente. Vous pouvez la
                        rejoindre directement ou la supprimer si personne ne
                        l&apos;a encore rejointe.
                    </Text>
                    <View style={styles.hostedRoomActions}>
                        <TouchableOpacity
                            style={styles.hostedRoomSecondary}
                            onPress={() =>
                                handleDeleteHostedWaitingRoom(
                                    hostedWaitingRoomId,
                                )
                            }
                            activeOpacity={0.8}
                        >
                            <Text style={styles.hostedRoomSecondaryText}>
                                Supprimer
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.hostedRoomPrimary}
                            onPress={() =>
                                currentUser &&
                                router.push({
                                    pathname: "/game/[id]",
                                    params: {
                                        id: hostedWaitingRoomId,
                                        userId: currentUser.uid,
                                        tableTier,
                                    },
                                })
                            }
                            activeOpacity={0.8}
                        >
                            <Text style={styles.hostedRoomPrimaryText}>
                                Rejoindre ma table
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : null}

            {uiStep === "MODE" ? (
                <View style={styles.stepContainer}>
                    <View style={styles.modesGrid}>
                        <GameModeCard
                            id="SCORE"
                            title="Score"
                            description="Atteins l'objectif de points pour gagner la partie."
                            icon="🎯"
                            colors={["#0288D1", "#26C6DA"]}
                            onPress={() => {
                                setGameMode("SCORE");
                                setWinningCondition(__DEV__ ? 1 : 15);
                                setUiStep("CONFIG");
                            }}
                            delay={100}
                        />
                        <GameModeCard
                            id="COCHON"
                            title="Cochons"
                            description="Évite de rester à zéro point pour ne pas être le cochon !"
                            icon="🐷"
                            colors={["#EC407A", "#FF7043"]}
                            onPress={() => {
                                setGameMode("COCHON");
                                setWinningCondition(__DEV__ ? 1 : 2);
                                setUiStep("CONFIG");
                            }}
                            delay={200}
                        />
                        <GameModeCard
                            id="MANCHE"
                            title="Manches"
                            description="Joue un nombre fixe de manches et gagne au total."
                            icon="🎲"
                            colors={["#FFA000", "#FFD54F"]}
                            onPress={() => {
                                setGameMode("MANCHE");
                                setWinningCondition(__DEV__ ? 1 : 10);
                                setUiStep("CONFIG");
                            }}
                            delay={300}
                        />
                    </View>
                </View>
            ) : (
                <View style={styles.stepContainer}>
                    <SelectedModeHeader
                        title={MODE_LABELS[gameMode]}
                        description={
                            gameMode === "VICTOIRE"
                                ? "Premier à gagner rounds"
                                : gameMode === "SCORE"
                                  ? "Objectif de points"
                                  : gameMode === "COCHON"
                                    ? "Éviter les cochons"
                                    : "Nombre de manches"
                        }
                        icon={
                            gameMode === "VICTOIRE"
                                ? "🏆"
                                : gameMode === "SCORE"
                                  ? "🎯"
                                  : gameMode === "COCHON"
                                    ? "🐷"
                                    : "🎲"
                        }
                        colors={
                            gameMode === "VICTOIRE"
                                ? ["#388E3C", "#66BB6A"]
                                : gameMode === "SCORE"
                                  ? ["#0288D1", "#26C6DA"]
                                  : gameMode === "COCHON"
                                    ? ["#EC407A", "#FF7043"]
                                    : ["#FFA000", "#FFD54F"]
                        }
                        onBack={() => setUiStep("MODE")}
                        onActionPress={handleCreateRoom}
                        actionCost={TABLE_CONFIGS[tableTier].buyIn}
                    />

                    <View style={styles.configSplitOuter}>
                        {/* Right Col: Settings (Now full width) */}
                        <View style={styles.configRightCol}>
                            <View style={styles.paramsHorizontalStack}>
                                {/* 1. Visibilité */}
                                <View style={styles.paramItemHorizontal}>
                                    <Text style={styles.paramLabelSmall}>
                                        VISIBILITÉ
                                    </Text>
                                    <View style={styles.diffToggleSmall}>
                                        <TouchableOpacity
                                            style={[
                                                styles.diffBtnSmall,
                                                !isPrivateRoom &&
                                                    styles.activeDiffBtnSmall,
                                            ]}
                                            onPress={() =>
                                                setIsPrivateRoom(false)
                                            }
                                        >
                                            <Ionicons
                                                name="earth"
                                                size={18}
                                                color={
                                                    !isPrivateRoom
                                                        ? "#000"
                                                        : "#FFF"
                                                }
                                            />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[
                                                styles.diffBtnSmall,
                                                isPrivateRoom &&
                                                    styles.activeDiffBtnSmall,
                                            ]}
                                            onPress={() =>
                                                setIsPrivateRoom(true)
                                            }
                                        >
                                            <Ionicons
                                                name="lock-closed"
                                                size={18}
                                                color={
                                                    isPrivateRoom
                                                        ? "#000"
                                                        : "#FFF"
                                                }
                                            />
                                        </TouchableOpacity>
                                    </View>
                                    <Text style={styles.paramSubtext}>
                                        {isPrivateRoom ? "PRIVÉE" : "PUBLIQUE"}
                                    </Text>
                                </View>

                                {/* 2. Objectif */}
                                <View style={styles.paramItemHorizontal}>
                                    <Text style={styles.paramLabelSmall}>
                                        OBJECTIF
                                    </Text>
                                    <View style={styles.stepperSmall}>
                                        <TouchableOpacity
                                            onPress={() =>
                                                setWinningCondition((prev) => {
                                                    const min = 1;
                                                    return Math.max(
                                                        min,
                                                        prev - 1,
                                                    );
                                                })
                                            }
                                            style={styles.stepBtnSmall}
                                        >
                                            <Ionicons
                                                name="remove"
                                                size={18}
                                                color="#FFF"
                                            />
                                        </TouchableOpacity>
                                        <Text style={styles.stepValueSmall}>
                                            {winningCondition}
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() =>
                                                setWinningCondition((prev) => {
                                                    const max =
                                                        gameMode === "VICTOIRE"
                                                            ? 15
                                                            : gameMode ===
                                                                "SCORE"
                                                              ? 25
                                                              : gameMode ===
                                                                  "COCHON"
                                                                ? 10
                                                                : 15;
                                                    return Math.min(
                                                        max,
                                                        prev + 1,
                                                    );
                                                })
                                            }
                                            style={styles.stepBtnSmall}
                                        >
                                            <Ionicons
                                                name="add"
                                                size={18}
                                                color="#FFF"
                                            />
                                        </TouchableOpacity>
                                    </View>
                                    <Text style={styles.paramSubtext}>
                                        {MODE_UNIT_LABELS[gameMode]}
                                    </Text>
                                </View>

                                {/* 3. Vitesse */}
                                <View style={styles.paramItemHorizontal}>
                                    <Text style={styles.paramLabelSmall}>
                                        VITESSE
                                    </Text>
                                    <View style={styles.stepperSmall}>
                                        <TouchableOpacity
                                            onPress={() =>
                                                setTurnDuration((prev) => {
                                                    const steps = [
                                                        1, 5, 10, 15, 20, 25,
                                                        30, 35, 40, 45, 50, 55,
                                                        60,
                                                    ];
                                                    const idx =
                                                        steps.indexOf(prev);
                                                    return idx > 0
                                                        ? steps[idx - 1]
                                                        : steps[0];
                                                })
                                            }
                                            style={styles.stepBtnSmall}
                                        >
                                            <Ionicons
                                                name="remove"
                                                size={18}
                                                color="#FFF"
                                            />
                                        </TouchableOpacity>
                                        <Text style={styles.stepValueSmall}>
                                            {turnDuration}
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() =>
                                                setTurnDuration((prev) => {
                                                    const steps = [
                                                        1, 5, 10, 15, 20, 25,
                                                        30, 35, 40, 45, 50, 55,
                                                        60,
                                                    ];
                                                    const idx =
                                                        steps.indexOf(prev);
                                                    return idx <
                                                        steps.length - 1
                                                        ? steps[idx + 1]
                                                        : steps[
                                                              steps.length - 1
                                                          ];
                                                })
                                            }
                                            style={styles.stepBtnSmall}
                                        >
                                            <Ionicons
                                                name="add"
                                                size={18}
                                                color="#FFF"
                                            />
                                        </TouchableOpacity>
                                    </View>
                                    <Text style={styles.paramSubtext}>
                                        secondes
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            )}

            {debitFeedback && (
                <Animated.Text
                    entering={FadeInLeft.duration(200)}
                    style={styles.debitFeedback}
                >
                    {debitFeedback} débités
                </Animated.Text>
            )}
        </Animated.View>
    );

    // ─── JOIN Tab ───────────────────────────────────────────────────

    const renderJoinTab = () => (
        <Animated.View entering={FadeIn.delay(200)} style={styles.card}>
            <Text style={styles.cardTitle}>Rejoindre une Table</Text>
            <Text style={styles.cardSubtitle}>
                Entre le code partagé par l&apos;hôte
            </Text>
            <TextInput
                style={styles.input}
                placeholder="Code de la table"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={roomIdToJoin}
                onChangeText={setRoomIdToJoin}
                autoCapitalize="none"
            />
            <View style={styles.playButtonWrapper}>
                <TouchableOpacity
                    style={styles.playButton}
                    onPress={handleJoinRoom}
                    activeOpacity={0.8}
                >
                    <LinearGradient
                        colors={["#FFD700", "#FFA500"]}
                        style={styles.playGradient}
                    >
                        <View style={styles.playContent}>
                            <View style={styles.costContainer}>
                                <Text style={{ fontSize: 18 }}>🪙</Text>
                                <Text style={styles.costText}>
                                    -{TABLE_CONFIGS[tableTier].buyIn}
                                </Text>
                            </View>
                            <View style={styles.playDivider} />
                            <Text style={styles.playText}>REJOINDRE</Text>
                        </View>
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            {debitFeedback && (
                <Animated.Text
                    entering={FadeInLeft.duration(200)}
                    style={styles.debitFeedback}
                >
                    {debitFeedback} débités
                </Animated.Text>
            )}
        </Animated.View>
    );

    // ─── PUBLIC Tab ─────────────────────────────────────────────────

    const renderPublicRoom = ({
        item,
        index,
    }: {
        item: GameRoom;
        index: number;
    }) => (
        <Animated.View entering={FadeInLeft.delay(index * 80)}>
            <TouchableOpacity
                style={styles.roomItem}
                onPress={() => handleJoinPublicRoom(item.roomId)}
            >
                <View style={styles.roomItemLeft}>
                    <View style={styles.roomAvatar}>
                        <Text style={styles.roomAvatarText}>
                            {item.players[0]?.displayName?.charAt(0) || "?"}
                        </Text>
                    </View>
                    <View>
                        <Text style={styles.roomNameBold}>
                            {item.roomName ||
                                `Table #${item.roomId.slice(0, 4)}`}
                        </Text>
                        <Text style={styles.roomHost}>
                            Hôte: {item.players[0]?.displayName}
                        </Text>
                    </View>
                </View>
                <View style={styles.roomItemRight}>
                    {/* Mode badge */}
                    <View style={styles.modeBadge}>
                        <Text style={styles.modeBadgeText}>
                            {MODE_LABELS[item.gameMode || "MANCHE"]} | Obj:{" "}
                            {item.winningCondition || 3}
                        </Text>
                    </View>
                    <Text style={styles.playerCount}>
                        {item.players.length}/3 👤
                    </Text>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );

    const renderPublicTab = () => (
        <View style={styles.listContainer}>
            {loadingPublicRooms ? (
                <View style={styles.emptyContainer}>
                    <ActivityIndicator color="#FFD700" />
                </View>
            ) : (
                <FlatList
                    data={publicRooms}
                    keyExtractor={(item) => item.roomId}
                    renderItem={renderPublicRoom}
                    scrollEnabled={false}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyIcon}>🏝️</Text>
                            <Text style={styles.emptyText}>
                                Aucune table publique pour le moment.
                            </Text>
                            <Text style={styles.emptyHint}>
                                Crée la première !
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );

    // ─── Main Render ────────────────────────────────────────────────

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FFD700" />
                <Text style={styles.loadingText}>Chargement...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={["#2D1B4E", "#1A0E2E"]}
                style={styles.container}
            >
                {/* Header Top Row (Integrated Back + Tabs + Economy) */}
                <View
                    style={[
                        styles.headerRow,
                        {
                            paddingTop: Math.max(
                                insets.top,
                                Platform.OS === "ios" ? 0 : 10,
                            ),
                        },
                    ]}
                >
                    <TouchableOpacity
                        onPress={() => {
                            if (activeTab === "CREATE" && uiStep === "CONFIG") {
                                setUiStep("MODE");
                            } else {
                                router.back();
                            }
                        }}
                        style={styles.backButton}
                    >
                        <Ionicons
                            name={
                                activeTab === "CREATE" && uiStep === "CONFIG"
                                    ? "arrow-back"
                                    : "arrow-back"
                            }
                            size={24}
                            color="#FFF"
                        />
                    </TouchableOpacity>

                    <View style={styles.tabsWrapper}>{renderTabs()}</View>

                    <EconomyHeader refreshTrigger={economyRefresh} />
                </View>

                <ScrollView
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingBottom: insets.bottom + 20 },
                    ]}
                    showsVerticalScrollIndicator={false}
                    scrollEnabled={true}
                >
                    <Animated.View
                        entering={FadeInUp.delay(200)}
                        style={[
                            styles.mainWrapper,
                            isLandscape && styles.mainWrapperLandscape,
                        ]}
                    >
                        {activeTab === "CREATE" && renderCreateTab()}
                        {activeTab === "JOIN" && renderJoinTab()}
                        {activeTab === "PUBLIC" && renderPublicTab()}
                    </Animated.View>
                </ScrollView>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: "#1A0E2E",
        justifyContent: "center",
        alignItems: "center",
        gap: 12,
    },
    loadingText: {
        color: "rgba(255,255,255,0.5)",
        fontSize: 14,
    },
    // ─── Header ─────────────────────────────────────────────────
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingBottom: 10,
        justifyContent: "space-between",
        zIndex: 10,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "rgba(255,255,255,0.15)",
        justifyContent: "center",
        alignItems: "center",
    },
    tabsWrapper: {
        flex: 1,
        marginHorizontal: 12,
        maxWidth: 400,
    },
    tabContainer: {
        flexDirection: "row",
        backgroundColor: "rgba(255,255,255,0.08)",
        borderRadius: 15,
        padding: 3,
    },
    tabButton: {
        flex: 1,
        paddingVertical: 6,
        alignItems: "center",
        borderRadius: 12,
    },
    activeTab: {
        backgroundColor: "#FFD700",
    },
    tabText: {
        color: "rgba(255,255,255,0.6)",
        fontWeight: "bold",
        fontSize: 10,
    },
    activeTabText: {
        color: "#1A0E2E",
    },
    stepContainer: {
        width: "100%",
        alignItems: "center",
    },
    stepTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: "rgba(255,255,255,0.6)",
        marginBottom: 20,
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    modesGrid: {
        flexDirection: "row",
        gap: 10,
        paddingHorizontal: 4,
        alignItems: "stretch",
    },
    scrollHint: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        marginTop: 4,
        paddingBottom: 10,
    },
    scrollHintText: {
        fontSize: 12,
        color: "rgba(255,255,255,0.4)",
        fontWeight: "600",
        textTransform: "uppercase",
    },
    largeModeContainer: {
        width: "100%",
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: 6,
        gap: 10,
    },
    largeModeCard: {
        width: "23%",
        borderRadius: 18,
        overflow: "hidden",
        elevation: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
        aspectRatio: 1,
    },
    largeModeGradient: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 4,
        gap: 2,
    },
    largeModeEmoji: {
        // dynamic fontSize
        marginBottom: 2,
    },
    largeModeInfo: {
        alignItems: "center",
        width: "100%",
    },
    largeModeTitle: {
        // dynamic fontSize
        fontWeight: "900",
        color: "#FFF",
        textTransform: "uppercase",
        textAlign: "center",
    },
    largeModeDesc: {
        display: "none",
    },
    configHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        marginBottom: 20,
        backgroundColor: "rgba(255,255,255,0.1)",
        padding: 16,
        borderRadius: 20,
        width: "100%",
    },
    selectedModeEmoji: {
        fontSize: 40,
    },
    selectedModeTitle: {
        fontSize: 24,
        fontWeight: "900",
        color: "#FFF",
        textTransform: "uppercase",
    },
    changeModeLink: {
        fontSize: 14,
        color: "#FFD700",
        fontWeight: "700",
        textDecorationLine: "underline",
        marginTop: 2,
    },
    // Split View Config
    configSplitOuter: {
        flexDirection: "row",
        width: "100%",
        alignItems: "center", // Centered for better look with smaller card
        gap: 30, // Increased gap for airiness
        backgroundColor: "rgba(255,255,255,0.05)",
        padding: 30, // Increased padding
        borderRadius: 32,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
    },
    configLeftCol: {
        flex: 0.8, // Reduced from 1.2 to make card smaller
        alignItems: "center",
        justifyContent: "center",
    },
    configRightCol: {
        flex: 3, // Increased to take more space
    },
    paramsHorizontalStack: {
        flexDirection: "row",
        gap: 12,
        width: "100%",
    },
    paramItemHorizontal: {
        flex: 1,
        backgroundColor: "rgba(255,255,255,0.08)",
        padding: 12,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 110,
    },
    paramLabelSmall: {
        fontSize: 9,
        fontWeight: "900",
        color: "rgba(255,255,255,0.4)",
        marginBottom: 10,
        letterSpacing: 1.2,
    },
    paramSubtext: {
        fontSize: 9,
        color: "rgba(255,255,255,0.3)",
        marginTop: 6,
    },
    // Small Controls
    diffToggleSmall: {
        flexDirection: "row",
        gap: 8,
    },
    diffBtnSmall: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: "rgba(255,255,255,0.1)",
        alignItems: "center",
        justifyContent: "center",
    },
    activeDiffBtnSmall: {
        backgroundColor: "#FFD700",
    },
    diffIconSmall: {
        fontSize: 18,
    },
    stepperSmall: {
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
    },
    stepBtnSmall: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: "rgba(255,255,255,0.15)",
        alignItems: "center",
        justifyContent: "center",
    },
    stepValueSmall: {
        fontSize: 20,
        fontWeight: "900",
        color: "#FFF",
        minWidth: 30,
        textAlign: "center",
    },
    // ─── Scroll ─────────────────────────────────────────────────
    scrollContent: {
        flexGrow: 1,
    },
    mainWrapper: {
        paddingHorizontal: 24, // Increased for airiness
        paddingTop: 10,
        alignItems: "center",
    },
    mainWrapperLandscape: {
        paddingTop: 5,
        justifyContent: "center",
    },
    // ─── Create Content ──────────────────────────────────────────
    createContent: {
        width: "100%",
        maxWidth: 800,
    },
    inputWrapper: {
        flexDirection: "row",
        gap: 10,
        marginBottom: 15,
        alignItems: "center",
    },
    input: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.3)",
        borderRadius: 12,
        padding: 12,
        color: "#FFF",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
        fontSize: 14,
    },
    privateToggle: {
        backgroundColor: "rgba(255,255,255,0.05)",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
        overflow: "hidden",
    },
    privateToggleActive: {
        borderColor: "#FFD700",
        backgroundColor: "rgba(255,215,0,0.1)",
    },
    toggleClickArea: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 6,
    },
    privateToggleText: {
        color: "rgba(255,255,255,0.6)",
        fontSize: 12,
        fontWeight: "bold",
    },
    privateToggleTextActive: {
        color: "#FFD700",
    },
    // ─── Card ───────────────────────────────────────────────────
    card: {
        backgroundColor: "rgba(255,255,255,0.05)",
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
        width: "100%",
    },
    cardTitle: {
        fontSize: 22,
        fontWeight: "bold",
        color: "#FFD700",
        marginBottom: 6,
        textAlign: "center",
    },
    cardSubtitle: {
        fontSize: 14,
        color: "rgba(255,255,255,0.5)",
        marginBottom: 20,
        textAlign: "center",
    },
    // ─── Game Mode Cards (Solo Copy) ─────────────────────────────
    gameModeContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        width: "100%",
        marginBottom: 20,
        gap: 12,
    },
    gameModeContainerLandscape: {
        marginBottom: 10,
        gap: 8,
    },
    gameModeTile: {
        flex: 1,
        borderRadius: 20,
        height: 140,
        overflow: "hidden",
        borderWidth: 2,
        borderColor: "transparent",
        elevation: 8,
    },
    gameModeTileLandscape: {
        height: 90,
    },
    gameModeTileActive: {
        borderColor: "#FFD700",
        borderWidth: 3,
        transform: [{ scale: 1.02 }],
    },
    modeGradient: {
        flex: 1,
        padding: 10,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.2)",
        borderRadius: 20,
    },
    modeGradientLandscape: {
        flexDirection: "row",
        justifyContent: "space-around",
    },
    modeIllustration: {
        fontSize: 32,
        marginBottom: 4,
    },
    modeIllustrationLandscape: {
        fontSize: 24,
        marginBottom: 0,
    },
    gameModeTitle: {
        color: "#FFF",
        fontSize: 18,
        fontWeight: "900",
        textAlign: "center",
        textTransform: "uppercase",
    },
    gameModeTitleLandscape: {
        fontSize: 14,
    },
    gameModeSubtitle: {
        color: "rgba(255,255,255,0.8)",
        fontSize: 10,
        textAlign: "center",
        marginTop: 2,
        fontWeight: "600",
    },
    gameModeSubtitleLandscape: {
        display: "none",
    },
    // --- Parameters Bar (Solo Mode Layout) ---
    paramsContainer: {
        width: "100%",
        backgroundColor: "rgba(30, 20, 50, 0.7)",
        borderRadius: 20,
        padding: 15,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.1)",
        marginBottom: 20,
    },
    paramsContainerLandscape: {
        flexDirection: "row",
        padding: 10,
        marginBottom: 10,
        justifyContent: "space-between",
    },
    paramCol: {
        flex: 1,
        alignItems: "center",
        borderRightWidth: 1,
        borderRightColor: "rgba(255,255,255,0.05)",
        paddingHorizontal: 5,
    },
    paramColLandscape: {
        borderRightWidth: 1,
    },
    paramLabel: {
        color: "rgba(255,255,255,0.5)",
        fontSize: 10,
        fontWeight: "800",
        textTransform: "uppercase",
        marginBottom: 6,
    },
    paramValueSmall: {
        color: "#FFF",
        fontSize: 9,
        fontWeight: "700",
        marginTop: 4,
        opacity: 0.6,
        textTransform: "uppercase",
    },
    stepper: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.3)",
        padding: 3,
        borderRadius: 12,
        gap: 3,
    },
    stepBtn: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: "rgba(255,255,255,0.1)",
        justifyContent: "center",
        alignItems: "center",
    },
    stepValue: {
        color: "#FFD700",
        fontSize: 18,
        fontWeight: "900",
        minWidth: 30,
        textAlign: "center",
    },
    stepValueLandscape: {
        fontSize: 16,
    },
    diffToggle: {
        flexDirection: "row",
        backgroundColor: "rgba(0,0,0,0.3)",
        padding: 3,
        borderRadius: 12,
        gap: 4,
    },
    diffBtn: {
        width: 30,
        height: 30,
        borderRadius: 8,
        justifyContent: "center",
        alignItems: "center",
    },
    activeDiffBtn: {
        backgroundColor: "#FFD700",
    },
    handToggle: {
        flexDirection: "row",
        backgroundColor: "rgba(0,0,0,0.3)",
        padding: 3,
        borderRadius: 12,
        gap: 4,
    },
    handBtn: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: "rgba(255,255,255,0.05)",
        justifyContent: "center",
        alignItems: "center",
    },
    handBtnLandscape: {
        width: 26,
        height: 26,
    },
    activeHandBtn: {
        backgroundColor: "#FFD700",
    },
    handText: {
        color: "#FFF",
        fontSize: 14,
        fontWeight: "900",
    },
    handTextLandscape: {
        fontSize: 12,
    },
    activeHandText: {
        color: "#000",
    },
    // --- Play Button ---
    playButtonWrapper: {
        flex: 0,
        minWidth: 120,
        alignItems: "center",
    },
    playButtonWrapperLandscape: {
        marginTop: 0,
    },
    playButton: {
        width: "auto",
        minWidth: 100,
        height: 48,
        borderRadius: 24,
        overflow: "hidden",
        elevation: 8,
    },
    playButtonLandscape: {
        height: 40,
        minWidth: 120,
    },
    playGradient: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 20,
    },
    playContent: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
    },
    costContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.15)",
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 15,
    },
    costText: {
        color: "#FFF",
        fontSize: 16,
        fontWeight: "900",
        marginLeft: 4,
    },
    costTextLandscape: {
        fontSize: 12,
    },
    playDivider: {
        width: 1,
        height: 20,
        backgroundColor: "rgba(255,255,255,0.3)",
        marginHorizontal: 10,
    },
    playText: {
        color: "#FFF",
        fontSize: 16,
        fontWeight: "900",
        letterSpacing: 0.5,
    },
    playTextLandscape: {
        fontSize: 12,
    },
    // --- Bottom Actions (Option 3+) ---
    bottomActionsRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginTop: 15,
        backgroundColor: "rgba(255,255,255,0.03)",
        padding: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.05)",
    },
    bottomActionsRowLandscape: {
        paddingVertical: 8,
    },
    bottomInput: {
        flex: 1,
        height: 48,
        backgroundColor: "rgba(0,0,0,0.3)",
        borderRadius: 12,
        paddingHorizontal: 15,
        color: "#FFF",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
        fontSize: 14,
    },
    costContainerCompact: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.15)",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
    },
    costTextCompact: {
        color: "#FFF",
        fontSize: 13,
        fontWeight: "900",
        marginLeft: 2,
    },
    playDividerSmall: {
        width: 1,
        height: 15,
        backgroundColor: "rgba(255,255,255,0.3)",
        marginHorizontal: 5,
    },
    debitFeedback: {
        color: "#FFD700",
        marginTop: 8,
        fontWeight: "bold",
        fontSize: 12,
        textAlign: "center",
    },
    hostedRoomCard: {
        backgroundColor: "rgba(255,215,0,0.08)",
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "rgba(255,215,0,0.2)",
        padding: 16,
        marginBottom: 16,
    },
    hostedRoomTitle: {
        color: "#FFD700",
        fontSize: 16,
        fontWeight: "900",
    },
    hostedRoomCode: {
        color: "#FFF",
        fontSize: 20,
        fontWeight: "900",
        marginTop: 6,
    },
    hostedRoomText: {
        color: "rgba(255,255,255,0.72)",
        fontSize: 13,
        lineHeight: 19,
        marginTop: 8,
    },
    hostedRoomActions: {
        flexDirection: "row",
        gap: 10,
        marginTop: 14,
    },
    hostedRoomPrimary: {
        flex: 1,
        borderRadius: 14,
        backgroundColor: "#FFD700",
        paddingVertical: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    hostedRoomPrimaryText: {
        color: "#1A0E2E",
        fontSize: 13,
        fontWeight: "900",
    },
    hostedRoomSecondary: {
        flex: 1,
        borderRadius: 14,
        backgroundColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        paddingVertical: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    hostedRoomSecondaryText: {
        color: "#FFF",
        fontSize: 13,
        fontWeight: "800",
    },
    // ─── List Rooms (Public) ─────────────────────────────────────
    startText: {
        color: "#FFF",
        fontSize: 16,
        fontWeight: "bold",
        letterSpacing: 2,
    },
    // ─── Public Rooms List ──────────────────────────────────────
    listContainer: {
        width: "100%",
        maxWidth: 800,
        flex: 1,
    },
    roomItem: {
        backgroundColor: "rgba(255,255,255,0.06)",
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
    },
    roomItemLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        flex: 1,
    },
    roomItemRight: {
        alignItems: "flex-end",
        gap: 6,
    },
    roomAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(255,111,0,0.2)",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#ff6f00",
    },
    roomAvatarText: {
        color: "#ff6f00",
        fontWeight: "bold",
        fontSize: 20,
    },
    roomNameBold: {
        color: "#FFF",
        fontWeight: "bold",
        fontSize: 16,
    },
    roomHost: {
        color: "rgba(255,255,255,0.5)",
        fontSize: 12,
        marginTop: 2,
    },
    modeBadge: {
        backgroundColor: "rgba(255,215,0,0.3)",
        alignItems: "center",
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 8,
        minWidth: 50,
        gap: 2,
    },
    buyInBadge: {
        color: "rgba(255, 215, 0, 0.8)",
        fontSize: 11,
        fontWeight: "600",
        marginTop: 4,
        letterSpacing: 0.5,
    },
    headerTop: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 15,
        paddingBottom: 10,
    },
    modeBadgeText: {
        color: "#FFD700",
        fontSize: 11,
        fontWeight: "bold",
    },
    playerCount: {
        color: "#FFD700",
        fontWeight: "bold",
        fontSize: 14,
    },
    emptyContainer: {
        paddingTop: 50,
        alignItems: "center",
        gap: 8,
    },
    emptyIcon: {
        fontSize: 40,
        marginBottom: 4,
    },
    emptyText: {
        color: "rgba(255,255,255,0.4)",
        fontStyle: "italic",
        fontSize: 15,
    },
    emptyHint: {
        color: "rgba(255,215,0,0.5)",
        fontSize: 13,
    },
    errorTextSmall: {
        color: "#FF3B30",
        fontSize: 11,
        marginTop: 2,
        marginLeft: 4,
    },
});
