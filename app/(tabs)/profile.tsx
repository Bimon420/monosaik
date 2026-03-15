import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Share, Alert } from 'react-native';
import { Container, Avatar, Card, Button } from '@/components/ui';
import { colors, spacing, typography, borderRadius } from '@/constants/design';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { safeDbList, safeDbCount, safeDbUpdate } from '@/lib/api';
import { THEME_ICONS } from '@/lib/themes';
import { useI18n, LANGUAGES } from '@/lib/i18n';

export default function ProfileScreen() {
  const queryClient = useQueryClient();
  const { t, language, setLanguage } = useI18n();

  const { data: userData, isLoading: isLoadingUser } = useQuery({
    queryKey: ['users', 'current_user'],
    queryFn: async () => {
      const results = await safeDbList('users', { where: { id: 'current_user' }, limit: 1 });
      return results[0] || null;
    }
  });

  const { data: moodCount = 0 } = useQuery({
    queryKey: ['moods', 'count'],
    queryFn: () => safeDbCount('moods', { where: { userId: 'current_user' } }),
  });

  // Build user object from data
  const user = {
    displayName: userData?.displayName || 'Pixel Master',
    username: userData?.username || '@pixel_pro',
    pixels: userData?.pixelBalance || 0,
    checkIns: moodCount,
    streak: 7,
    avatarUrl: userData?.avatarUrl || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=PixelMaster',
    unlockedThemes: userData?.unlockedThemes || 'classic',
    themeIcon: userData?.themeIcon || 'classic'
  };

  const handleInvite = async () => {
    try {
      await Share.share({
        message: 'Komm zu MONSAIK! Erstelle dein eigenes Stimmungs-Mosaik und verbinde dich mit Freunden: https://monsaik.app',
      });
    } catch (error) {
      console.error('Sharing failed:', error);
    }
  };

  const handleUnlockTheme = async (theme: typeof THEME_ICONS[0]) => {
    if (!userData) return;

    if (user.pixels < theme.price) {
      Alert.alert('Nicht genug Pixels!', `Du benötigst ${theme.price} Pixels, um das ${theme.name} Theme freizuschalten.`);
      return;
    }

    const currentUnlocked = (user.unlockedThemes || 'classic').split(',');
    if (currentUnlocked.includes(theme.id)) {
      // Already unlocked, just switch
      await safeDbUpdate('users', 'current_user', { themeIcon: theme.id });
      queryClient.invalidateQueries({ queryKey: ['users', 'current_user'] });
      return;
    }

    // Purchase
    Alert.alert(
      'Theme freischalten',
      `Möchtest du das ${theme.name} Theme für ${theme.price} Pixels freischalten?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Freischalten',
          onPress: async () => {
            const newUnlocked = [...currentUnlocked, theme.id].join(',');
            await safeDbUpdate('users', 'current_user', {
              themeIcon: theme.id,
              unlockedThemes: newUnlocked,
              pixelBalance: user.pixels - theme.price
            });
            queryClient.invalidateQueries({ queryKey: ['users', 'current_user'] });
            Alert.alert('Erfolg!', `${theme.name} wurde freigeschaltet und aktiviert.`);
          }
        }
      ]
    );
  };

  if (isLoadingUser) {
    return (
      <Container safeArea edges={['top']} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Container>
    );
  }

  return (
    <Container safeArea edges={['top']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Avatar source={{ uri: user.avatarUrl }} size="xl" />
          <Text style={styles.name}>{user.displayName}</Text>
          <Text style={styles.username}>{user.username}</Text>
        </View>

        <View style={styles.statsGrid}>
          <Card variant="elevated" style={styles.statCard}>
            <Ionicons name="diamond" size={24} color={colors.accent} />
            <Text style={styles.statValue}>{user.pixels}</Text>
            <Text style={styles.statLabel}>{t('profile_pixels')}</Text>
          </Card>
          <Card variant="elevated" style={styles.statCard}>
            <Ionicons name="flame" size={24} color="#FF4500" />
            <Text style={styles.statValue}>{user.streak}</Text>
            <Text style={styles.statLabel}>{t('profile_streak')}</Text>
          </Card>
        </View>

        <Animated.View entering={FadeInDown.delay(100)} style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile_language')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.iconScroll}>
            {LANGUAGES.map((lang) => (
              <Pressable
                key={lang.id}
                style={styles.languageItem}
                onPress={() => setLanguage(lang.id)}
              >
                <View style={[
                  styles.languageCircle,
                  { backgroundColor: colors.surface },
                  language === lang.id && styles.activeLanguageCircle
                ]}>
                  <Text style={[
                    styles.languageCode,
                    language === lang.id && styles.activeLanguageCode
                  ]}>{lang.id.toUpperCase()}</Text>
                </View>
                <Text style={styles.themeText}>{lang.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile_themes')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.iconScroll}>
            {THEME_ICONS.map((theme) => {
              const isUnlocked = user.unlockedThemes.split(',').includes(theme.id);
              const isActive = user.themeIcon === theme.id;

              return (
                <Pressable
                  key={theme.id}
                  style={styles.themeItem}
                  onPress={() => handleUnlockTheme(theme)}
                >
                  <View style={[
                    styles.themeIcon,
                    { backgroundColor: colors.surface },
                    isActive && styles.activeThemeIcon
                  ]}>
                    <Ionicons
                      name={theme.preview as any}
                      size={24}
                      color={isActive ? colors.primary : (isUnlocked ? colors.text : colors.textMuted)}
                    />
                    {!isUnlocked && (
                      <View style={styles.lockOverlay}>
                        <Ionicons name="lock-closed" size={12} color="#FFF" />
                      </View>
                    )}
                  </View>
                  <Text style={styles.themeText}>{theme.name}</Text>
                  <Text style={[styles.themePrice, isUnlocked && styles.unlockedText]}>
                    {isUnlocked ? (isActive ? 'Aktiv' : 'Besitzt') : `${theme.price} px`}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>

        <View style={styles.actions}>
          <Button variant="outline" style={styles.actionButton} onPress={handleInvite}>
            Freunde einladen
          </Button>
          <Button variant="ghost" style={styles.actionButton}>
            Abmelden
          </Button>
        </View>
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  name: {
    ...typography.h1,
    color: colors.text,
    marginTop: spacing.md,
  },
  username: {
    ...typography.body,
    color: colors.textMuted,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.lg,
  },
  statValue: {
    ...typography.h2,
    color: colors.text,
    marginTop: spacing.xs,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  iconScroll: {
    gap: spacing.lg,
  },
  themeItem: {
    alignItems: 'center',
    width: 80,
  },
  themeIcon: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeThemeIcon: {
    borderColor: colors.primary,
  },
  lockOverlay: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    padding: 2,
  },
  themeText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },
  themePrice: {
    ...typography.tiny,
    color: colors.accent,
  },
  unlockedText: {
    color: colors.textMuted,
  },
  languageItem: {
    alignItems: 'center',
    width: 60,
  },
  languageCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeLanguageCircle: {
    borderColor: colors.primary,
  },
  languageCode: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textMuted,
  },
  activeLanguageCode: {
    color: colors.primary,
  },
  actions: {
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  actionButton: {
    width: '100%',
  },
});
