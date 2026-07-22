jest.mock('expo-audio', () => ({
    createAudioPlayer: jest.fn((source: unknown) => ({
        source,
        loop: false,
        volume: 0,
        playing: false,
        play: jest.fn(function (this: any) {
            this.playing = true;
            return Promise.resolve();
        }),
        pause: jest.fn(function (this: any) {
            this.playing = false;
        }),
        seekTo: jest.fn(),
        remove: jest.fn(),
    })),
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('firebase/firestore', () => ({
    doc: jest.fn(),
    getDoc: jest.fn().mockResolvedValue({ exists: () => false }),
}));

jest.mock('../../services/firebase', () => ({
    db: {},
}));

jest.mock('../../SettingsManager', () => ({
    __esModule: true,
    default: {
        getSettings: jest.fn(() => ({
            isAudioEnabled: true,
            isBgmEnabled: true,
            isSfxEnabled: true,
            sfxVolume: 1,
            bgmVolume: 1,
            gameBgmTheme: 'inGame',
        })),
        setAudioEnabled: jest.fn().mockResolvedValue(undefined),
        setBgmEnabled: jest.fn().mockResolvedValue(undefined),
        setSfxEnabled: jest.fn().mockResolvedValue(undefined),
    },
}));

describe('SoundManager priority policy', () => {
    let SoundManager: any;

    beforeEach(async () => {
        jest.resetModules();
        jest.clearAllMocks();
        SoundManager = require('../SoundManager').default;
        await SoundManager.dispose();
        await SoundManager.preloadSounds();
    });

    afterAll(async () => {
        if (SoundManager) {
            await SoundManager.dispose();
        }
    });

    test('blocks lower-priority gameplay SFX while a major stinger is active', async () => {
        await SoundManager.playSound('matchEnd');
        await SoundManager.playSound('clack1');

        expect(SoundManager.sounds.matchEnd.play).toHaveBeenCalledTimes(1);
        expect(SoundManager.sounds.clack1.play).not.toHaveBeenCalled();
    });

    test('prevents two terminal stingers from overlapping in the same exclusive group', async () => {
        await SoundManager.playSound('roundEnd');
        await SoundManager.playSound('matchEnd');

        expect(SoundManager.sounds.roundEnd.play).toHaveBeenCalledTimes(1);
        expect(SoundManager.sounds.matchEnd.play).not.toHaveBeenCalled();
    });

    test('applies a softer mix gain to timer than to match-end stingers', async () => {
        await SoundManager.playSound('timer');
        expect(SoundManager.sounds.timer.volume).toBeCloseTo(0.28, 2);

        await SoundManager.dispose();
        await SoundManager.preloadSounds();

        await SoundManager.playSound('matchEnd');
        expect(SoundManager.sounds.matchEnd.volume).toBeCloseTo(0.74, 2);
    });

    test('loads applause as a softer celebration tail than the main league jingle', async () => {
        await SoundManager.playSound('leagueJingle');
        expect(SoundManager.sounds.leagueJingle.volume).toBeCloseTo(0.66, 2);

        await SoundManager.dispose();
        await SoundManager.preloadSounds();

        await SoundManager.playSound('applause');
        expect(SoundManager.sounds.applause.play).toHaveBeenCalledTimes(1);
        expect(SoundManager.sounds.applause.volume).toBeCloseTo(0.5, 2);
    });

    test('can mute BGM without muting SFX', async () => {
        const SettingsManager = require('../../SettingsManager').default;
        await SoundManager.playMusic('inGame');
        expect(SoundManager.sounds.inGame.play).toHaveBeenCalled();

        SettingsManager.getSettings.mockReturnValue({
            isAudioEnabled: true,
            isBgmEnabled: false,
            isSfxEnabled: true,
            sfxVolume: 1,
            bgmVolume: 1,
            gameBgmTheme: 'inGame',
        });

        await SoundManager.setBgmEnabled(false);
        expect(SoundManager.sounds.inGame.pause).toHaveBeenCalled();

        await SoundManager.playSound('clack1');
        expect(SoundManager.sounds.clack1.play).toHaveBeenCalled();
    });

    test('tolerates web players whose play() returns void', async () => {
        SoundManager.sounds.appActive.play = jest.fn(() => undefined);
        await expect(SoundManager.playMusic('appActive')).resolves.toBeUndefined();
    });

    test('uses one bundled app-active variant per session and a dedicated in-game track', async () => {
        const appActiveSource = SoundManager.sounds.appActive.source;
        const inGameSource = SoundManager.sounds.inGame.source;
        const appActiveVariants = [
            require('../../../assets/sounds/bgm/bgm-app-active-a.mp3'),
            require('../../../assets/sounds/bgm/bgm-app-active-b.mp3'),
        ];

        expect(appActiveVariants).toContain(appActiveSource);
        expect(inGameSource).toBe(require('../../../assets/sounds/bgm/bgm-in-game.mp3'));
    });
});
