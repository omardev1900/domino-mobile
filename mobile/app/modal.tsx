
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Switch, ScrollView, useWindowDimensions, Modal as RNModal, TextInput, KeyboardAvoidingView, ActivityIndicator, Platform , Alert } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, usePathname } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authService } from '../src/core/services/auth.service';
import SettingsManager, { BgmTheme } from '../src/core/SettingsManager';
import SoundManager from '../src/core/audio/SoundManager';
import { TABLE_THEMES, TableTheme } from '../src/core/themes/tableThemes';
import { botService } from '../src/core/services/bot.service';
import Constants from 'expo-constants';

import { getAvatarImage, AvatarId, AVAILABLE_AVATARS } from '../src/core/avatars';
import { playerNameSchema } from '../src/core/validation/schemas';

const THEME_OPTIONS: { theme: TableTheme; label: string; icon: string }[] = [
  { theme: 'classic', label: 'Classique', icon: '🟢' },
  { theme: 'modern', label: 'Moderne', icon: '🔵' },
  { theme: 'luxury', label: 'Luxe', icon: '🔴' },
];

const BGM_OPTIONS: { theme: BgmTheme; label: string; icon: string }[] = [
  { theme: 'inGame', label: 'Musique en partie', icon: '🎵' },
  { theme: 'none', label: 'Silence', icon: '🔇' },
];

const VOLUMES = [
  { val: 0, label: '0%' },
  { val: 0.25, label: '25%' },
  { val: 0.5, label: '50%' },
  { val: 0.75, label: '75%' },
  { val: 1.0, label: '100%' },
];

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.3';

export default function ModalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const settings = SettingsManager.getSettings();
  const [sfxEnabled, setSfxEnabled] = useState(settings.isSfxEnabled);
  const [vibrationEnabled, setVibrationEnabled] = useState(settings.isVibrationEnabled);
  const [selectedTheme, setSelectedTheme] = useState<TableTheme>(settings.tableTheme);
  const [bgmTheme, setBgmTheme] = React.useState<BgmTheme>(settings.gameBgmTheme);
  const [bgmVolume, setBgmVolume] = React.useState(settings.bgmVolume);
  const [sfxVolume, setSfxVolume] = React.useState(settings.sfxVolume);
  const [activeTab, setActiveTab] = useState<'profil' | 'audio' | 'haptic' | 'account'>('profil');
  const pathname = usePathname();

  // Données profil
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileAvatar, setProfileAvatar] = useState<string>('avatar_default');

  useEffect(() => {
    authService.refreshUserFromStorage().then(user => {
      if (user) {
        setProfileName(user.displayName || 'Joueur');
        setProfileEmail(user.email || '');
        setProfileAvatar(user.avatarUrl || user.avatarId || 'avatar_default');
      }
    });
  }, []);

  // État du popup d'édition
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState<string>('avatar_default');
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const openEditModal = () => {
    setEditName(profileName);
    setEditAvatar(profileAvatar);
    setShowEditModal(true);
  };

  const saveProfile = async () => {
    setEditError(null);
    const result = playerNameSchema.safeParse(editName);
    if (!result.success) {
      setEditError(result.error.issues[0].message);
      return;
    }

    setIsSaving(true);
    try {
      await authService.updateProfile({ displayName: result.data, photoURL: editAvatar });
      setProfileName(result.data);
      setProfileAvatar(editAvatar);
      setShowEditModal(false);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de sauvegarder.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSfx = (val: boolean) => {
    setSfxEnabled(val);
    SettingsManager.setSfxEnabled(val);
    if (val) SoundManager.playSound('clack1');
  };

  const toggleVibration = (val: boolean) => {
    setVibrationEnabled(val);
    SettingsManager.setVibrationEnabled(val);
  };

  const selectTheme = (theme: TableTheme) => {
    setSelectedTheme(theme);
    SettingsManager.setTableTheme(theme);
  };

  const selectBgmTheme = (theme: BgmTheme) => {
    setBgmTheme(theme);
    SettingsManager.setGameBgmTheme(theme);

    // Si on est en partie, on applique le changement immédiatement
    if (pathname.startsWith('/game')) {
      if (theme === 'none') {
        SoundManager.stopMusic();
      } else {
        SoundManager.playMusic(theme, 0.5);
      }
    }
  };

  const changeBgmVolume = (val: number) => {
    setBgmVolume(val);
    SettingsManager.setBgmVolume(val);
    SoundManager.updateVolumes();
  };

  const changeSfxVolume = (val: number) => {
    setSfxVolume(val);
    SettingsManager.setSfxVolume(val);
    if (sfxEnabled) SoundManager.playSound('clack1');
  };

  const handleLogout = async () => {
    await authService.logout();
    router.dismissAll();
    router.replace('/login');
  };

  // ── Suppression de compte ──────────────────────────────────────────────────
  const [showDeleteStep1, setShowDeleteStep1] = useState(false);
  const [showDeleteStep2, setShowDeleteStep2] = useState(false);
  const [deleteEmailInput, setDeleteEmailInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openDeleteStep1 = () => {
    setDeleteEmailInput('');
    setDeleteError(null);
    setShowDeleteStep1(true);
  };

  const goToDeleteStep2 = () => {
    setShowDeleteStep1(false);
    setDeleteEmailInput('');
    setDeleteError(null);
    setShowDeleteStep2(true);
  };

  const confirmDelete = async () => {
    if (deleteEmailInput.trim().toLowerCase() !== profileEmail.toLowerCase()) {
      setDeleteError("L'email saisi ne correspond pas à votre compte.");
      return;
    }
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await authService.deleteAccount();
      router.dismissAll();
      router.replace('/login');
    } catch {
      setDeleteError('Une erreur est survenue. Réessaie ou contacte le support.');
      setIsDeleting(false);
    }
  };


  return (
    <View style={styles.container} aria-modal={true}>
      <LinearGradient
        colors={['#2D1B4E', '#1A0E2E']}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButtonHeader}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Paramètres</Text>
        <SidebarSpacer />
      </View>

      <View style={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            isLandscape && styles.scrollContentLandscape
          ]}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={[styles.mainBlock, isLandscape && styles.mainBlockLandscape]}>

            {/* TABS */}
            <View style={styles.tabBar}>
              <TouchableOpacity style={[styles.tabItem, activeTab === 'profil' && styles.activeTabItem]} onPress={() => setActiveTab('profil')}>
                <Text style={[styles.tabText, activeTab === 'profil' && styles.activeTabText]}>PROFIL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tabItem, activeTab === 'audio' && styles.activeTabItem]} onPress={() => setActiveTab('audio')}>
                <Text style={[styles.tabText, activeTab === 'audio' && styles.activeTabText]}>AUDIO</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tabItem, activeTab === 'haptic' && styles.activeTabItem]} onPress={() => setActiveTab('haptic')}>
                <Text style={[styles.tabText, activeTab === 'haptic' && styles.activeTabText]}>HAPTIQUE</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tabItem, activeTab === 'account' && styles.activeTabItem]} onPress={() => setActiveTab('account')}>
                <Text style={[styles.tabText, activeTab === 'account' && styles.activeTabText]}>COMPTE</Text>
              </TouchableOpacity>
            </View>

            {activeTab === 'profil' && (
              <View style={styles.section}>
                {/* Avatar + infos */}
                <View style={styles.profileCard}>
                  <View style={styles.profileAvatarWrapper}>
                    <Image
                      source={getAvatarImage(profileAvatar as AvatarId)}
                      style={styles.profileAvatarImg}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  </View>
                  <View style={styles.profileInfo}>
                    <Text style={styles.profileName} numberOfLines={1}>{profileName}</Text>
                    {profileEmail ? (
                      <Text style={styles.profileEmail} numberOfLines={1}>{profileEmail}</Text>
                    ) : null}
                  </View>
                </View>

                {/* Bouton modifier */}

              </View>
            )}

            {activeTab === 'audio' && (
              <View style={styles.audioTabContainer}>
                {/* COLUMN LEFT: SFX */}
                <View style={styles.audioColumn}>
                  <View style={styles.columnHeader}>
                    <Text style={styles.columnTitle}>BRUITAGES</Text>
                    <Switch
                      value={sfxEnabled}
                      onValueChange={toggleSfx}
                      trackColor={{ false: "#333", true: "#4CAF50" }}
                      thumbColor={sfxEnabled ? "#fff" : "#f4f3f4"}
                      style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                    />
                  </View>

                  <View style={styles.columnContent}>
                    <Text style={styles.miniLabel}>Volume</Text>
                    <View style={styles.compactVolumeRow}>
                      {VOLUMES.map(v => (
                        <TouchableOpacity
                          key={`sfx-${v.val}`}
                          style={[styles.miniVolBtn, sfxVolume === v.val && styles.volBtnActive]}
                          onPress={() => changeSfxVolume(v.val)}
                          disabled={!sfxEnabled}
                        >
                          <Text style={[styles.miniVolText, sfxVolume === v.val && styles.volBtnTextActive]}>{v.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                {/* VERTICAL DIVIDER */}
                <View style={styles.verticalDivider} />

                {/* COLUMN RIGHT: BGM */}
                <View style={[styles.audioColumn, { flex: 1.2 }]}>
                  <View style={styles.columnHeader}>
                    <Text style={styles.columnTitle}>MUSIQUE</Text>
                  </View>

                  <View style={styles.columnContent}>
                    <View style={styles.compactBgmRow}>
                      {BGM_OPTIONS.map(({ theme, icon }) => (
                        <TouchableOpacity
                          key={theme}
                          style={[styles.miniBgmOption, bgmTheme === theme && styles.bgmOptionSelected]}
                          onPress={() => selectBgmTheme(theme)}
                        >
                          <Text style={[styles.miniBgmIcon, bgmTheme === theme && styles.bgmIconSelected]}>{icon}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={[styles.miniLabel, { marginTop: 8 }]}>Volume</Text>
                    <View style={styles.compactVolumeRow}>
                      {VOLUMES.map(v => (
                        <TouchableOpacity
                          key={`bgm-${v.val}`}
                          style={[styles.miniVolBtn, bgmVolume === v.val && styles.volBtnActive]}
                          onPress={() => changeBgmVolume(v.val)}
                          disabled={bgmTheme === 'none'}
                        >
                          <Text style={[styles.miniVolText, bgmVolume === v.val && styles.volBtnTextActive]}>{v.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              </View>
            )}

            {activeTab === 'haptic' && (
              <View style={styles.section}>
                <View style={styles.row}>
                  <View>
                    <Text style={styles.label}>Vibrations</Text>
                    <Text style={styles.hint}>Retours tactiles</Text>
                  </View>
                  <Switch
                    value={vibrationEnabled}
                    onValueChange={toggleVibration}
                    trackColor={{ false: "#333", true: "#4CAF50" }}
                    thumbColor={vibrationEnabled ? "#fff" : "#f4f3f4"}
                  />
                </View>
              </View>
            )}

            {activeTab === 'account' && (
              <View style={styles.section}>
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                  <Text style={styles.logoutText}>🚪 Se déconnecter</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteAccountButton} onPress={openDeleteStep1}>
                  <Text style={styles.deleteAccountText}>🗑️ Supprimer mon compte</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.versionText}>Version {APP_VERSION}</Text>
          </View>
        </ScrollView>
      </View>

      {/* ── Popup d'édition du profil ── */}
      <RNModal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <TouchableOpacity
            style={editStyles.backdrop}
            activeOpacity={1}
            onPress={() => setShowEditModal(false)}
          />
          <View style={editStyles.sheet}>
            {/* Header */}
            <View style={editStyles.sheetHeader}>
              <Text style={editStyles.sheetTitle}>Modifier le profil</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>

            {/* Avatar prévisualisation + grille */}
            <View style={editStyles.avatarPreviewRow}>
              <View style={editStyles.avatarPreviewCircle}>
                <Image
                  source={getAvatarImage(editAvatar as AvatarId)}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              </View>
              <View style={editStyles.avatarGrid}>
                {AVAILABLE_AVATARS.map(av => (
                  <TouchableOpacity
                    key={av}
                    style={[editStyles.avatarOption, editAvatar === av && editStyles.avatarOptionSelected]}
                    onPress={() => setEditAvatar(av)}
                  >
                    <Image
                      source={getAvatarImage(av as AvatarId)}
                      style={editStyles.avatarOptionImg}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Nom */}
            <Text style={editStyles.fieldLabel}>PSEUDO</Text>
            <TextInput
              style={[editStyles.nameInput, editError && { borderColor: '#FF3B30', borderWidth: 1 }]}
              value={editName}
              onChangeText={(text) => {
                setEditName(text);
                if (editError) setEditError(null);
              }}
              placeholder="Votre pseudo"
              placeholderTextColor="rgba(255,255,255,0.3)"
              maxLength={20}
              returnKeyType="done"
              autoCapitalize="words"
            />
            {editError ? <Text style={editStyles.errorText}>{editError}</Text> : null}

            {/* Bouton Enregistrer */}
            <TouchableOpacity
              style={[editStyles.saveBtn, isSaving && { opacity: 0.7 }]}
              onPress={saveProfile}
              disabled={isSaving}
            >
              {isSaving
                ? <ActivityIndicator color="#1A0E2E" />
                : <>
                  <Ionicons name="save" size={18} color="#1A0E2E" style={{ marginRight: 8 }} />
                  <Text style={editStyles.saveBtnText}>ENREGISTRER</Text>
                </>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </RNModal>

      {/* ── Modal suppression étape 1 : avertissement ── */}
      <RNModal visible={showDeleteStep1} transparent animationType="fade" onRequestClose={() => setShowDeleteStep1(false)}>
        <View style={deleteStyles.backdrop}>
          <View style={deleteStyles.card}>
            <Text style={deleteStyles.title}>⚠️ Supprimer mon compte</Text>
            <Text style={deleteStyles.body}>
              Cette action est <Text style={deleteStyles.bold}>définitive et irréversible</Text>.{'\n\n'}
              Toutes tes données seront effacées : profil, stats, coins, progression ligue.{'\n\n'}
              Es-tu sûr de vouloir continuer ?
            </Text>
            <View style={deleteStyles.btnRow}>
              <TouchableOpacity style={deleteStyles.cancelBtn} onPress={() => setShowDeleteStep1(false)}>
                <Text style={deleteStyles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={deleteStyles.continueBtn} onPress={goToDeleteStep2}>
                <Text style={deleteStyles.continueText}>Continuer →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </RNModal>

      {/* ── Modal suppression étape 2 : confirmation par email ── */}
      <RNModal visible={showDeleteStep2} transparent animationType="fade" onRequestClose={() => setShowDeleteStep2(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={deleteStyles.backdrop}>
            <View style={deleteStyles.card}>
              <Text style={deleteStyles.title}>🗑️ Confirmation finale</Text>
              <Text style={deleteStyles.body}>
                Tape ton adresse email pour confirmer la suppression de ton compte.
              </Text>
              <TextInput
                style={[deleteStyles.input, deleteError ? { borderColor: '#FF3B30' } : null]}
                value={deleteEmailInput}
                onChangeText={text => { setDeleteEmailInput(text); setDeleteError(null); }}
                placeholder={profileEmail || 'ton@email.com'}
                placeholderTextColor="rgba(255,255,255,0.25)"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {deleteError ? <Text style={deleteStyles.errorText}>{deleteError}</Text> : null}
              <View style={deleteStyles.btnRow}>
                <TouchableOpacity style={deleteStyles.cancelBtn} onPress={() => setShowDeleteStep2(false)}>
                  <Text style={deleteStyles.cancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[deleteStyles.deleteBtn, (isDeleting || !deleteEmailInput) && { opacity: 0.5 }]}
                  onPress={confirmDelete}
                  disabled={isDeleting || !deleteEmailInput}
                >
                  {isDeleting
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={deleteStyles.deleteText}>Supprimer définitivement</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </RNModal>

    </View>
  );
}

const SidebarSpacer = () => <View style={{ width: 44 }} />;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 70,
  },
  backButtonHeader: {
    padding: 10,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    gap: 20,
  },
  scrollContentLandscape: {
    alignItems: 'center',
  },
  mainBlock: {
    width: '100%',
    alignItems: 'center', // Center tabs and sections in landscape
    gap: 10,
  },
  mainBlockLandscape: {
    maxWidth: 600,
    width: '100%',
  },
  section: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFD700',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 20,
    opacity: 0.8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  label: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '500',
  },
  hint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
    marginTop: 10,
  },
  logoutText: {
    color: '#FF3B30',
    fontWeight: 'bold',
    fontSize: 16,
  },
  deleteAccountButton: {
    backgroundColor: 'rgba(120, 0, 0, 0.18)',
    padding: 16,
    borderRadius: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(180, 0, 0, 0.3)',
    marginTop: 12,
  },
  deleteAccountText: {
    color: '#CC0000',
    fontWeight: '600',
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginVertical: 12,
  },
  // ─── Audio ───────────────────────────────────────────────
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    marginBottom: 10,
  },
  volumeLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'rgba(255,255,255,0.6)',
    marginRight: 10,
    width: 30,
  },
  volumeControls: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  volBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  volBtnActive: {
    backgroundColor: '#4CAF50',
  },
  volBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: 'rgba(255,255,255,0.5)',
  },
  volBtnTextActive: {
    color: '#fff',
  },
  bgmSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingBottom: 12,
    backgroundColor: 'transparent',
  },
  bgmOption: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    opacity: 0.4,
  },
  bgmOptionSelected: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    opacity: 1,
  },
  bgmIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  bgmIconSelected: {
    transform: [{ scale: 1.1 }],
  },
  bgmLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: 'bold',
  },
  bgmLabelSelected: {
    color: '#4CAF50',
  },
  // ─── Audio Tab Refactor (2 Columns) ─────────────────────
  audioTabContainer: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 16,
    minHeight: 140,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  audioColumn: {
    flex: 1,
    paddingHorizontal: 4,
  },
  columnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    height: 30,
  },
  columnTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFD700',
    letterSpacing: 1,
  },
  columnContent: {
    gap: 6,
  },
  verticalDivider: {
    width: 1,
    backgroundColor: 'rgba(255,215,0,0.1)',
    marginHorizontal: 8,
  },
  miniLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  compactVolumeRow: {
    flexDirection: 'row',
    gap: 4,
  },
  miniVolBtn: {
    flex: 1,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  miniVolText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: 'rgba(255,255,255,0.4)',
  },
  compactBgmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  miniBgmOption: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  miniBgmIcon: {
    fontSize: 16,
  },
  // ─── Theme Selector ─────────────────────────────────────
  themeGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 14,
    borderRadius: 12,
  },
  themeOption: {
    alignItems: 'center',
    gap: 6,
    opacity: 0.5,
  },
  themeOptionSelected: {
    opacity: 1,
  },
  themePreview: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  themeIcon: {
    fontSize: 24,
  },
  themeLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
  },
  themeLabelSelected: {
    color: '#FFD700',
    fontWeight: 'bold',
  },
  versionText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.2)',
    textAlign: 'center',
    marginTop: 15,
  },
  // ─── Tabs ───────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.1)',
    width: '100%',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTabItem: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  tabText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
  },
  activeTabText: {
    color: '#FFD700',
  },
  // ─── Profil Tab ─────────────────────────────────────────
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.15)',
  },
  profileAvatarWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFD700',
    backgroundColor: '#2D1B4E',
  },
  profileAvatarImg: {
    width: '100%',
    height: '100%',
  },
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  profileEmail: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    fontStyle: 'italic',
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD700',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: 'center',
    minWidth: 200,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  editProfileBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1A0E2E',
    letterSpacing: 1.5,
  },
});

const editStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#1A0E2E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
    gap: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFD700',
    letterSpacing: 1,
  },
  avatarPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarPreviewCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFD700',
    backgroundColor: '#2D1B4E',
    flexShrink: 0,
  },
  avatarGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  avatarOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  avatarOptionSelected: {
    borderColor: '#FFD700',
  },
  avatarOptionImg: {
    width: '100%',
    height: '100%',
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: 'rgba(255,215,0,0.7)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  nameInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.25)',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD700',
    borderRadius: 25,
    height: 50,
    marginTop: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1A0E2E',
    letterSpacing: 1.5,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 8,
    marginLeft: 4,
  },
});

const deleteStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#1A0A0A',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(200,0,0,0.3)',
    gap: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 21,
    textAlign: 'center',
  },
  bold: {
    fontWeight: '800',
    color: '#FF4444',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 13,
    textAlign: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
  },
  cancelText: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    fontSize: 14,
  },
  continueBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(200,80,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,120,0,0.4)',
    alignItems: 'center',
  },
  continueText: {
    color: '#FFB347',
    fontWeight: '700',
    fontSize: 14,
  },
  deleteBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#8B0000',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  deleteText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
});

