import { Linking, Share, View } from 'react-native';

import { APP_VERSION, PLAY_STORE_URL, PRIVACY_POLICY_URL } from '../constants/legal';
import { useUi } from '../hooks/useAppTheme';
import { useTx } from '../i18n';
import { BottomSheet } from '../ui/BottomSheet';
import { Icon } from '../ui/Icon';
import { ListRow } from '../ui/ListRow';
import { UiText } from '../ui/UiText';

type Props = {
  visible: boolean;
  onClose: () => void;
};

/** Opens a URL; a missing handler or network is ignored, the user can tap again. */
function openUrl(url: string) {
  Linking.openURL(url).catch(() => {});
}

/** About sheet: app mark, version, privacy policy, Play Store rating and share. */
export function AboutModal({ visible, onClose }: Props) {
  const tx = useTx();
  const ui = useUi();
  const trailing = <Icon name="open-in-new" size={20} color={ui.inkSecondary} />;

  const shareApp = () => {
    Share.share({
      message: `${tx('Edit Hindi PDFs on your phone:', 'फ़ोन पर हिंदी PDF एडिट करें:')} ${PLAY_STORE_URL}`,
    }).catch(() => {});
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ alignItems: 'center', gap: 4, paddingBottom: 8 }}>
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            backgroundColor: ui.brand,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8,
          }}
        >
          <UiText color="#FFFFFF" style={{ fontSize: 28, fontWeight: '700' }}>
            हि
          </UiText>
        </View>
        <UiText variant="title">Hindi PDF Editor</UiText>
        <UiText variant="meta" color={ui.inkSecondary}>
          {tx('Version', 'संस्करण')} {APP_VERSION} · Pruning Labs
        </UiText>
      </View>
      <ListRow
        icon="shield"
        iconColor={ui.brandOnSurface}
        title={tx('Privacy policy', 'गोपनीयता नीति')}
        trailing={trailing}
        onPress={() => openUrl(PRIVACY_POLICY_URL)}
      />
      <ListRow
        icon="star"
        iconColor={ui.brandOnSurface}
        title={tx('Rate on Play Store', 'Play Store पर रेटिंग दें')}
        trailing={trailing}
        onPress={() => openUrl(PLAY_STORE_URL)}
      />
      <ListRow
        icon="share"
        iconColor={ui.brandOnSurface}
        title={tx('Share the app', 'ऐप शेयर करें')}
        onPress={shareApp}
      />
    </BottomSheet>
  );
}
