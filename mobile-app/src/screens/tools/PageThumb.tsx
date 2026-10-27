import { Image, View } from 'react-native';

import { useUi } from '../../hooks/useAppTheme';
import { Icon } from '../../ui/Icon';

/** 40x56dp first-page thumbnail with a hairline ring; a document glyph stands in until it renders. */
export function PageThumb({ uri }: { uri?: string }) {
  const ui = useUi();
  return (
    <View
      style={{
        width: 40,
        height: 56,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: ui.ring,
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <Icon name="description" size={20} color={ui.inkTertiary} />
      )}
    </View>
  );
}
