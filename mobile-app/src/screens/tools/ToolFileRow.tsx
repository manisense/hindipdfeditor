import { View } from 'react-native';

import { useUi } from '../../hooks/useAppTheme';
import { useTx } from '../../i18n';
import { PillButton } from '../../ui/PillButton';
import { UiText } from '../../ui/UiText';
import { PageThumb } from './PageThumb';

/** The chosen file at the top of a tool: thumbnail, name, `pages · size` and a Change button. */
export function ToolFileRow({
  name,
  meta,
  thumbnailUri,
  onChange,
}: {
  name: string;
  meta: string;
  thumbnailUri?: string;
  onChange: () => void;
}) {
  const ui = useUi();
  const tx = useTx();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        paddingVertical: 12,
        paddingLeft: 16,
        paddingRight: 4,
      }}
    >
      <PageThumb uri={thumbnailUri} />
      <View style={{ flex: 1, gap: 2 }}>
        <UiText variant="body" numberOfLines={1}>
          {name}
        </UiText>
        <UiText variant="meta" color={ui.inkSecondary} numberOfLines={1}>
          {meta}
        </UiText>
      </View>
      <PillButton kind="text" title={tx('Change', 'बदलें')} onPress={onChange} />
    </View>
  );
}
