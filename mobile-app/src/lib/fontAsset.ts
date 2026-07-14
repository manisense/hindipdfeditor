import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as Font from 'expo-font';

export type DevanagariFontFamily = 'NotoSansDevanagari' | 'Mukta';

export type FontCatalogEntry = {
  family: DevanagariFontFamily;
  label: string;
  description: string;
  bundled: boolean;
  /** CSS weight descriptor matching the actual file: variable range or one static face. */
  cssFontWeight: '100 900' | '400';
};

export const DEVANAGARI_FONT_CATALOG: readonly FontCatalogEntry[] = [
  {
    family: 'NotoSansDevanagari',
    label: 'Noto Sans',
    description: 'Clean and neutral; bundled with the app',
    bundled: true,
    cssFontWeight: '100 900',
  },
  {
    family: 'Mukta',
    label: 'Mukta',
    description: 'Open, readable Devanagari proportions',
    bundled: false,
    cssFontWeight: '400',
  },
] as const;

const FONT_MODULES: Partial<Record<DevanagariFontFamily, number>> = {
  NotoSansDevanagari: require('../../assets/fonts/NotoSansDevanagari-Variable.ttf') as number,
};

// Pinned to an immutable Google Fonts commit verified on 2026-07-14. The repository states
// that family directories contain redistributable font files plus their licenses. Every entry
// below must live under `ofl/` and ship an OFL.txt in the same directory.
const GOOGLE_FONTS_COMMIT = 'ec0464b978de222073645d6d3366f3fdf03376d8';
const DOWNLOADABLE_FONTS: Partial<
  Record<DevanagariFontFamily, { relativePath: string; byteSize: number }>
> = {
  Mukta: { relativePath: 'ofl/mukta/Mukta-Regular.ttf', byteSize: 432_248 },
};

const base64Cache = new Map<DevanagariFontFamily, string>();
const loadedFonts = new Set<DevanagariFontFamily>(['NotoSansDevanagari']);

/** Human-readable UI label for a registered font family. */
export function fontLabel(family: DevanagariFontFamily): string {
  return DEVANAGARI_FONT_CATALOG.find((font) => font.family === family)?.label ?? family;
}

/** CSS `@font-face` weight descriptor for the exact registered font file. */
export function fontFaceWeight(family: DevanagariFontFamily): '100 900' | '400' {
  const font = DEVANAGARI_FONT_CATALOG.find((entry) => entry.family === family);
  if (!font) throw new Error(`No font catalog entry is registered for ${family}`);
  return font.cssFontWeight;
}

function downloadableFontUri(family: DevanagariFontFamily): string {
  if (!FileSystem.documentDirectory) {
    throw new Error('Font storage is unavailable on this device');
  }
  return `${FileSystem.documentDirectory}fonts/${family}.ttf`;
}

async function readAndValidateFont(
  family: DevanagariFontFamily,
  uri: string,
  expectedByteSize: number,
): Promise<string> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || info.size !== expectedByteSize) {
    throw new Error(`Downloaded ${fontLabel(family)} font failed its size check`);
  }
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (!base64.startsWith('AAEAAA') && !base64.startsWith('T1RUTw')) {
    throw new Error(`Downloaded ${fontLabel(family)} file is not a valid OpenType font`);
  }
  return base64;
}

/**
 * Downloads a curated Unicode Devanagari font from an immutable official Google Fonts URL,
 * validates its exact byte size and OpenType signature, loads it into React Native, and caches
 * it for later export embedding. Bundled fonts return immediately without network access.
 */
export async function installFontFamily(family: DevanagariFontFamily): Promise<void> {
  if (loadedFonts.has(family)) return;
  const remote = DOWNLOADABLE_FONTS[family];
  if (!remote) throw new Error(`No downloadable font source is registered for ${family}`);

  const uri = downloadableFontUri(family);
  await FileSystem.makeDirectoryAsync(uri.slice(0, uri.lastIndexOf('/')), {
    intermediates: true,
  });
  let base64: string;
  try {
    base64 = await readAndValidateFont(family, uri, remote.byteSize);
  } catch {
    await FileSystem.deleteAsync(uri, { idempotent: true });
    const url = `https://raw.githubusercontent.com/google/fonts/${GOOGLE_FONTS_COMMIT}/${remote.relativePath}`;
    await FileSystem.downloadAsync(url, uri);
    base64 = await readAndValidateFont(family, uri, remote.byteSize);
  }

  await Font.loadAsync({ [family]: uri });
  base64Cache.set(family, base64);
  loadedFonts.add(family);
}

/** Returns whether a family is already usable in the current app session. */
export function isFontFamilyLoaded(family: DevanagariFontFamily): boolean {
  return loadedFonts.has(family);
}

/**
 * Returns a Devanagari font as base64 for an inline export `@font-face`. Downloaded families
 * are installed and validated first; local file paths are never passed to the print WebView.
 */
export async function getFontBase64(family: DevanagariFontFamily): Promise<string> {
  const cached = base64Cache.get(family);
  if (cached) return cached;

  const bundledModule = FONT_MODULES[family];
  if (bundledModule !== undefined) {
    const asset = Asset.fromModule(bundledModule);
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

  await installFontFamily(family);
  const installed = base64Cache.get(family);
  if (!installed) throw new Error(`Font ${family} was installed but could not be read`);
  return installed;
}
