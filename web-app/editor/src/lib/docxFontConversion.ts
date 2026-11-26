import JSZip from "jszip";

import { krutiDevToUnicode } from "./krutiDev";
import { unicodeToKrutiDev } from "./unicodeToKrutiDev";

/**
 * Converts the Hindi text of a Word (.docx) file between Unicode and KrutiDev 010, keeping every
 * other part of the file (layout, tables, pictures, styles, English text) as it is.
 *
 * - Unicode → KrutiDev: Devanagari stretches are converted and set in "Kruti Dev 010". English
 *   words in the same run are split into their own run and keep their font, so they still read as
 *   English.
 * - KrutiDev → Unicode: only runs whose font resolves to the KrutiDev family (KrutiDev, DevLys) are
 *   converted, and they are set in Mangal. Runs in any other font are left alone, so English text
 *   is never misread as KrutiDev.
 *
 * Word keeps Devanagari in the complex-script slot (`w:cs`, `w:szCs`, `w:bCs`) and KrutiDev, which
 * is Latin key codes, in the Latin slot (`w:ascii`, `w:sz`, `w:b`), so size, bold and italic are
 * copied to the slot the converted text uses.
 */

export type DocxConversionDirection = "unicode-to-krutidev" | "krutidev-to-unicode";

export type DocxConversionResult = {
  /** The converted .docx file. */
  bytes: Uint8Array;
  /** Text pieces converted; 0 means the file had nothing to convert. */
  converted: number;
  /** Non-Latin characters KrutiDev cannot show, kept unchanged (Unicode → KrutiDev only). */
  unsupported: string[];
};

/** Thrown when the file is not a .docx Word file (for example an old .doc or a renamed PDF). */
export class NotDocxError extends Error {
  constructor() {
    super("This file is not a Word .docx file.");
    this.name = "NotDocxError";
  }
}

export const KRUTIDEV_FONT = "Kruti Dev 010";
export const UNICODE_HINDI_FONT = "Mangal";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const XML_NS = "http://www.w3.org/XML/1998/namespace";
const PARTS = /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/u;

const DEVANAGARI = /[ऀ-ॿ]/u;
/** Unicode combining marks that cannot start a run without breaking their syllable. */
const LEADING_MARKS = /^[ऀ-ःऺ-ॏ॑-ॗॢॣ]+/u;
/** After a run ending in virama, the rest of the cluster and its marks belong with it. */
const LEADING_CLUSTER =
  /^[क-हक़-य़]़?(?:्[क-हक़-य़]़?)*[ऀ-ःऺ-ौॎॏ॑-ॗॢॣ]*/u;
/** KrutiDev keys for marks typed after their letter; a run cannot start with one. */
const LEADING_KRUTI_MARKS = /^[khqw`sSa¡%WZzª~+‚îÓ]+/u;
/** English words, with the spaces, digits and punctuation between them. */
const LATIN_SPAN = /[A-Za-z]+(?:[^ऀ-ॿA-Za-z]+[A-Za-z]+)*/gu;

/**
 * Converts the Hindi text of a .docx file.
 *
 * @param input The .docx file's bytes.
 * @param direction Which way to convert.
 */
export async function convertDocxFonts(
  input: ArrayBuffer | Uint8Array,
  direction: DocxConversionDirection,
): Promise<DocxConversionResult> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(input);
  } catch {
    throw new NotDocxError();
  }
  if (!zip.file("word/document.xml")) throw new NotDocxError();

  const styles = await readStyles(zip);
  let converted = 0;
  const unsupported = new Set<string>();
  for (const name of Object.keys(zip.files).filter((path) => PARTS.test(path))) {
    const file = zip.file(name);
    if (!file) continue;
    const doc = new DOMParser().parseFromString(await file.async("string"), "application/xml");
    if (doc.getElementsByTagName("parsererror").length > 0) throw new NotDocxError();
    for (const paragraph of descendants(doc, "p")) {
      const pieces = paragraphPieces(paragraph, styles);
      const result =
        direction === "unicode-to-krutidev"
          ? convertUnicodePieces(doc, pieces)
          : convertKrutiPieces(doc, pieces);
      converted += result.converted;
      for (const char of result.unsupported) unsupported.add(char);
    }
    zip.file(name, new XMLSerializer().serializeToString(doc));
  }
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return { bytes, converted, unsupported: [...unsupported] };
}

type Piece = { run: Element; text: Element; font: string | null };

/** Each `w:t` of a paragraph in reading order, after giving every text its own run. */
function paragraphPieces(paragraph: Element, styles: StyleFonts): Piece[] {
  const paragraphStyle = childAttr(child(child(paragraph, "pPr"), "pStyle"), "val");
  const pieces: Piece[] = [];
  for (const run of descendants(paragraph, "r")) {
    if (closest(run, "p") !== paragraph) continue;
    for (const single of splitRunPerText(run)) {
      const text = child(single, "t");
      if (!text) continue;
      pieces.push({ run: single, text, font: runFont(single, paragraphStyle, styles) });
    }
  }
  return pieces;
}

function convertUnicodePieces(doc: Document, pieces: Piece[]) {
  rejoinSplitSyllables(pieces, (prev) => (prev.endsWith("्") ? LEADING_CLUSTER : LEADING_MARKS));
  let converted = 0;
  const unsupported: string[] = [];
  for (const piece of pieces) {
    const value = piece.text.textContent ?? "";
    if (!DEVANAGARI.test(value)) continue;
    for (const segment of splitByScript(value)) {
      const run = piece.run.cloneNode(true) as Element;
      piece.run.parentNode?.insertBefore(run, piece.run);
      const text = child(run, "t")!;
      if (segment.hindi) {
        const result = unicodeToKrutiDev(segment.text);
        setText(text, result.text);
        setRunFont(doc, run, KRUTIDEV_FONT, "toLatin");
        unsupported.push(...result.unsupported);
        converted += 1;
      } else {
        setText(text, segment.text);
      }
    }
    piece.run.parentNode?.removeChild(piece.run);
  }
  return { converted, unsupported };
}

function convertKrutiPieces(doc: Document, allPieces: Piece[]) {
  const pieces = allPieces.filter((piece) => piece.font !== null && isKrutiDevFamilyFont(piece.font));
  // A run ending in `f` (ि, typed before its consonant) gives the `f` to the next run.
  for (let i = 0; i + 1 < pieces.length; i += 1) {
    const prev = pieces[i].text.textContent ?? "";
    if (prev.endsWith("f")) {
      setText(pieces[i].text, prev.slice(0, -1));
      setText(pieces[i + 1].text, `f${pieces[i + 1].text.textContent ?? ""}`);
    }
  }
  rejoinSplitSyllables(pieces, () => LEADING_KRUTI_MARKS);
  for (const piece of pieces) {
    setText(piece.text, krutiDevToUnicode(piece.text.textContent ?? ""));
    setRunFont(doc, piece.run, UNICODE_HINDI_FONT, "toComplex");
  }
  return { converted: pieces.length, unsupported: [] as string[] };
}

/**
 * Word splits runs anywhere (spell check, edits), sometimes inside a syllable. Marks at the start
 * of a run are moved to the end of the previous one, so each syllable is converted in one piece.
 */
function rejoinSplitSyllables(pieces: Piece[], leading: (prev: string) => RegExp) {
  for (let i = 1; i < pieces.length; i += 1) {
    const prev = pieces[i - 1].text.textContent ?? "";
    const next = pieces[i].text.textContent ?? "";
    const moved = leading(prev).exec(next)?.[0] ?? "";
    if (!moved || prev === "") continue;
    setText(pieces[i - 1].text, prev + moved);
    setText(pieces[i].text, next.slice(moved.length));
  }
}

/** Splits text into Hindi stretches (converted) and English stretches (kept). */
function splitByScript(text: string): { text: string; hindi: boolean }[] {
  const segments: { text: string; hindi: boolean }[] = [];
  let last = 0;
  for (const match of text.matchAll(LATIN_SPAN)) {
    const start = match.index ?? 0;
    if (start > last) segments.push({ text: text.slice(last, start), hindi: true });
    segments.push({ text: match[0], hindi: false });
    last = start + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), hindi: true });
  return segments.map((segment) => ({ ...segment, hindi: segment.hindi && DEVANAGARI.test(segment.text) }));
}

/** Gives each text of a run its own run, so a run's font applies to exactly one text. */
function splitRunPerText(run: Element): Element[] {
  const content = Array.from(run.childNodes).filter(
    (node): node is Element => node.nodeType === 1 && (node as Element).localName !== "rPr",
  );
  if (content.length <= 1) return [run];
  const properties = child(run, "rPr");
  const runs = content.map((node) => {
    const single = run.ownerDocument.createElementNS(W, "w:r");
    if (properties) single.appendChild(properties.cloneNode(true));
    single.appendChild(node);
    run.parentNode?.insertBefore(single, run);
    return single;
  });
  run.parentNode?.removeChild(run);
  return runs;
}

/**
 * Sets the run's font in every slot and copies size, bold and italic to the slot the converted
 * text uses: Latin for KrutiDev key codes, complex script for Unicode Devanagari.
 */
function setRunFont(doc: Document, run: Element, font: string, to: "toLatin" | "toComplex") {
  let properties = child(run, "rPr");
  if (!properties) {
    properties = doc.createElementNS(W, "w:rPr");
    run.insertBefore(properties, run.firstChild);
  }
  let fonts = child(properties, "rFonts");
  if (!fonts) {
    fonts = doc.createElementNS(W, "w:rFonts");
    properties.insertBefore(fonts, properties.firstChild);
  }
  for (const slot of ["ascii", "hAnsi", "cs", "eastAsia"]) {
    removeWAttr(fonts, slot);
    fonts.setAttributeNS(W, `w:${slot}`, font);
  }
  for (const slot of ["asciiTheme", "hAnsiTheme", "cstheme", "eastAsiaTheme"]) removeWAttr(fonts, slot);

  const pairs: [string, string][] = [
    ["sz", "szCs"],
    ["b", "bCs"],
    ["i", "iCs"],
  ];
  for (const [latin, complex] of pairs) {
    const [from, target] = to === "toLatin" ? [complex, latin] : [latin, complex];
    const source = child(properties, from);
    if (source && !child(properties, target)) {
      const copy = doc.createElementNS(W, `w:${target}`);
      for (const attr of Array.from(source.attributes)) copy.setAttributeNS(attr.namespaceURI, attr.name, attr.value);
      properties.insertBefore(copy, source.nextSibling);
    }
  }
}

function setText(text: Element, value: string) {
  text.textContent = value;
  if (text.getAttribute("xml:space") !== "preserve") text.setAttributeNS(XML_NS, "xml:space", "preserve");
}

/** True for KrutiDev-family font names as Word writes them: "Kruti Dev 010", "DevLys 010". */
export function isKrutiDevFamilyFont(name: string): boolean {
  return /^(krutidev|devlys)/iu.test(name.replace(/[\s_-]/gu, ""));
}

type StyleFonts = { byId: Map<string, { font: string | null; basedOn: string | null }>; defaultFont: string | null };

async function readStyles(zip: JSZip): Promise<StyleFonts> {
  const byId = new Map<string, { font: string | null; basedOn: string | null }>();
  const file = zip.file("word/styles.xml");
  if (!file) return { byId, defaultFont: null };
  const doc = new DOMParser().parseFromString(await file.async("string"), "application/xml");
  for (const style of descendants(doc, "style")) {
    const id = wAttr(style, "styleId");
    if (!id) continue;
    byId.set(id, {
      font: childAttr(child(child(style, "rPr"), "rFonts"), "ascii"),
      basedOn: childAttr(child(style, "basedOn"), "val"),
    });
  }
  const defaults = descendants(doc, "rPrDefault")[0];
  const defaultFont = childAttr(child(child(defaults ?? null, "rPr"), "rFonts"), "ascii");
  return { byId, defaultFont };
}

/** The Latin-slot font a run is shown in: its own, its character style, its paragraph style, then the default. */
function runFont(run: Element, paragraphStyle: string | null, styles: StyleFonts): string | null {
  const properties = child(run, "rPr");
  const own = childAttr(child(properties, "rFonts"), "ascii");
  if (own) return own;
  return (
    styleFont(childAttr(child(properties, "rStyle"), "val"), styles) ??
    styleFont(paragraphStyle, styles) ??
    styleFont("Normal", styles) ??
    styles.defaultFont
  );
}

function styleFont(id: string | null, styles: StyleFonts): string | null {
  const seen = new Set<string>();
  let current = id;
  while (current && !seen.has(current)) {
    seen.add(current);
    const style = styles.byId.get(current);
    if (!style) return null;
    if (style.font) return style.font;
    current = style.basedOn;
  }
  return null;
}

function child(parent: Element | null, localName: string): Element | null {
  if (!parent) return null;
  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType === 1 && (node as Element).namespaceURI === W && (node as Element).localName === localName) {
      return node as Element;
    }
  }
  return null;
}

function childAttr(element: Element | null, name: string): string | null {
  return element ? wAttr(element, name) : null;
}

/** Elements in the Word namespace, matched by local name (prefix-independent). */
function descendants(root: Document | Element, localName: string): Element[] {
  return Array.from(root.getElementsByTagName("*")).filter(
    (element) => element.namespaceURI === W && element.localName === localName,
  );
}

function findWAttr(element: Element, name: string): Attr | null {
  for (const attr of Array.from(element.attributes)) {
    if ((attr.namespaceURI === W && attr.localName === name) || attr.name === `w:${name}`) return attr;
  }
  return null;
}

/** A Word-namespace attribute's value, or null when missing or empty. */
function wAttr(element: Element, name: string): string | null {
  return findWAttr(element, name)?.value || null;
}

function removeWAttr(element: Element, name: string) {
  const attr = findWAttr(element, name);
  if (attr) element.removeAttribute(attr.name);
}

function closest(node: Element, localName: string): Element | null {
  let current = node.parentNode as Element | null;
  while (current && current.nodeType === 1) {
    if (current.namespaceURI === W && current.localName === localName) return current;
    current = current.parentNode as Element | null;
  }
  return null;
}
