import { Text, type TextProps } from 'react-native';

import { useIsHindi } from '../i18n';
import { useUi } from '../hooks/useAppTheme';
import { uiFont } from './tokens';

const VARIANTS = {
  title: { fontSize: 22, fontWeight: '600' as const },
  section: { fontSize: 20, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  meta: { fontSize: 14, fontWeight: '400' as const },
  label: { fontSize: 13, fontWeight: '500' as const },
};

/** Text that uses Noto Sans Devanagari in Hindi mode and Inter otherwise. Sizes are dp. */
export function UiText({
  variant = 'body',
  color,
  style,
  ...rest
}: TextProps & { variant?: keyof typeof VARIANTS; color?: string }) {
  const hindi = useIsHindi();
  const ui = useUi();
  return (
    <Text
      {...rest}
      style={[
        { fontFamily: hindi ? uiFont.devanagari : uiFont.latin, color: color ?? ui.ink },
        VARIANTS[variant],
        style,
      ]}
    />
  );
}
