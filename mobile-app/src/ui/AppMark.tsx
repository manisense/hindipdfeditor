import { Image } from 'react-native';

/** The app logo (the launcher icon's circle), 36dp, used as the leading element of each tab's brand band. */
export function AppMark() {
  return (
    <Image
      source={require('../../assets/app-mark.png')}
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{ width: 36, height: 36, marginHorizontal: 10 }}
    />
  );
}
