import type { DevanagariFontFamily } from './fontAsset';
import type { FontHint } from '../state/editStore';

const BOLD = /bold|black|heavy|semibold|demibold|extrabold|ultrabold/i;
const ITALIC = /italic|oblique|slanted/i;
const SERIF_NAMES =
  /times|georgia|cambria|garamond|book ?antiqua|palatino|serif|kokila|aparajita|utsaah|kruti|chanakya|tiro/i;
const SANS_NAMES = /sans|arial|helvetica|calibri|verdana|tahoma|segoe|hind|mukta|mangal|nirmala|poppins/i;

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
  return { serif, bold: BOLD.test(bare), italic: sheared || ITALIC.test(bare) };
}

/** Bundled font settings that best match a font hint. */
export function replacementFontFor(hint: FontHint | undefined): {
  fontFamily: DevanagariFontFamily;
  fontWeight: 'normal' | 'bold';
  fontStyle?: 'italic';
} {
  return {
    fontFamily: hint?.serif ? 'NotoSerifDevanagari' : 'NotoSansDevanagari',
    fontWeight: hint?.bold ? 'bold' : 'normal',
    ...(hint?.italic ? { fontStyle: 'italic' as const } : {}),
  };
}
