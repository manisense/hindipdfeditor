import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme, useUi } from '../hooks/useAppTheme';
import { UiText } from './UiText';

/** Blue brand band (64dp app bar + optional extra content) with a white sheet that overlaps it by 24dp. */
export function BrandBand({
  title,
  leading,
  actions,
  bandExtra,
  children,
}: {
  title: string;
  leading?: ReactNode;
  actions?: ReactNode;
  bandExtra?: ReactNode;
  children: ReactNode;
}) {
  const ui = useUi();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: ui.brand }}>
      <View style={{ paddingTop: insets.top, paddingBottom: 48 }}>
        <View
          style={{
            height: 64,
            flexDirection: 'row',
            alignItems: 'center',
            paddingLeft: leading ? 4 : 16,
            paddingRight: 4,
            gap: 4,
          }}
        >
          {leading}
          <UiText
            variant="title"
            color="#FFFFFF"
            style={{ flex: 1 }}
            accessibilityRole="header"
            numberOfLines={1}
          >
            {title}
          </UiText>
          {actions}
        </View>
        {bandExtra}
      </View>
      <View
        style={{
          flex: 1,
          marginTop: -24,
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </View>
  );
}
