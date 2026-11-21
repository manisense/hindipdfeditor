import type { EditFontFamily, MatchedFontFamily } from './fontAsset';
import type { FontHint } from '../state/editStore';

const BOLD = /bold|black|heavy|semibold|demibold|extrabold|ultrabold/i;
const ITALIC = /italic|oblique|slanted/i;
const SERIF_NAMES =
  /times|georgia|cambria|garamond|book ?antiqua|palatino|serif|kokila|aparajita|utsaah|kruti|chanakya|tiro/i;
const SANS_NAMES = /sans|arial|helvetica|calibri|verdana|tahoma|segoe|hind|mukta|mangal|nirmala|poppins/i;

/** Original typefaces with a bundled exact or metric-compatible match. */
const MATCHES: [RegExp, MatchedFontFamily][] = [
  [/^hind/i, 'Hind'],
  [/times|tinos/i, 'Tinos'],
  [/arial(?!.*unicode)|helvetica|arimo|liberation ?sans/i, 'Arimo'],
  [/calibri|carlito/i, 'Carlito'],
  [/cambria|caladea/i, 'Caladea'],
];

/**
 * Describes the original font of a text run so the replacement can match its look.
 *
 * @param name PDF font name, subset tag allowed (e.g. `ABCDEE+Cambria,BoldItalic`).
 * @param genericFamily pdf.js generic family for the font (`serif`, `sans-serif`, ...).
 * @param sheared Whether the run's text matrix is sheared (synthetic italic).
 */
export function fontHintFromPdfFont(
  name: string | undefined,
  genericFamily: string | undefined,
  sheared: boolean,
): FontHint {
  const bare = (name ?? '').replace(/^[A-Z]{6}\+/, '');
  const serif = SANS_NAMES.test(bare)
    ? /serif/i.test(bare) && !/sans/i.test(bare)
    : SERIF_NAMES.test(bare) || genericFamily === 'serif';
  const match = MATCHES.find(([pattern]) => pattern.test(bare))?.[1];
  return {
    serif,
    bold: BOLD.test(bare),
    italic: sheared || ITALIC.test(bare),
    ...(match ? { match } : {}),
  };
}

/** Bundled font settings that best match a font hint. */
export function replacementFontFor(hint: FontHint | undefined): {
  fontFamily: EditFontFamily;
  fontWeight: 'normal' | 'bold';
  fontStyle?: 'italic';
} {
  return {
    fontFamily: hint?.match ?? (hint?.serif ? 'NotoSerifDevanagari' : 'NotoSansDevanagari'),
    fontWeight: hint?.bold ? 'bold' : 'normal',
    ...(hint?.italic ? { fontStyle: 'italic' as const } : {}),
  };
}
