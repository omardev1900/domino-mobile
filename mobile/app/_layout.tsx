import 'react-native-url-polyfill/auto';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useEffect, useState, useCallback, useRef } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { Platform, AppState, AppStateStatus, View, Text, Button } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as NavigationBar from 'expo-navigation-bar';
import { LinearGradient } from 'expo-linear-gradient';
import SoundManager from '@/core/audio/SoundManager';
import SettingsManager from '@/core/SettingsManager';
import NetInfo from '@react-native-community/netinfo';
import * as Sentry from '@sentry/react-native';
import * as Notifications from 'expo-notifications';
import { updateDoc, doc, getDoc } from 'firebase/firestore';
import { initializeAdMob } from '@/core/services/AdMobAdapter';

import { ForceUpdateModal } from '@/components/ForceUpdateModal';
import { useForceUpdate } from '@/hooks/useForceUpdate';
import { NetworkRequiredScreen } from '@/components/NetworkRequiredScreen';
import { SoloResumeModal } from '@/components/SoloResumeModal';
import { useSoloResume } from '@/hooks/useSoloResume';
import { MultiResumeModal } from '@/components/MultiResumeModal';
import { useMultiResume } from '@/hooks/useMultiResume';
import { authService } from '@/core/services/auth.service';
import { db, auth, findActiveRoomForUser, signalPlayerOnline, setUserActiveRoom } from '@/core/services/firebase';
import { Sidebar } from '@/components/Sidebar';
import { WebFullscreenButton } from '@/components/WebFullscreenButton';
import { USE_NEW_SIDEBAR, SIDEBAR_HIDDEN_ROUTES, SIDEBAR_HIDDEN_PREFIXES } from '@/core/config/navigation.config';
import { LogService } from '@/core/services/LogService';
import { AndroidStoreBanner } from '@/components/AndroidStoreBanner';

Sentry.init({
  dsn: 'https://b42b9f54cd5334acbc2310a30f9fc5fb@o4511343295987712.ingest.de.sentry.io/4511343301034064',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,
  replaysSessionSampleRate: 1.0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.feedbackIntegration(),
    Sentry.mobileReplayIntegration({
      maskAllText: true,
      maskAllImages: true,
      maskAllVectors: true,
    }),
  ],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

// Keep the native splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// WEB FIX: Inject global styles to ensure full height
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    html, body, #root {
      height: 100%;
      width: 100%;
      display: flex;
      flex-direction: column;
      background-color: #1A0E2E;
    }
  `;
  document.head.appendChild(style);

  // Android users see a dismissable banner (AndroidStoreBanner) instead of a forced redirect.
}

export const unstable_settings = {
  initialRouteName: 'index',
};

async function registerPushToken() {
  if (Platform.OS === 'web') return;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const tokenData = await Notifications.getDevicePushTokenAsync();
    const token = tokenData.data;
    const user = await authService.getCurrentUser();
    if (user && !user.uid.startsWith('guest_')) {
      await updateDoc(doc(db, 'users', user.uid), { fcmToken: token });
    }
  } catch (_) {
    // Non-critical — permission refusée ou appareil sans services Google
  }
}

async function applyImmersiveMode() {
  if (Platform.OS !== 'android') return;
  try {
    await NavigationBar.setVisibilityAsync('hidden');
    // overlay-swipe : la barre apparaît en overlay sur swipe puis se cache automatiquement
    await NavigationBar.setBehaviorAsync('overlay-swipe');
  } catch (_) {
    // Certains Android 15+ avec edge-to-edge forcé peuvent rejeter ces appels
  }
}

export default Sentry.wrap(function RootLayout() {
  const colorScheme = useColorScheme();
  const [appReady, setAppReady] = useState(false);
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
  });
  const pathname = usePathname();
  const router = useRouter();
  const previousPathname = useRef<string | undefined>(undefined);

  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const [isCheckingNetwork, setIsCheckingNetwork] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // ── Mise à jour forcée ──
  const forceUpdateInfo = useForceUpdate();

  // ── Reprise de partie solo ──
  const { resumeInfo: soloResumeInfo, dismiss: dismissResume, abandon: abandonSolo } = useSoloResume(pathname);

  // ── Reprise de partie multi ──
  const { resumeInfo: multiResumeInfo, dismiss: dismissMulti, abandon: abandonMulti } = useMultiResume(pathname);

  // Network check (NetInfo) listener
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected !== false);
      Sentry.addBreadcrumb({
        category: 'network',
        message: `Network state changed: isConnected=${state.isConnected}, type=${state.type}`,
        level: 'info',
      });
    });
    return () => unsubscribe();
  }, []);

  const handleRetryNetwork = async () => {
    setIsCheckingNetwork(true);
    try {
      const state = await NetInfo.fetch();
      setIsConnected(state.isConnected !== false);
    } catch (_) {
      // Ignore errors
    } finally {
      setIsCheckingNetwork(false);
    }
  };

  // Auth observer subscription
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser && !firebaseUser.isAnonymous && firebaseUser.email) {
        setIsAuthenticated(true);
        Sentry.setUser({ id: firebaseUser.uid, email: firebaseUser.email });
      } else {
        setIsAuthenticated(false);
        Sentry.setUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Auth redirection guard
  useEffect(() => {
    if (!appReady || authLoading) return;
    const isPublicRoute = pathname === '/' || pathname === '/login';
    if (isAuthenticated === false && !isPublicRoute) {
      router.replace('/login');
    } else if (isAuthenticated === true && pathname === '/login') {
      router.replace('/home');
    }
  }, [appReady, authLoading, isAuthenticated, pathname, router]);

  useEffect(() => {
    async function prepare() {
      try {
        await SettingsManager.loadSettings();

        // Réinitialise les cooldowns de session pub + charge les pubs actives (fire-and-forget)
        
        // Enregistre le token FCM pour les notifications push
        registerPushToken();

        // Preload audio assets
        await SoundManager.preloadSounds();

        // Android Immersive Mode — appel initial
        if (Platform.OS === 'android') {
          await applyImmersiveMode();
        }

        // Initialisation du SDK Google AdMob
        if (Platform.OS !== 'web') {
          try {
            await initializeAdMob();
          } catch (e) {
            LogService.error('AdMob', 'Erreur init AdMob', e);
          }
        }

      } catch (e) {
        // Non-critical init error — app continues
      } finally {
        setAppReady(true);
        // FORCE HIDE: If the app is ready, don't wait for onLayout
        // which might never fire if the first render has issues.
        try {
          await SplashScreen.hideAsync();
        } catch (e) {
          // Splash hide failure is non-critical
        }
      }
    }
    prepare();
  }, []);

  // Re-applique l'immersive mode chaque fois que l'app repasse en foreground.
  // Gère aussi le réveil après une alarme (AppState -> active) pour reconnecter le joueur.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (state: AppStateStatus) => {
      if (state === 'active') {
        if (Platform.OS === 'android') applyImmersiveMode();
        
        // Anti "Ecran blanc / Bloqué" : Si on sort de veille (alarme, etc.), on signale qu'on est de retour
        try {
          const user = await authService.getCurrentUser();
          if (user && !user.uid.startsWith('guest_')) {
            let activeRoomId = await AsyncStorage.getItem('active_roomId');
            if (!activeRoomId) activeRoomId = await findActiveRoomForUser(user.uid);
            if (activeRoomId) {
              await signalPlayerOnline(activeRoomId, user.uid);
            }
          }
        } catch (e) {
          LogService.warn('RootLayout', "Erreur resync AppState", e);
        }
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!appReady) return;
    previousPathname.current = pathname;
  }, [pathname, appReady]);

  // Global Music Manager — switch BGM based on route
  useEffect(() => {
    if (!appReady) return;

    if (pathname.startsWith('/game')) {
      const settings = SettingsManager.getSettings();
      if (settings.gameBgmTheme === 'none') {
        SoundManager.stopMusic();
      } else {
        SoundManager.playMusic('inGame', 0.5);
      }
      return;
    }

    const shouldStaySilent =
      pathname === '/' ||
      pathname === '/login' ||
      pathname === '/modal' ||
      pathname === '/profile' ||
      pathname === '/stats' ||
      pathname === '/store' ||
      pathname === '/collection' ||
      pathname === '/debug-ligue' ||
      pathname === '/debug-level';
    if (shouldStaySilent) {
      SoundManager.stopMusic();
      return;
    }

    SoundManager.playMusic('appActive', 0.5);
  }, [pathname, appReady]);



  const onLayoutRootView = useCallback(async () => {
    if (appReady) {
      // Hide native splash so our premium index.tsx screen takes over
      await SplashScreen.hideAsync();
    }
  }, [appReady]);



  // ── Écran bloquant de Mise à Jour Forcée ──
  // Doit s'afficher avant même de vérifier si appReady ou fontsLoaded,
  // ou en tout cas bloquer complètement l'accès au reste de l'app.
  if (forceUpdateInfo?.isRequired) {
    return <ForceUpdateModal info={forceUpdateInfo} />;
  }

  if (!appReady || !fontsLoaded || authLoading) {
    return null;
  }

  // Calcule si la sidebar doit être visible sur la route courante
  const showSidebar = USE_NEW_SIDEBAR &&
    !SIDEBAR_HIDDEN_ROUTES.includes(pathname) &&
    !SIDEBAR_HIDDEN_PREFIXES.some(p => pathname.startsWith(p));
  const showFullscreenButton = Platform.OS === 'web' && !pathname.startsWith('/game');

  return (
    <GestureHandlerRootView
      style={{ flex: 1, minHeight: Platform.OS === 'web' ? ('100vh' as any) : '100%', backgroundColor: '#1A0E2E' }}
      onLayout={onLayoutRootView}
      onTouchStart={() => SoundManager.unlockAudio()}
    >
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <LinearGradient
          colors={['#2D1B4E', '#1A0E2E']}
          style={{ flex: 1 }}
        >
          {/* Bannière Play Store pour les utilisateurs Android sur navigateur web */}
          <AndroidStoreBanner />

          {/* ── Sidebar + Contenu ─────────────────────────────────────── */}
          <View style={{ flex: 1, flexDirection: 'row' }}>

            {/* Sidebar gauche (feature flag + masquage dynamique par route) */}
            {showSidebar && <Sidebar />}

            {/* Stack principal — prend toute la largeur restante */}
            <View style={{ flex: 1 }}>
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="login" />
                <Stack.Screen name="home" />
                <Stack.Screen name="solo" />
                <Stack.Screen name="lobby" />
                <Stack.Screen name="game/[id]" />
                <Stack.Screen name="join/[id]" />
                <Stack.Screen name="profile" />
                <Stack.Screen
                  name="modal"
                  options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                  }}
                />
                <Stack.Screen
                  name="game-modes"
                  options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                  }}
                />
                <Stack.Screen
                  name="news/history"
                  options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                  }}
                />
              </Stack>
            </View>

          </View>

          {showFullscreenButton && (
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                top: 14,
                right: showSidebar ? 26 : 86,
                zIndex: 1000,
              }}
            >
              <WebFullscreenButton
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  backgroundColor: 'rgba(8,15,32,0.82)',
                  borderColor: 'rgba(255,215,0,0.55)',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.28,
                  shadowRadius: 8,
                }}
                size={22}
              />
            </View>
          )}
          {/* ──────────────────────────────────────────────────────────── */}

          {/* ── Modal de reprise de partie solo (global, toutes pages) ── */}
          {soloResumeInfo && appReady && !pathname.startsWith('/game') && (
            <SoloResumeModal
              resumeInfo={soloResumeInfo}
              onResume={() => {
                dismissResume();
                router.push({
                  pathname: '/game/[id]',
                  params: {
                    id: soloResumeInfo.gameId,
                    mode: 'solo',
                  }
                });
              }}
              onAbandon={abandonSolo}
            />
          )}

          {/* ── Modal de reprise de partie multi (global, toutes pages) ── */}
          {multiResumeInfo && appReady && !pathname.startsWith('/game') && (
            <MultiResumeModal
              resumeInfo={multiResumeInfo}
              onResume={() => {
                dismissMulti();
                router.replace({
                  pathname: '/game/[id]',
                  params: { id: multiResumeInfo.roomId }
                });
              }}
              onAbandon={abandonMulti}
            />
          )}

          {/* ── Overlay Réseau (ne démonte pas l'app) ── */}
          {isConnected === false && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, elevation: 99999 }}>
              <NetworkRequiredScreen
                onRetry={handleRetryNetwork}
                isChecking={isCheckingNetwork}
              />
            </View>
          )}

          <StatusBar hidden={true} />
        </LinearGradient>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
});

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <View style={{ flex: 1, backgroundColor: '#1A0E2E', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Text style={{ color: '#FFD700', fontSize: 22, fontWeight: 'bold', marginBottom: 10 }}>Oups !</Text>
      <Text style={{ color: '#FFF', fontSize: 16, textAlign: 'center', marginBottom: 20 }}>
        Un petit souci d'affichage est survenu.
      </Text>
      <Text style={{ color: '#aaa', fontSize: 10, textAlign: 'center', marginBottom: 30 }} numberOfLines={3}>
        {error.message}
      </Text>
      <Button title="Recharger l'affichage" onPress={retry} color="#E74C3C" />
    </View>
  );
}
