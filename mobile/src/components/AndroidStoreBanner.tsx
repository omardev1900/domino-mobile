/**
 * AndroidStoreBanner
 *
 * Shown on web to Android users as a non-blocking suggestion to download
 * the native app. Replaces the old forced redirect.
 *
 * - Stored choice persists via localStorage so the banner doesn't reappear
 *   once the user has explicitly chosen "Continuer sur le navigateur".
 * - Clicking "Télécharger" opens the Play Store in a new tab (no redirect).
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.dominomartinique.mobile';
const LS_KEY = 'android_banner_dismissed';

function isAndroidBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent || navigator.vendor || '');
}

export function AndroidStoreBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!isAndroidBrowser()) return;
    try {
      const dismissed = localStorage.getItem(LS_KEY);
      if (!dismissed) setVisible(true);
    } catch {
      // localStorage non disponible (mode privé strict) → on affiche quand même
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(LS_KEY, '1'); } catch { /* ignore */ }
    setVisible(false);
  };

  const openPlayStore = () => {
    // Ouvre le Play Store dans un nouvel onglet — pas de redirection forcée
    if (typeof window !== 'undefined') {
      window.open(PLAY_STORE_URL, '_blank', 'noopener,noreferrer');
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.banner}>
      {/* Icône + texte */}
      <View style={styles.left}>
        <View style={styles.iconWrap}>
          <Ionicons name="logo-google-playstore" size={22} color="#FFD700" />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>Meilleure expérience sur l'app</Text>
          <Text style={styles.sub}>Disponible gratuitement sur Google Play</Text>
        </View>
      </View>

      {/* Boutons */}
      <View style={styles.actions}>
        <TouchableOpacity onPress={dismiss} style={styles.btnSecondary} activeOpacity={0.7}>
          <Text style={styles.btnSecondaryText}>Rester sur le web</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={openPlayStore} style={styles.btnPrimary} activeOpacity={0.8}>
          <Text style={styles.btnPrimaryText}>Télécharger</Text>
        </TouchableOpacity>
      </View>

      {/* Croix de fermeture */}
      <TouchableOpacity onPress={dismiss} style={styles.close} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={18} color="#9B8EC4" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1040',
    borderBottomWidth: 1,
    borderBottomColor: '#3D2A6E',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    // Web elevation
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 2px 12px rgba(0,0,0,0.4)' } as any) : {}),
    zIndex: 9999,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#2D1B4E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFD70033',
  },
  textWrap: {
    flexShrink: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  sub: {
    color: '#9B8EC4',
    fontSize: 11,
    marginTop: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  btnSecondary: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3D2A6E',
  },
  btnSecondaryText: {
    color: '#9B8EC4',
    fontSize: 11,
    fontWeight: '600',
  },
  btnPrimary: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#FFD700',
  },
  btnPrimaryText: {
    color: '#1A0E2E',
    fontSize: 12,
    fontWeight: '800',
  },
  close: {
    marginLeft: 4,
    padding: 2,
    flexShrink: 0,
  },
});
