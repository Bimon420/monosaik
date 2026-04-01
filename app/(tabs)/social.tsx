import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
  ActivityIndicator, TextInput, Modal, Alert, Share,
} from 'react-native';
import { Container } from '@/components/ui';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { safeDbList } from '@/lib/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '@/lib/i18n';
import { useDiscoStore } from '@/lib/store';
import { getUserId } from '@/lib/user';
import {
  getLocalFriends, addLocalFriend, removeLocalFriend,
  resolveInviteCode, makeInviteCode,
} from '@/lib/friends';

const DISCO_COLORS = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];
const TOTAL_SLOTS = 128;

function hashColor(seed: string): string {
  const COLORS = ['#FFD700', '#40E0D0', '#FF4500', '#4169E1', '#8A2BE2', '#FF1493', '#ADFF2F', '#FF8C00'];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = seed.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}

// ─── Add Friend Modal ─────────────────────────────────────────────────────────
function AddFriendModal({ visible, onClose, onAdded }: {
  visible: boolean; onClose: () => void; onAdded: () => void;
}) {
  const [code, setCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<{ id: string; displayName: string; avatarUrl: string } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const myId = getUserId();

  const handleSearch = async () => {
    if (code.trim().length < 4) return;
    setSearching(true);
    setResult(null);
    setNotFound(false);
    const found = await resolveInviteCode(code.trim());
    setSearching(false);
    if (!found || found.id === myId) {
      setNotFound(true);
    } else {
      setResult(found);
    }
  };

  const handleAdd = () => {
    if (!result) return;
    addLocalFriend(result.id);
    onAdded();
    onClose();
    setCode('');
    setResult(null);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={e => e.stopPropagation()}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Freund hinzufügen</Text>
            <Pressable onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <Text style={styles.modalHint}>
            Gib den Einladungscode deines Freundes ein (12 Zeichen)
          </Text>

          <View style={styles.searchRow}>
            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={t => { setCode(t.toUpperCase()); setResult(null); setNotFound(false); }}
              placeholder="z. B. 4A9F2C8E1D7B"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              maxLength={12}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
            <Pressable style={styles.searchBtn} onPress={handleSearch}>
              {searching
                ? <ActivityIndicator size="small" color="#FFF" />
                : <Ionicons name="search" size={18} color="#FFF" />}
            </Pressable>
          </View>

          {notFound && (
            <Text style={styles.notFound}>Kein Nutzer mit diesem Code gefunden.</Text>
          )}

          {result && (
            <View style={styles.resultCard}>
              <View style={[styles.resultAvatar, { backgroundColor: hashColor(result.id) }]} />
              <Text style={styles.resultName}>{result.displayName}</Text>
              <Pressable style={styles.addBtn} onPress={handleAdd}>
                <Ionicons name="person-add" size={16} color="#FFF" />
                <Text style={styles.addBtnText}>Hinzufügen</Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SocialScreen() {
  const today = new Date().toISOString().split('T')[0];
  const { t } = useI18n();
  const { isDiscoEnabled, toggleDisco } = useDiscoStore();
  const [discoTick, setDiscoTick] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [friendIds, setFriendIds] = useState<string[]>(() => getLocalFriends());
  const myId = getUserId();
  const myCode = makeInviteCode(myId);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isDiscoEnabled) return;
    const interval = setInterval(() => setDiscoTick(p => (p + 1) % DISCO_COLORS.length), 400);
    return () => clearInterval(interval);
  }, [isDiscoEnabled]);

  const getDiscoColor = useCallback((index: number) => {
    if (!isDiscoEnabled) return undefined;
    return DISCO_COLORS[(discoTick + index) % DISCO_COLORS.length];
  }, [isDiscoEnabled, discoTick]);

  const { data: myMood } = useQuery({
    queryKey: ['moods', 'today', myId],
    queryFn: async () => {
      const r = await safeDbList('moods', { where: { userId: myId, date: today }, limit: 1 });
      return r[0] || null;
    },
  });

  const { data: friendData = [], isLoading } = useQuery({
    queryKey: ['friends_grid', today, friendIds],
    queryFn: async () => {
      if (friendIds.length === 0) return [];
      const [usersRes, moodsRes] = await Promise.all([
        safeDbList('users', { limit: 500 }),
        safeDbList('moods', { where: { date: today }, limit: 500 }),
      ]);
      return friendIds.map(fid => {
        const user = usersRes.find((u: any) => u.id === fid);
        const mood = moodsRes.find((m: any) => m.userId === fid);
        return { id: fid, displayName: user?.displayName || '…', currentMood: mood, found: !!user };
      });
    },
  });

  const gridSlots = useMemo(() => {
    const me = { id: myId, displayName: 'Du', isMe: true, currentMood: myMood };
    const others = friendData.slice(0, TOTAL_SLOTS - 1);
    const emptyCount = Math.max(0, TOTAL_SLOTS - 1 - others.length);
    const empties = Array.from({ length: emptyCount }, (_, i) => ({
      id: `empty_${i}`, displayName: '', isEmpty: true, currentMood: null,
    }));
    return [me, ...others, ...empties];
  }, [friendData, myMood, myId]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Mein MONSAIK-Code: ${myCode}\nHinzufügen in der App → Freunde → + Freund`,
      });
    } catch {}
  };

  const handleRemove = (id: string, name: string) => {
    Alert.alert(
      'Freund entfernen',
      `${name} aus deiner Liste entfernen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Entfernen', style: 'destructive',
          onPress: () => {
            setFriendIds(removeLocalFriend(id));
            queryClient.invalidateQueries({ queryKey: ['friends_grid'] });
          },
        },
      ]
    );
  };

  const renderSlot = ({ item, index }: { item: any; index: number }) => {
    if ((item as any).isEmpty) {
      return (
        <View style={styles.slotContainer}>
          <View style={styles.emptyTile}>
            <Ionicons name="add" size={14} color="rgba(255,255,255,0.12)" />
          </View>
          <Text style={styles.emptyLabel}> </Text>
        </View>
      );
    }

    const baseColor = item.currentMood?.color || hashColor(item.id);
    const tileColor = getDiscoColor(index) || baseColor;
    const hasNoMood = !item.currentMood && !item.isMe;

    return (
      <Pressable
        style={styles.slotContainer}
        onLongPress={() => !item.isMe && handleRemove(item.id, item.displayName)}
      >
        <View style={[
          styles.tile,
          { backgroundColor: tileColor },
          item.isMe && styles.meTile,
          hasNoMood && styles.dimTile,
          isDiscoEnabled && { transform: [{ scale: index % 3 === 0 ? 1.05 : 0.97 }] },
        ]}>
          {item.isMe && <Ionicons name="person" size={14} color="rgba(255,255,255,0.9)" />}
        </View>
        <Text style={[styles.tileLabel, item.isMe && styles.meLabel]} numberOfLines={1}>
          {item.displayName || '?'}
        </Text>
      </Pressable>
    );
  };

  const realFriends = friendData.length;

  return (
    <Container safeArea edges={['top']} style={styles.container}>
      <AddFriendModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdded={() => {
          setFriendIds(getLocalFriends());
          queryClient.invalidateQueries({ queryKey: ['friends_grid'] });
        }}
      />

      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('social_title')}</Text>
            <Text style={styles.subtitle}>
              {realFriends} {realFriends === 1 ? 'Freund' : 'Freunde'} · {TOTAL_SLOTS - 1 - realFriends} Plätze frei
            </Text>
          </View>
          <View style={styles.headerButtons}>
            <Pressable onPress={toggleDisco} style={[styles.iconBtn, isDiscoEnabled && styles.iconBtnActive]}>
              <Ionicons name={isDiscoEnabled ? 'musical-notes' : 'disc-outline'} size={20} color={isDiscoEnabled ? '#FFF' : colors.primary} />
            </Pressable>
            <Pressable onPress={() => setShowAddModal(true)} style={[styles.iconBtn, styles.addIconBtn]}>
              <Ionicons name="person-add" size={20} color="#FFF" />
            </Pressable>
          </View>
        </View>

        {/* My invite code bar */}
        <Pressable style={styles.codeBar} onPress={handleShare}>
          <Ionicons name="share-outline" size={16} color={colors.primary} />
          <Text style={styles.codeBarLabel}>Mein Code: </Text>
          <Text style={styles.codeBarCode}>{myCode}</Text>
          <Ionicons name="copy-outline" size={14} color={colors.textMuted} />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={gridSlots}
          renderItem={renderSlot}
          keyExtractor={(item) => item.id}
          numColumns={4}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={null}
        />
      )}

      {friendIds.length === 0 && !isLoading && (
        <View style={styles.emptyHint}>
          <Ionicons name="people-outline" size={40} color={colors.textMuted} />
          <Text style={styles.emptyHintTitle}>Noch keine Freunde</Text>
          <Text style={styles.emptyHintText}>Teile deinen Code, um Freunde einzuladen.</Text>
          <Pressable style={styles.emptyHintBtn} onPress={() => setShowAddModal(true)}>
            <Ionicons name="person-add" size={16} color="#FFF" />
            <Text style={styles.emptyHintBtnText}>Freund hinzufügen</Text>
          </Pressable>
        </View>
      )}
    </Container>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },

  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  title: { ...typography.h2, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  headerButtons: { flexDirection: 'row', gap: spacing.sm },
  iconBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  iconBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  addIconBtn: { backgroundColor: colors.primary, borderColor: colors.primary },

  codeBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  codeBarLabel: { ...typography.caption, color: colors.textMuted },
  codeBarCode: { ...typography.captionBold, color: colors.text, flex: 1, letterSpacing: 1.5 },

  listContent: { paddingHorizontal: spacing.sm, paddingBottom: 100 },
  gridRow: { justifyContent: 'flex-start', gap: spacing.xs, marginBottom: spacing.xs },
  slotContainer: { width: '24%', alignItems: 'center' },
  tile: {
    width: '100%', aspectRatio: 1,
    borderRadius: borderRadius.md,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    ...shadows.sm,
  },
  meTile: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)' },
  dimTile: { opacity: 0.5 },
  emptyTile: {
    width: '100%', aspectRatio: 1, borderRadius: borderRadius.md,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.1)',
  },
  tileLabel: { color: colors.textMuted, marginTop: 3, fontSize: 9, fontWeight: '600', textAlign: 'center' },
  meLabel: { color: colors.text, fontWeight: '700' },
  emptyLabel: { height: 14, marginTop: 3 },

  loadingState: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  emptyHint: {
    position: 'absolute', bottom: 100, left: 0, right: 0,
    alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.xxl,
  },
  emptyHintTitle: { ...typography.h4, color: colors.text },
  emptyHintText: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  emptyHintBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  emptyHintBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg, paddingBottom: 40,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  modalTitle: { ...typography.h3, color: colors.text },
  modalClose: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
  },
  modalHint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },
  searchRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  codeInput: {
    flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    color: colors.text, fontSize: 16, fontWeight: '700',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', letterSpacing: 1.5,
  },
  searchBtn: {
    width: 48, height: 48, borderRadius: borderRadius.lg,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  notFound: { ...typography.caption, color: colors.error, marginBottom: spacing.sm },
  resultCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  resultAvatar: { width: 40, height: 40, borderRadius: 20 },
  resultName: { ...typography.bodyBold, color: colors.text, flex: 1 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, borderRadius: borderRadius.md,
    paddingVertical: 8, paddingHorizontal: 12,
  },
  addBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
});
