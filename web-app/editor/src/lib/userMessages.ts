/** A user-facing message in both UI languages; screens show the one the user chose. */
export type Bilingual = { en: string; hi: string };

/** More pages than this are refused: every page is rasterised up front and long files can crash a phone tab. */
export const MAX_EDIT_PAGES = 150;

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : '';
}

/**
 * Explains why a PDF could not be opened, without exposing library error text.
 *
 * @param error What pdf.js or the editor threw while opening.
 */
export function openFailureMessage(error: unknown): Bilingual {
  if (errorName(error) === 'PasswordException') {
    return {
      en: 'This PDF is password-protected. Open it in a PDF reader, save a copy without the password, then open that copy here.',
      hi: 'यह PDF पासवर्ड से सुरक्षित है। इसे किसी PDF रीडर में खोलकर बिना पासवर्ड वाली कॉपी सेव करें, फिर वह कॉपी यहाँ खोलें।',
    };
  }
  if (errorName(error) === 'InvalidPDFException' || errorName(error) === 'FormatError') {
    return {
      en: 'This file is not a valid PDF or is damaged. Try downloading it again.',
      hi: 'यह फ़ाइल सही PDF नहीं है या खराब हो गई है। इसे दोबारा डाउनलोड करके देखें।',
    };
  }
  return {
    en: 'Something went wrong while reading this PDF. Try again, or try a different copy of the file.',
    hi: 'यह PDF पढ़ते समय कुछ गड़बड़ हुई। दोबारा कोशिश करें या फ़ाइल की कोई दूसरी कॉपी आज़माएँ।',
  };
}

/** Message for a PDF with more pages than the editor accepts. */
export function tooManyPagesMessage(pageCount: number): Bilingual {
  return {
    en: `This PDF has ${pageCount} pages; the editor handles up to ${MAX_EDIT_PAGES}. Use Split PDF to take out the pages you need, then edit those.`,
    hi: `इस PDF में ${pageCount} पेज हैं; एडिटर ${MAX_EDIT_PAGES} पेज तक संभालता है। Split PDF से ज़रूरी पेज अलग करें, फिर उन्हें एडिट करें।`,
  };
}

/** Message for an export that failed; the technical cause goes to the console, not the screen. */
export function exportFailureMessage(): Bilingual {
  return {
    en: 'The edited PDF could not be created. Your edits are still here; try downloading again.',
    hi: 'बदली हुई PDF नहीं बन पाई। आपके बदलाव सुरक्षित हैं; दोबारा डाउनलोड करके देखें।',
  };
}
