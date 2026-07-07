import { Asset } from 'expo-asset';
// expo-file-system's top-level `readAsStringAsync` is a stub that unconditionally throws
// in this SDK version (confirmed on a real device, not just read from source) - the actual
// implementation now lives under the `/legacy` subpath. See exportPdf.ts for the same fix.
import * as FileSystem from 'expo-file-system/legacy';

export type DevanagariFontFamily = 'NotoSansDevanagari' | 'NotoSerifDevanagari';

// Metro treats .ttf as an asset module by default, resolving to a numeric module ID that
// Asset.fromModule() can load - not a file path, so this works the same in dev and in a
// release bundle.
const FONT_MODULES: Record<DevanagariFontFamily, number> = {
  NotoSansDevanagari: require('../../assets/fonts/NotoSansDevanagari-Variable.ttf') as number,
  NotoSerifDevanagari: require('../../assets/fonts/NotoSerifDevanagari-Variable.ttf') as number,
};

// Loaded once per app session and reused - see getFontBase64 docstring for why.
const base64Cache = new Map<DevanagariFontFamily, string>();

/**
 * Loads a bundled Devanagari variable font (see spec Section 4.1/6) and returns it as a
 * base64 string, for inlining directly into an `@font-face { src: url(data:font/ttf;base64,...) }`
 * rule.
 *
 * Per spec Section 8's htmlCompositor.ts contract: WebView print does not reliably resolve
 * local `file://` paths for CSS assets on Android, so every font must be base64-inlined into
 * the HTML string itself, never referenced by path. This function is the single place that
 * reads the font off disk and encodes it, so callers (htmlCompositor.ts, and the Phase 0 spike
 * in App.tsx) never duplicate that work or drift out of sync with each other.
 */
export async function getFontBase64(family: DevanagariFontFamily): Promise<string> {
  const cached = base64Cache.get(family);
  if (cached) {
    return cached;
  }

  const asset = Asset.fromModule(FONT_MODULES[family]);
  await asset.downloadAsync();
  if (!asset.localUri) {
    throw new Error(`Font asset for ${family} has no localUri after downloadAsync()`);
  }

  const base64 = await FileSystem.readAsStringAsync(asset.localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  base64Cache.set(family, base64);
  return base64;
}
