
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    updateProfile as updateFirebaseProfile,
    User
} from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth } from './firebase';
import { PlayerProfile } from '../types';
import { statsService } from './stats.service';
import { economyService } from './economy.service';
import { LogService } from './LogService';
import { playerNameSchema } from '../validation/schemas';
import { AVATAR_IMAGES } from '../avatars';

const STORAGE_KEY_SESSION = '@user_session_active';

class AuthService {
    private currentUser: PlayerProfile | null = null;

    /**
     * Send password reset email
     */
    async sendPasswordReset(email: string): Promise<void> {
        try {
            await sendPasswordResetEmail(auth, email);
            LogService.info('AuthService', `Password reset email sent to: ${email}`);
        } catch (error) {
            LogService.error('AuthService', 'sendPasswordReset error:', error);
            throw error;
        }
    }

    /**
     * Firebase Sign In
     */
    async signIn(email: string, pass: string): Promise<PlayerProfile> {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, pass);
            const user = userCredential.user;

            const profile = this.mapFirebaseUserToProfile(user);
            await this.activateSession(profile);
            await statsService.useStorageScope(profile.uid);
            await economyService.useStorageScope(profile.uid);
            await statsService.syncWithFirebase(profile.uid);
            await economyService.syncFromFirebase(profile.uid);
            await economyService.syncProfileMetadata(
                profile.uid,
                profile.displayName,
                profile.avatarId || 'avatar_default'
            );
            return profile;
        } catch (error) {
            LogService.error('AuthService', 'Sign In Error:', error);
            throw error;
        }
    }

    /**
     * Firebase Sign Up
     */
    async signUp(email: string, pass: string): Promise<PlayerProfile> {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
            const user = userCredential.user;

            const profile = this.mapFirebaseUserToProfile(user);
            await this.activateSession(profile);
            await statsService.useStorageScope(profile.uid);
            await economyService.useStorageScope(profile.uid);
            
            // Pour un nouveau compte, on initialise explicitement la base de données avec des valeurs par défaut
            const defaultStats = await statsService.getStats();
            await statsService.pushStatsToFirebase(profile.uid, defaultStats);
            
            const defaultEconomy = await economyService.getEconomy();
            await economyService.pushToFirebase(profile.uid, defaultEconomy);

            // 🛡️ BUG-WELCOME-COINS : Protège les coins de bienvenue contre la race condition
            // où syncFromFirebase (déclenché par home.tsx) lirait Firestore avant que
            // la propagation soit complète, et écraserait les coins à 0 ou une valeur vide.
            await AsyncStorage.setItem(
                '@new_player_coins_protected',
                String(defaultEconomy.coins)
            );
            LogService.info('AuthService', `[BUG-WELCOME-COINS] Flag de protection posé: ${defaultEconomy.coins} coins.`);
            
            await economyService.syncProfileMetadata(
                profile.uid,
                profile.displayName,
                profile.avatarId || 'avatar_default'
            );
            return profile;
        } catch (error) {
            LogService.error('AuthService', 'Sign Up Error:', error);
            throw error;
        }
    }

    private mapFirebaseUserToProfile(user: User): PlayerProfile {
        return {
            uid: user.uid,
            displayName: user.displayName || user.email?.split('@')[0] || 'Joueur',
            email: user.email || undefined,
            avatarUrl: user.photoURL || undefined,
            avatarId: user.photoURL || 'avatar_default',
            gamesPlayed: 0,
            gamesWon: 0
        };
    }

    /**
     * Mark session as active and update memory
     */
    private async activateSession(user: PlayerProfile): Promise<void> {
        try {
            await AsyncStorage.setItem(STORAGE_KEY_SESSION, 'true');
            this.currentUser = { ...user };
            LogService.info('AuthService', `Session activated for: ${user.uid} (${user.displayName})`);
        } catch (error) {
            LogService.error('AuthService', 'Failed to activate session', error);
        }
    }

    /**
     * Get current logged in user
     * Priority: 1. Memory, 2. Firebase (authenticated non-anonymous only)
     */
    async getCurrentUser(): Promise<PlayerProfile | null> {
        if (this.currentUser) {
            await statsService.useStorageScope(this.currentUser.uid);
            await economyService.useStorageScope(this.currentUser.uid);
            return this.currentUser;
        }

        try {
            const firebaseUser = await new Promise<User | null>((resolve) => {
                const timer = setTimeout(() => {
                    LogService.warn('AuthService', 'onAuthStateChanged timeout — treating as logged out');
                    resolve(null);
                }, 5000);
                const unsubscribe = auth.onAuthStateChanged((user) => {
                    clearTimeout(timer);
                    unsubscribe();
                    resolve(user);
                });
            });

            // Rejeter les users anonymes et sans email — ce sont des ghosts
            if (firebaseUser && !firebaseUser.isAnonymous && firebaseUser.email) {
                // Synchroniser le marqueur local avec la réalité Firebase
                await AsyncStorage.setItem(STORAGE_KEY_SESSION, 'true');
                this.currentUser = this.mapFirebaseUserToProfile(firebaseUser);
                await statsService.useStorageScope(this.currentUser.uid);
                await economyService.useStorageScope(this.currentUser.uid);
                
                try {
                    // VERIFICATION STRICTE : on force la récupération des données sécurisées.
                    // Si cela échoue (ex: réseau instable), on bloque la connexion.
                    await statsService.syncWithFirebase(this.currentUser.uid);
                    await economyService.syncFromFirebase(this.currentUser.uid);
                } catch (syncError) {
                    LogService.error('AuthService', 'Échec de synchronisation au démarrage, blocage de la connexion par sécurité.', syncError);
                    this.currentUser = null;
                    await AsyncStorage.removeItem(STORAGE_KEY_SESSION);
                    await statsService.useStorageScope(null);
                    await economyService.useStorageScope(null);
                    return null;
                }
                
                return this.currentUser;
            }

            // User invalide ou anonyme → nettoyer toute trace locale
            if (firebaseUser?.isAnonymous || (firebaseUser && !firebaseUser.email)) {
                LogService.warn('AuthService', 'Ghost/anonymous session detected — forcing sign out');
                await AsyncStorage.removeItem(STORAGE_KEY_SESSION);
                await statsService.useStorageScope(null);
                await economyService.useStorageScope(null);
                try { await signOut(auth); } catch (_) {}
            } else {
                // Pas de user Firebase du tout → juste nettoyer le marqueur
                await AsyncStorage.removeItem(STORAGE_KEY_SESSION);
                await statsService.useStorageScope(null);
                await economyService.useStorageScope(null);
            }
        } catch (error) {
            LogService.error('AuthService', 'getCurrentUser error:', error);
        }

        return null;
    }

    /**
     * Refresh user data (forces reload from storage)
     */
    async refreshUserFromStorage(): Promise<PlayerProfile | null> {
        this.currentUser = null;
        return this.getCurrentUser();
    }

    /**
     * Logout
     */
    async logout(): Promise<void> {
        this.currentUser = null;
        // Nettoyer le marqueur local en premier — même si signOut échoue, on ne laisse pas de ghost
        try {
            await AsyncStorage.removeItem(STORAGE_KEY_SESSION);
        } catch (error) {
            LogService.error('AuthService', 'Failed to clear session storage', error);
        }
        try {
            await signOut(auth);
        } catch (error) {
            LogService.error('AuthService', 'Failed to sign out from Firebase', error);
        }
        await statsService.useStorageScope(null);
        await economyService.useStorageScope(null);
    }

    /**
     * Suppression définitive du compte.
     * Appelle la Cloud Function deleteUserAccount qui purge Firestore puis supprime Firebase Auth.
     * Le logout local est effectué après confirmation serveur.
     */
    async deleteAccount(): Promise<void> {
        const functions = getFunctions();
        const deleteUserAccount = httpsCallable(functions, 'deleteUserAccount');
        await deleteUserAccount({});
        // Nettoyage local après suppression serveur réussie
        this.currentUser = null;
        try { await AsyncStorage.removeItem(STORAGE_KEY_SESSION); } catch (_) {}
        try { await signOut(auth); } catch (_) {}
        await statsService.useStorageScope(null);
        await economyService.useStorageScope(null);
    }

    /**
     * Update user stats
     */
    async updateStats(stats: Partial<PlayerProfile>): Promise<void> {
        const user = await this.getCurrentUser();
        if (!user) return;

        this.currentUser = { ...user, ...stats };
    }

    /**
     * Update User Profile (Unified)
     */
    async updateProfile(updates: { displayName?: string; photoURL?: string }): Promise<void> {
        const user = await this.getCurrentUser();
        if (!user) {
            LogService.warn('AuthService', 'updateProfile: No user logged in');
            return;
        }

        // 1. Prepare updates
        const profileUpdates: Partial<PlayerProfile> = {};

        if (updates.displayName !== undefined && updates.displayName !== null) {
            const nameResult = playerNameSchema.safeParse(updates.displayName);
            if (!nameResult.success) throw new Error(nameResult.error.issues[0].message);
            profileUpdates.displayName = nameResult.data;
        }

        if (updates.photoURL) {
            const isKnownAvatarId = updates.photoURL in AVATAR_IMAGES;
            const isAllowedUrl = updates.photoURL.startsWith('https://firebasestorage.googleapis.com') ||
                updates.photoURL.startsWith('https://lh3.googleusercontent.com');
            if (!isKnownAvatarId && !isAllowedUrl) {
                throw new Error('Avatar invalide');
            }
            profileUpdates.avatarUrl = updates.photoURL;
            profileUpdates.avatarId = updates.photoURL;
        }

        // 2. Update memory state immediately
        this.currentUser = { ...user, ...profileUpdates };

        try {
            // 3. Persist Firebase Profile
            if (auth.currentUser) {
                await updateFirebaseProfile(auth.currentUser, {
                    displayName: updates.displayName,
                    photoURL: updates.photoURL
                });
                LogService.info('AuthService', 'Firebase profile updated');

                // Sync profile metadata to Firestore users collection and monthly stats
                await economyService.syncProfileMetadata(
                    user.uid,
                    this.currentUser.displayName,
                    this.currentUser.avatarId || 'avatar_default'
                );
            }
        } catch (error) {
            LogService.error('AuthService', 'updateProfile error:', error);
            throw error;
        }
    }
}

export const authService = new AuthService();
