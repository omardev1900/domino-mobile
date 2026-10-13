import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
    getAdditionalUserInfo,
    GoogleAuthProvider,
    signInWithCredential,
    signInWithPopup,
    type UserCredential,
} from 'firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { authService } from '../auth.service';

jest.mock('../stats.service', () => ({
    statsService: {
        useStorageScope: jest.fn(),
        syncWithFirebase: jest.fn(),
        getStats: jest.fn(),
        pushStatsToFirebase: jest.fn(),
    },
}));
jest.mock('../economy.service', () => ({
    economyService: {
        useStorageScope: jest.fn(),
        syncFromFirebase: jest.fn(),
        getEconomy: jest.fn(),
        pushToFirebase: jest.fn(),
        syncProfileMetadata: jest.fn(),
    },
}));
jest.mock('../firebase', () => ({ auth: {} }));
jest.mock('../LogService', () => ({
    LogService: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../avatars', () => ({ AVATAR_IMAGES: {} }));

const { statsService: mockStatsService } = jest.requireMock('../stats.service');
const { economyService: mockEconomyService } = jest.requireMock('../economy.service');

const mockSignInWithPopup = signInWithPopup as jest.MockedFunction<typeof signInWithPopup>;
const mockSignInWithCredential = signInWithCredential as jest.MockedFunction<typeof signInWithCredential>;
const mockGetAdditionalUserInfo = getAdditionalUserInfo as jest.MockedFunction<typeof getAdditionalUserInfo>;
const mockGoogleCredential = GoogleAuthProvider.credential as jest.MockedFunction<typeof GoogleAuthProvider.credential>;
const mockGoogleConfigure = GoogleSignin.configure as jest.MockedFunction<typeof GoogleSignin.configure>;
const mockGoogleHasPlayServices = GoogleSignin.hasPlayServices as jest.MockedFunction<typeof GoogleSignin.hasPlayServices>;
const mockGoogleSignIn = GoogleSignin.signIn as jest.MockedFunction<typeof GoogleSignin.signIn>;
const mockGoogleGetTokens = GoogleSignin.getTokens as jest.MockedFunction<typeof GoogleSignin.getTokens>;

const googleUserCredential = {
    user: {
        uid: 'google-uid',
        email: 'joueur@gmail.com',
        displayName: 'Joueur Google',
        photoURL: 'https://lh3.googleusercontent.com/avatar',
    },
} as unknown as UserCredential;

describe('AuthService Google', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
        mockStatsService.getStats.mockResolvedValue({ gamesPlayed: 0 });
        mockEconomyService.getEconomy.mockResolvedValue({ coins: 100 });
    });

    it('connecte un compte Google existant sur le web et synchronise ses données', async () => {
        mockSignInWithPopup.mockResolvedValue(googleUserCredential);
        mockGetAdditionalUserInfo.mockReturnValue({ isNewUser: false });

        const profile = await authService.signInWithGoogle();

        expect(mockSignInWithPopup).toHaveBeenCalledTimes(1);
        expect(profile).toMatchObject({
            uid: 'google-uid',
            email: 'joueur@gmail.com',
            displayName: 'Joueur Google',
        });
        expect(mockStatsService.syncWithFirebase).toHaveBeenCalledWith('google-uid');
        expect(mockEconomyService.syncFromFirebase).toHaveBeenCalledWith('google-uid');
        expect(mockEconomyService.syncProfileMetadata).toHaveBeenCalledWith(
            'google-uid',
            'Joueur Google',
            'avatar_default'
        );
    });

    it('initialise les données et protège les coins lors de la création Google', async () => {
        mockSignInWithPopup.mockResolvedValue(googleUserCredential);
        mockGetAdditionalUserInfo.mockReturnValue({ isNewUser: true });

        await authService.signInWithGoogle();

        expect(mockStatsService.pushStatsToFirebase).toHaveBeenCalledWith(
            'google-uid',
            { gamesPlayed: 0 }
        );
        expect(mockEconomyService.pushToFirebase).toHaveBeenCalledWith(
            'google-uid',
            { coins: 100 }
        );
        expect(AsyncStorage.setItem).toHaveBeenCalledWith('@new_player_coins_protected', '100');
        expect(mockStatsService.syncWithFirebase).not.toHaveBeenCalled();
    });

    it('échange les jetons Google natifs contre un credential Firebase sur Android', async () => {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
        mockGoogleHasPlayServices.mockResolvedValue(true);
        mockGoogleSignIn.mockResolvedValue({
            type: 'success',
            data: { idToken: 'native-id-token' },
        });
        mockGoogleGetTokens.mockResolvedValue({
            idToken: 'native-id-token',
            accessToken: 'native-access-token',
        });
        mockSignInWithCredential.mockResolvedValue(googleUserCredential);
        mockGetAdditionalUserInfo.mockReturnValue({ isNewUser: false });

        await authService.signInWithGoogle();

        expect(mockGoogleConfigure).toHaveBeenCalledWith({});
        expect(mockGoogleHasPlayServices).toHaveBeenCalledWith({
            showPlayServicesUpdateDialog: true,
        });
        expect(mockGoogleCredential).toHaveBeenCalledWith(
            'native-id-token',
            'native-access-token'
        );
        expect(mockSignInWithCredential).toHaveBeenCalledWith(
            {},
            { providerId: 'google.com' }
        );
    });

    it('ne crée pas de session si le sélecteur Google natif est annulé', async () => {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
        mockGoogleHasPlayServices.mockResolvedValue(true);
        mockGoogleSignIn.mockResolvedValue({ type: 'cancelled', data: null });

        await expect(authService.signInWithGoogle()).resolves.toBeNull();
        expect(mockGoogleGetTokens).not.toHaveBeenCalled();
        expect(mockSignInWithCredential).not.toHaveBeenCalled();
    });
});
