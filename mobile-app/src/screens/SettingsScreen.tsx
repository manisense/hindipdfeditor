import { useEffect, useState, useRef, useCallback } from 'react';
import { Linking, ScrollView, Share, View } from 'react-native';

import { AboutModal } from '../components/AboutModal';
import { APP_VERSION, PLAY_STORE_URL, PRIVACY_POLICY_URL } from '../constants/legal';
import { useUi } from '../hooks/useAppTheme';
import { useTx } from '../i18n';
import { useSettingsStore, type CheckUpdateResult } from '../state/settingsStore';
import { AppMark } from '../ui/AppMark';
import { BrandBand, useBandCollapse } from '../ui/BrandBand';
import { Dialog } from '../ui/Dialog';
import { Icon } from '../ui/Icon';
import { ListRow } from '../ui/ListRow';
import { SegmentedControl } from '../ui/SegmentedControl';
import { useSnackbar } from '../ui/Snackbar';
import { NAV_CLEARANCE } from '../ui/tokens';
import { UiText } from '../ui/UiText';

type UpdateDialog = 'ready' | 'error' | null;

/** Settings tab: language and theme switches, update check, and links. */
export function SettingsScreen() {
  const tx = useTx();
  const ui = useUi();
  const snackbar = useSnackbar();
  const bandListRef = useRef<ScrollView>(null);
  const band = useBandCollapse(
    useCallback((y) => bandListRef.current?.scrollTo({ y, animated: true }), []),
  );
  const {
    language,
    theme,
    loaded,
    isCheckingUpdate,
    initStore,
    setLanguage,
    setTheme,
    checkForUpdates,
    reloadAppUpdate,
  } = useSettingsStore();
  const [dialog, setDialog] = useState<UpdateDialog>(null);
  const [aboutVisible, setAboutVisible] = useState(false);

  useEffect(() => {
    if (!loaded) void initStore();
  }, [loaded, initStore]);

  const runCheck = async () => {
    if (isCheckingUpdate) return;
    const result: CheckUpdateResult = await checkForUpdates();
    if (result.isAvailable) setDialog('ready');
    else if (result.error) setDialog('error');
    else snackbar.show(tx('You have the latest version', 'आपके पास नया संस्करण है'));
  };

  const open = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  const shareApp = () => {
    Share.share({
      message: `${tx('Edit Hindi PDFs on your phone:', 'फ़ोन पर हिंदी PDF एडिट करें:')} ${PLAY_STORE_URL}`,
    }).catch(() => {});
  };

  const sectionLabel = (text: string) => (
    <UiText
      color={ui.brandOnSurface}
      accessibilityRole="header"
      style={{
        fontSize: 14,
        fontWeight: '600',
        paddingTop: 12,
        paddingHorizontal: 16,
        paddingBottom: 8,
      }}
    >
      {text}
    </UiText>
  );

  const external = <Icon name="open-in-new" size={20} color={ui.inkSecondary} />;
  const rowIcon = ui.brandOnSurface;

  return (
    <>
      <BrandBand
        title={tx('Settings', 'सेटिंग्स')}
        leading={<AppMark />}
        scrollY={band.scrollY}
        onCollapseDistance={band.setDistance}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: NAV_CLEARANCE }}
          onScroll={band.onScroll}
          scrollEventThrottle={band.scrollEventThrottle}
          ref={bandListRef}
          onScrollEndDrag={band.onScrollEndDrag}
          onMomentumScrollEnd={band.onMomentumScrollEnd}
        >
          {sectionLabel(tx('Appearance', 'दिखावट'))}
          <View style={{ paddingHorizontal: 16, gap: 8, paddingBottom: 8 }}>
            <UiText>{tx('App language', 'ऐप की भाषा')}</UiText>
            <SegmentedControl
              label={tx('App language', 'ऐप की भाषा')}
              value={language}
              onChange={(v) => void setLanguage(v)}
              options={[
                { value: 'english', label: 'English' },
                { value: 'hindi', label: 'हिंदी' },
              ]}
            />
            <UiText style={{ marginTop: 8 }}>{tx('Theme', 'थीम')}</UiText>
            <SegmentedControl
              label={tx('Theme', 'थीम')}
              value={theme}
              onChange={(v) => void setTheme(v)}
              options={[
                { value: 'light', label: tx('Light', 'लाइट') },
                { value: 'dark', label: tx('Dark', 'डार्क') },
                { value: 'system', label: tx('System', 'सिस्टम') },
              ]}
            />
          </View>

          {sectionLabel(tx('App', 'ऐप'))}
          <ListRow
            icon="system-update"
            iconColor={rowIcon}
            title={tx('Check for updates', 'अपडेट जाँचें')}
            subtitle={
              isCheckingUpdate
                ? tx('Checking…', 'जाँच हो रही है…')
                : `${tx('Version', 'संस्करण')} ${APP_VERSION}`
            }
            onPress={() => void runCheck()}
          />

          {sectionLabel(tx('About', 'जानकारी'))}
          <ListRow
            icon="shield"
            iconColor={rowIcon}
            title={tx('Privacy policy', 'गोपनीयता नीति')}
            trailing={external}
            onPress={() => open(PRIVACY_POLICY_URL)}
          />
          <ListRow
            icon="star"
            iconColor={rowIcon}
            title={tx('Rate on Play Store', 'Play Store पर रेटिंग दें')}
            trailing={external}
            onPress={() => open(PLAY_STORE_URL)}
          />
          <ListRow
            icon="share"
            iconColor={rowIcon}
            title={tx('Share the app', 'ऐप शेयर करें')}
            onPress={shareApp}
          />
          <ListRow
            icon="info"
            iconColor={rowIcon}
            title={tx('About', 'जानकारी')}
            onPress={() => setAboutVisible(true)}
          />
        </ScrollView>
      </BrandBand>

      <Dialog
        visible={dialog === 'ready'}
        icon="system-update"
        iconColor={ui.brandOnSurface}
        title={tx('Update ready', 'अपडेट तैयार है')}
        body={tx(
          'A newer version has downloaded. Restart the app to use it. Your files are not affected.',
          'नया संस्करण डाउनलोड हो गया है। इसे इस्तेमाल करने के लिए ऐप फिर से शुरू करें। आपकी फ़ाइलों पर असर नहीं होगा।',
        )}
        confirmLabel={tx('Restart now', 'अभी शुरू करें')}
        cancelLabel={tx('Later', 'बाद में')}
        onConfirm={() => {
          setDialog(null);
          void reloadAppUpdate();
        }}
        onCancel={() => setDialog(null)}
      />
      <Dialog
        visible={dialog === 'error'}
        icon="error"
        iconColor={ui.danger}
        title={tx("Couldn't check for updates", 'अपडेट जाँच नहीं हो सकी')}
        body={tx(
          'Check your internet connection and try again.',
          'इंटरनेट कनेक्शन जाँचें और फिर से कोशिश करें।',
        )}
        confirmLabel={tx('Try again', 'फिर से करें')}
        cancelLabel={tx('Close', 'बंद करें')}
        onConfirm={() => {
          setDialog(null);
          void runCheck();
        }}
        onCancel={() => setDialog(null)}
      />
      <AboutModal visible={aboutVisible} onClose={() => setAboutVisible(false)} />
    </>
  );
}
