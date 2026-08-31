import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from './AppButton';
import { AppPopupContext, type AppPopupTone, type ShowPopupOptions } from './appPopupContext';
import { colors, radius, shadows, spacing } from '../theme';

export type { AppPopupTone, ShowPopupOptions } from './appPopupContext';

type PopupRequest = ShowPopupOptions & {
  id: number;
  resolve: (confirmed: boolean) => void;
};

const TONE_CONFIG: Record<
  AppPopupTone,
  { bar: string; iconBg: string; iconColor: string; iconName: keyof typeof Ionicons.glyphMap }
> = {
  info: {
    bar: colors.brand,
    iconBg: colors.brandTint,
    iconColor: colors.brand,
    iconName: 'information-circle',
  },
  success: {
    bar: colors.accentGreen,
    iconBg: colors.accentGreenTint,
    iconColor: colors.accentGreen,
    iconName: 'checkmark-circle',
  },
  warning: {
    bar: colors.accentOrange,
    iconBg: colors.accentOrangeTint,
    iconColor: colors.accentOrange,
    iconName: 'warning',
  },
  error: {
    bar: colors.danger,
    iconBg: colors.dangerSoft,
    iconColor: colors.danger,
    iconName: 'alert-circle',
  },
};

/**
 * Brand-consistent modal window replacing native Alert.alert across the mobile app.
 * Features top tone bar, 12px squircle icon chip, eyebrow tag, and promise-based confirmation flow.
 */
export function AppPopupProvider({ children }: { children: ReactNode }) {
  const nextIdRef = useRef(0);
  const queueRef = useRef<PopupRequest[]>([]);
  const activeRef = useRef<PopupRequest | null>(null);
  const [active, setActive] = useState<PopupRequest | null>(null);

  const showPopup = useCallback((options: ShowPopupOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const request: PopupRequest = {
        ...options,
        id: ++nextIdRef.current,
        resolve,
      };
      if (activeRef.current) {
        queueRef.current.push(request);
        return;
      }
      activeRef.current = request;
      setActive(request);
    });
  }, []);

  const closeActive = useCallback((confirmed: boolean) => {
    const completed = activeRef.current;
    const next = queueRef.current.shift() ?? null;
    activeRef.current = next;
    setActive(next);
    completed?.resolve(confirmed);
  }, []);

  useEffect(
    () => () => {
      activeRef.current?.resolve(false);
      for (const request of queueRef.current) request.resolve(false);
      queueRef.current = [];
      activeRef.current = null;
    },
    [],
  );

  const contextValue = useMemo(() => ({ showPopup }), [showPopup]);
  const tone = active?.tone ?? 'info';
  const toneStyle = TONE_CONFIG[tone];

  return (
    <AppPopupContext.Provider value={contextValue}>
      {children}
      <Modal
        visible={active !== null}
        transparent
        animationType="fade"
        onRequestClose={() => closeActive(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            if (active?.cancelLabel) closeActive(false);
          }}
        >
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.topToneBar, { backgroundColor: toneStyle.bar }]} />

            <View style={styles.content}>
              <View style={styles.headerRow}>
                <View style={[styles.iconBox, { backgroundColor: toneStyle.iconBg }]}>
                  <Ionicons name={toneStyle.iconName} size={24} color={toneStyle.iconColor} />
                </View>
                <View style={styles.titleColumn}>
                  <Text style={styles.eyebrow}>{active?.eyebrow ?? 'HINDI PDF EDITOR'}</Text>
                  <Text style={styles.title}>{active?.title ?? ''}</Text>
                </View>
              </View>

              <Text style={styles.message}>{active?.message ?? ''}</Text>

              <View style={styles.actionsRow}>
                {active?.cancelLabel && (
                  <AppButton
                    title={active.cancelLabel}
                    variant="subtle"
                    onPress={() => closeActive(false)}
                    style={styles.actionBtn}
                  />
                )}
                <AppButton
                  title={active?.actionLabel ?? 'Got it'}
                  variant={tone === 'error' ? 'danger' : 'primary'}
                  onPress={() => closeActive(true)}
                  style={styles.actionBtn}
                />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </AppPopupContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 22, 31, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.popup,
  },
  topToneBar: {
    height: 4,
    width: '100%',
  },
  content: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleColumn: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    fontSize: 10.5,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
});
