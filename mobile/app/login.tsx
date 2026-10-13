import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    useWindowDimensions
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authService } from '../src/core/services/auth.service';
import { LogService } from '../src/core/services/LogService';

const DEV_TEST_ACCOUNTS = [
    { label: 'Adil', email: 'adil@adil.com' },
    { label: 'Khalid', email: 'khalid@khalid.com' },
    { label: 'Aziz', email: 'aziz@aziz.com' },
] as const;

export default function LoginScreen() {
    const router = useRouter();
    const { autoJoinRoomId } = useLocalSearchParams<{ autoJoinRoomId?: string }>();
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();

    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isLoginMode, setIsLoginMode] = useState(true);
    const [isForgotMode, setIsForgotMode] = useState(false);


    const getErrorMessage = (error: unknown) => {
        const code = typeof error === 'object' && error !== null && 'code' in error
            ? String(error.code)
            : '';
        if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/invalid-email') {
            return "Email ou mot de passe incorrect.";
        }
        if (code === 'auth/user-not-found') {
            return "Aucun compte trouvé avec cet email.";
        }
        if (code === 'auth/email-already-in-use') {
            return "Cet email est déjà utilisé.";
        }
        if (code === 'auth/weak-password') {
            return "Le mot de passe est trop faible.";
        }
        if (code === 'auth/too-many-requests') {
            return "Trop de tentatives. Réessayez dans quelques minutes.";
        }
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
            return "Connexion Google annulée.";
        }
        if (code === 'auth/popup-blocked') {
            return "Le navigateur a bloqué la fenêtre Google. Autorisez les popups puis réessayez.";
        }
        if (code === 'auth/account-exists-with-different-credential') {
            return "Un compte existe déjà avec cet email. Connectez-vous d'abord avec votre mot de passe.";
        }
        if (code === 'auth/operation-not-allowed') {
            return "La connexion Google n'est pas encore activée dans Firebase.";
        }
        if (code === 'auth/google-ios-not-configured') {
            return "La connexion Google n'est pas encore configurée pour iOS.";
        }
        return "Une erreur est survenue. Veuillez réessayer.";
    };

    const navigateAfterAuthentication = () => {
        if (autoJoinRoomId) {
            router.replace({ pathname: '/lobby', params: { autoJoinRoomId } });
        } else {
            router.replace('/home');
        }
    };


    const handleForgotPassword = async () => {
        setErrorMessage('');
        setSuccessMessage('');
        if (!email) {
            setErrorMessage('Veuillez saisir votre adresse email.');
            return;
        }
        setIsLoading(true);
        try {
            await authService.sendPasswordReset(email);
            setSuccessMessage('Un lien de réinitialisation a été envoyé à ' + email);
        } catch (error: unknown) {
            setErrorMessage(getErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    };



    const handleAuthAction = async () => {
        setErrorMessage('');
        if (!email || !password) {
            setErrorMessage('Veuillez remplir tous les champs.');
            return;
        }

        setIsLoading(true);
        try {
            if (isLoginMode) {
                await authService.signIn(email, password);
                navigateAfterAuthentication();
            } else {
                if (password.length < 6) {
                    setErrorMessage('Le mot de passe doit contenir au moins 6 caractères.');
                    setIsLoading(false);
                    return;
                }
                await authService.signUp(email, password);
                navigateAfterAuthentication();
            }
        } catch (error: unknown) {
            LogService.error('LoginScreen', 'Email authentication failed', error);
            setErrorMessage(getErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    };

    const handleDevQuickLogin = async (testEmail: string) => {
        setEmail(testEmail);
        setPassword(testEmail);
        setErrorMessage('');
        setSuccessMessage('');
        setIsForgotMode(false);
        setIsLoginMode(true);
        setIsLoading(true);

        try {
            await authService.signIn(testEmail, testEmail);

            navigateAfterAuthentication();
        } catch (error: unknown) {
            LogService.error('LoginScreen', 'Development login failed', error);
            setErrorMessage(getErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleAuth = async () => {
        setErrorMessage('');
        setSuccessMessage('');
        setIsLoading(true);

        try {
            const user = await authService.signInWithGoogle();
            if (user) navigateAfterAuthentication();
        } catch (error: unknown) {
            setErrorMessage(getErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <LinearGradient
            colors={['#2D1B4E', '#1A0E2E']}
            style={[styles.container, { minHeight: height }]}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingTop: Math.max(insets.top, 10), paddingBottom: Math.max(insets.bottom, 10) }
                    ]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* TOP: Short Title */}
                    <Text style={styles.mainTitle}>DEVIENS UNE LÉGENDE !</Text>
                    
                    <View style={styles.contentWrapper}>
                        {/* MIDDLE: Free Account Card (Highly Compressed) */}
                        <LinearGradient
                            colors={['#1B5E20', '#0A330B']}
                            style={styles.authCard}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            {/* Single line benefits */}
                            <View style={styles.benefitsRow}>
                                <View style={styles.benefitItem}>
                                    <Ionicons name="globe-outline" size={14} color="#FFD700" />
                                    <Text style={styles.benefitText}>Multi</Text>
                                </View>
                                <View style={styles.benefitItem}>
                                    <Ionicons name="stats-chart" size={14} color="#FFD700" />
                                    <Text style={styles.benefitText}>Stats</Text>
                                </View>
                                <View style={styles.benefitItem}>
                                    <Ionicons name="cash" size={14} color="#FFD700" />
                                    <Text style={styles.benefitText}>Coins</Text>
                                </View>
                                <View style={styles.benefitItem}>
                                    <Ionicons name="trophy" size={14} color="#FFD700" />
                                    <Text style={styles.benefitText}>Gratuit</Text>
                                </View>
                            </View>

                            {/* Dense Form */}
                            <View style={styles.formContainer}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Email"
                                    placeholderTextColor="rgba(255,255,255,0.6)"
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />

                                {!isForgotMode && (
                                    <View style={styles.passwordContainer}>
                                        <TextInput
                                            style={styles.passwordInput}
                                            placeholder="Mot de passe"
                                            placeholderTextColor="rgba(255,255,255,0.6)"
                                            value={password}
                                            onChangeText={setPassword}
                                            secureTextEntry={!showPassword}
                                        />
                                        <TouchableOpacity
                                            style={styles.eyeIcon}
                                            onPress={() => setShowPassword(!showPassword)}
                                        >
                                            <Ionicons
                                                name={showPassword ? "eye-off" : "eye"}
                                                size={18}
                                                color="rgba(255,255,255,0.7)"
                                            />
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
                                {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

                                <TouchableOpacity
                                    style={styles.mainAuthButton}
                                    onPress={isForgotMode ? handleForgotPassword : handleAuthAction}
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color="#1a0505" size="small" />
                                    ) : (
                                        <Text style={styles.mainAuthButtonText}>
                                            {isForgotMode
                                                ? "ENVOYER LE LIEN"
                                                : isLoginMode ? "SE CONNECTER" : "CRÉER UN COMPTE"}
                                        </Text>
                                    )}
                                </TouchableOpacity>

                                {!isForgotMode && (
                                    <>
                                        <View style={styles.separatorRow}>
                                            <View style={styles.separatorLine} />
                                            <Text style={styles.separatorText}>OU</Text>
                                            <View style={styles.separatorLine} />
                                        </View>
                                        <TouchableOpacity
                                            style={styles.googleAuthButton}
                                            onPress={handleGoogleAuth}
                                            disabled={isLoading}
                                            accessibilityRole="button"
                                            accessibilityLabel="Continuer avec Google"
                                        >
                                            <Ionicons name="logo-google" size={18} color="#4285F4" />
                                            <Text style={styles.googleAuthButtonText}>CONTINUER AVEC GOOGLE</Text>
                                        </TouchableOpacity>
                                    </>
                                )}

                                {__DEV__ && isLoginMode && !isForgotMode && (
                                    <View style={styles.devQuickLoginBlock}>
                                        <Text style={styles.devQuickLoginTitle}>Connexion test locale</Text>
                                        <View style={styles.devQuickLoginRow}>
                                            {DEV_TEST_ACCOUNTS.map((account) => (
                                                <TouchableOpacity
                                                    key={account.email}
                                                    style={styles.devQuickLoginButton}
                                                    onPress={() => handleDevQuickLogin(account.email)}
                                                    disabled={isLoading}
                                                    activeOpacity={0.85}
                                                >
                                                    <Text style={styles.devQuickLoginButtonText}>{account.label}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                )}


                                {!isForgotMode && isLoginMode && (
                                    <TouchableOpacity
                                        style={styles.toggleModeButton}
                                        onPress={() => { setIsForgotMode(true); setErrorMessage(''); setSuccessMessage(''); }}
                                    >
                                        <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
                                    </TouchableOpacity>
                                )}

                                <TouchableOpacity
                                    style={styles.toggleModeButton}
                                    onPress={() => {
                                        setIsForgotMode(false);
                                        setErrorMessage('');
                                        setSuccessMessage('');
                                        if (!isForgotMode) setIsLoginMode(!isLoginMode);
                                    }}
                                >
                                    <Text style={styles.toggleModeText}>
                                        {isForgotMode
                                            ? "← Retour à la connexion"
                                            : isLoginMode
                                                ? "Créer un compte"
                                                : "Déjà un compte ? Connexion"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </LinearGradient>


                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 12,
    },
    mainTitle: {
        fontSize: 26,
        fontWeight: '900',
        color: '#F5F5DC', // Beige
        marginBottom: 12,
        textShadowColor: '#FFD700', // Gold shadow acts as a glowing border
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 8,
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    contentWrapper: {
        width: '100%',
        maxWidth: 400,
        gap: 12,
    },
    authCard: {
        borderRadius: 12,
        padding: 12,
        borderWidth: 2,
        borderColor: '#FFD700',
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 6,
    },
    benefitsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        backgroundColor: 'rgba(0,0,0,0.3)',
        padding: 6,
        borderRadius: 8,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.2)',
    },
    benefitItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    benefitText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    formContainer: {
        gap: 8,
    },
    input: {
        height: 40,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 14,
        color: '#FFFFFF',
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.3)',
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 40,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.3)',
    },
    passwordInput: {
        flex: 1,
        height: '100%',
        paddingHorizontal: 12,
        fontSize: 14,
        color: '#FFFFFF',
    },
    eyeIcon: {
        padding: 8,
    },
    mainAuthButton: {
        height: 42,
        backgroundColor: '#FFD700',
        borderRadius: 21,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 4,
    },
    mainAuthButtonText: {
        fontSize: 14,
        fontWeight: '900',
        color: '#0A330B',
    },
    devQuickLoginBlock: {
        marginTop: 8,
        gap: 8,
    },
    devQuickLoginTitle: {
        color: 'rgba(255,255,255,0.72)',
        fontSize: 11,
        fontWeight: '700',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 0.7,
    },
    devQuickLoginRow: {
        flexDirection: 'row',
        gap: 8,
    },
    devQuickLoginButton: {
        flex: 1,
        minHeight: 38,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.28)',
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
    },
    devQuickLoginButtonText: {
        color: '#FFD700',
        fontSize: 12,
        fontWeight: '800',
    },
    toggleModeButton: {
        alignItems: 'center',
        paddingVertical: 2,
    },
    toggleModeText: {
        color: '#FFD700',
        fontSize: 12,
        textDecorationLine: 'underline',
        fontWeight: '600',
    },
    errorText: {
        color: '#FF5252',
        textAlign: 'center',
        fontSize: 12,
        fontWeight: 'bold',
        backgroundColor: 'rgba(255, 82, 82, 0.2)',
        padding: 4,
        borderRadius: 4,
    },
    successText: {
        color: '#4CAF50',
        textAlign: 'center',
        fontSize: 12,
        fontWeight: 'bold',
        backgroundColor: 'rgba(76, 175, 80, 0.2)',
        padding: 4,
        borderRadius: 4,
    },
    forgotText: {
        color: 'rgba(255,215,0,0.7)',
        fontSize: 11,
        textAlign: 'center',
        fontWeight: '500',
    },
    separatorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginVertical: 2,
    },
    separatorLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    separatorText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 11,
        fontWeight: '600',
    },
    googleAuthButton: {
        minHeight: 42,
        backgroundColor: '#FFFFFF',
        borderRadius: 21,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
    },
    googleAuthButtonText: {
        color: '#202124',
        fontSize: 13,
        fontWeight: '800',
    },
});
