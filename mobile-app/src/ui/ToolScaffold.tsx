import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme, useUi } from '../hooks/useAppTheme';
import { useTx } from '../i18n';
import { useHardwareBack } from '../navigation/useHardwareBack';
import { BrandBand } from './BrandBand';
import { Icon } from './Icon';
import { PillButton } from './PillButton';

type PrimaryAction = { title: string; onPress: () => void; disabled?: boolean; loading?: boolean };
type SecondaryAction = { title: string; onPress: () => void };

/**
 * Tool screen frame: brand band with a 48dp leading icon button, scrollable content with 8dp top
 * padding, and a bottom action bar (12/16/20dp padding plus the bottom inset) shown only when
 * `primary` is set. Android back calls `onLeading`.
 */
export function ToolScaffold({
  title,
  leadingIcon = 'arrow-back',
  onLeading,
  primary,
  secondary,
  children,
}: {
  title: string;
  leadingIcon?: 'arrow-back' | 'close';
  onLeading: () => void;
  primary?: PrimaryAction;
  secondary?: SecondaryAction;
  children: ReactNode;
}) {
  const ui = useUi();
  const theme = useAppTheme();
  const tx = useTx();
  const insets = useSafeAreaInsets();

  useHardwareBack(() => {
    onLeading();
    return true;
  });

  const leading = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={leadingIcon === 'close' ? tx('Close', 'बंद करें') : tx('Back', 'वापस')}
      onPress={onLeading}
      android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true, radius: 24 }}
      style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={leadingIcon} size={24} color="#FFFFFF" />
    </Pressable>
  );

  return (
    <BrandBand title={title} leading={leading}>
      <ScrollView contentContainerStyle={{ paddingTop: 8 }}>{children}</ScrollView>
      {primary ? (
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: ui.divider,
            paddingTop: 12,
            paddingHorizontal: 16,
            paddingBottom: 20 + insets.bottom,
            gap: 8,
          }}
        >
          <PillButton
            title={primary.title}
            onPress={primary.onPress}
            disabled={primary.disabled}
            loading={primary.loading}
          />
          {secondary ? (
            <PillButton kind="tonal" title={secondary.title} onPress={secondary.onPress} />
          ) : null}
        </View>
      ) : null}
    </BrandBand>
  );
}
