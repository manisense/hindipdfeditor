import { ArrowLeftRight, Check, Copy } from "lucide-react";
import { useMemo, useState } from "react";

import { AppButton } from "../components/AppButton";
import { AppStatus } from "../components/AppStatus";
import { DropZone } from "../components/DropZone";
import { ToolShell } from "../components/ToolShell";
import { trackToolEvent } from "../lib/analytics";
import {
  convertDocxFonts,
  KRUTIDEV_FONT,
  NotDocxError,
  UNICODE_HINDI_FONT,
  type DocxConversionDirection,
} from "../lib/docxFontConversion";
import { downloadBlob } from "../lib/downloadBlob";
import { useLanguage, useTx } from "../lib/i18n";
import { krutiDevToUnicode } from "../lib/krutiDev";
import { getTool, toolHref } from "../lib/tools";
import { unicodeToKrutiDev } from "../lib/unicodeToKrutiDev";
import "./UtilityTool.css";
import "./FontConverterTool.css";

const tool = getTool("unicode-to-krutidev")!;

type Direction = DocxConversionDirection;

const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function initialDirection(): Direction {
  const value = new URLSearchParams(window.location.search).get("direction");
  return value === "krutidev-to-unicode" ? "krutidev-to-unicode" : "unicode-to-krutidev";
}

type FileResult =
  | { kind: "done"; filename: string; converted: number; unsupported: string[] }
  | { kind: "nothing" }
  | { kind: "error"; notDocx: boolean };

/** Unicode ↔ KrutiDev 010 for pasted text and Word (.docx) files, in the browser. */
export function FontConverterTool() {
  const tx = useTx();
  const { lang } = useLanguage();
  const [direction, setDirection] = useState<Direction>(initialDirection);
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fileResult, setFileResult] = useState<FileResult | null>(null);

  const toKruti = direction === "unicode-to-krutidev";
  const conversion = useMemo(() => {
    if (!input) return { text: "", unsupported: [] as string[], hasLatin: false };
    return toKruti
      ? unicodeToKrutiDev(input)
      : { text: krutiDevToUnicode(input), unsupported: [] as string[], hasLatin: false };
  }, [input, toKruti]);

  const sourceLabel = toKruti ? tx("Unicode (Mangal) text", "यूनिकोड (मंगल) टेक्स्ट") : tx("KrutiDev text", "कृतिदेव टेक्स्ट");
  const targetLabel = toKruti ? tx("KrutiDev 010 text", "कृतिदेव 010 टेक्स्ट") : tx("Unicode (Mangal) text", "यूनिकोड (मंगल) टेक्स्ट");

  const changeDirection = (next: Direction) => {
    if (next === direction) return;
    setDirection(next);
    setCopied(false);
    setFileResult(null);
  };

  const swap = () => {
    setInput(conversion.text);
    changeDirection(toKruti ? "krutidev-to-unicode" : "unicode-to-krutidev");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(conversion.text);
      setCopied(true);
      trackToolEvent("export_success", "unicode-to-krutidev");
    } catch {
      setCopied(false);
    }
  };

  const convertFile = async (file: File) => {
    if (busy) return;
    setBusy(true);
    setFileResult(null);
    try {
      const result = await convertDocxFonts(await file.arrayBuffer(), direction);
      if (result.converted === 0) {
        setFileResult({ kind: "nothing" });
        return;
      }
      const base = file.name.replace(/\.docx$/i, "") || "document";
      const filename = `${base}-${toKruti ? "krutidev" : "unicode"}.docx`;
      downloadBlob(new Blob([new Uint8Array(result.bytes)], { type: DOCX_TYPE }), filename);
      trackToolEvent("export_success", "unicode-to-krutidev");
      setFileResult({ kind: "done", filename, converted: result.converted, unsupported: result.unsupported });
    } catch (err) {
      trackToolEvent("export_failed", "unicode-to-krutidev");
      setFileResult({ kind: "error", notDocx: err instanceof NotDocxError });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell tool={tool}>
      <div className="utility-tool">
        <div className="utility-tool__panel font-converter">
          <div className="font-converter__intro">
            <h1>{tx("Unicode ↔ KrutiDev converter", "यूनिकोड ↔ कृतिदेव कन्वर्टर")}</h1>
            <p>
              {tx(
                "Convert Hindi between Unicode (Mangal) and KrutiDev 010, for pasted text or a whole Word file. Your text stays on this device.",
                "हिंदी को यूनिकोड (मंगल) और कृतिदेव 010 के बीच बदलें, टेक्स्ट पेस्ट करके या पूरी वर्ड फाइल से। आपका टेक्स्ट इसी डिवाइस पर रहता है।",
              )}
            </p>
          </div>

          <div className="font-converter__direction" role="radiogroup" aria-label={tx("Conversion direction", "बदलने की दिशा")}>
            {(["unicode-to-krutidev", "krutidev-to-unicode"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={direction === value}
                className={direction === value ? "is-active" : undefined}
                onClick={() => changeDirection(value)}
              >
                {value === "unicode-to-krutidev"
                  ? tx("Unicode → KrutiDev", "यूनिकोड → कृतिदेव")
                  : tx("KrutiDev → Unicode", "कृतिदेव → यूनिकोड")}
              </button>
            ))}
          </div>

          <div className="font-converter__fields">
            <label className="font-converter__field">
              <span>{sourceLabel}</span>
              <textarea
                value={input}
                lang={toKruti ? "hi" : "en"}
                className={toKruti ? "is-devanagari" : "is-kruti"}
                placeholder={toKruti ? "भारत सरकार" : "Hkkjr ljdkj"}
                spellCheck={false}
                rows={8}
                onChange={(event) => {
                  setInput(event.target.value);
                  setCopied(false);
                }}
              />
            </label>
            <label className="font-converter__field">
              <span>{targetLabel}</span>
              <textarea
                value={conversion.text}
                readOnly
                lang={toKruti ? "en" : "hi"}
                className={toKruti ? "is-kruti" : "is-devanagari"}
                rows={8}
              />
            </label>
          </div>

          <p className="utility-tool__note">
            {toKruti
              ? tx(
                  `KrutiDev text looks like English letters here. Paste it into a document set in the ${KRUTIDEV_FONT} font to see it as Hindi.`,
                  `कृतिदेव टेक्स्ट यहाँ अंग्रेज़ी अक्षरों जैसा दिखता है। हिंदी में देखने के लिए इसे ${KRUTIDEV_FONT} फॉन्ट वाले डॉक्यूमेंट में पेस्ट करें।`,
                )
              : tx(
                  "Paste only text typed in KrutiDev or DevLys: English words in the box are converted too.",
                  "सिर्फ कृतिदेव या देवलिस में टाइप किया टेक्स्ट पेस्ट करें: बॉक्स के अंग्रेज़ी शब्द भी बदल जाते हैं।",
                )}
          </p>

          {conversion.hasLatin && (
            <AppStatus tone="warning" title={tx("English letters found", "अंग्रेज़ी अक्षर मिले")}>
              {tx(
                "English letters are kept as typed, but a KrutiDev font shows them as Hindi letters. Keep English words in a separate font, or convert a Word file below, which does this for you.",
                "अंग्रेज़ी अक्षर वैसे ही रखे गए हैं, पर कृतिदेव फॉन्ट उन्हें हिंदी अक्षरों की तरह दिखाता है। अंग्रेज़ी शब्द दूसरे फॉन्ट में रखें, या नीचे वर्ड फाइल बदलें, जो यह अपने आप करती है।",
              )}
            </AppStatus>
          )}
          {conversion.unsupported.length > 0 && (
            <AppStatus tone="warning" title={tx("Some characters have no KrutiDev form", "कुछ अक्षरों का कृतिदेव रूप नहीं है")}>
              {tx("Kept unchanged:", "बिना बदले रखे गए:")} <span lang="hi">{conversion.unsupported.join(" ")}</span>
            </AppStatus>
          )}

          <div className="utility-tool__actions">
            <AppButton
              title={tx("Clear", "साफ करें")}
              variant="ghost"
              small
              disabled={!input}
              onClick={() => {
                setInput("");
                setCopied(false);
              }}
            />
            <AppButton
              title={tx("Swap", "उलटें")}
              variant="ghost"
              small
              icon={<ArrowLeftRight size={15} aria-hidden="true" />}
              disabled={!conversion.text}
              onClick={swap}
            />
            <AppButton
              title={copied ? tx("Copied", "कॉपी हुआ") : tx("Copy result", "नतीजा कॉपी करें")}
              icon={copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
              disabled={!conversion.text}
              onClick={() => void copy()}
            />
          </div>
        </div>

        <DropZone
          kind="docx"
          compact
          disabled={busy}
          accent={tool.accent}
          title={
            toKruti
              ? tx("Convert a Word file to KrutiDev", "वर्ड फाइल को कृतिदेव में बदलें")
              : tx("Convert a KrutiDev Word file to Unicode", "कृतिदेव वर्ड फाइल को यूनिकोड में बदलें")
          }
          subtitle={
            toKruti
              ? tx(
                  `Hindi text is set in ${KRUTIDEV_FONT}; English words, tables and layout stay as they are.`,
                  `हिंदी टेक्स्ट ${KRUTIDEV_FONT} में बदलता है; अंग्रेज़ी शब्द, टेबल और लेआउट वैसे ही रहते हैं।`,
                )
              : tx(
                  `Text in KrutiDev or DevLys fonts becomes Unicode in ${UNICODE_HINDI_FONT}; text in other fonts is not touched.`,
                  `कृतिदेव या देवलिस फॉन्ट का टेक्स्ट ${UNICODE_HINDI_FONT} में यूनिकोड बनता है; दूसरे फॉन्ट का टेक्स्ट नहीं छुआ जाता।`,
                )
          }
          buttonLabel={busy ? tx("Converting…", "बदल रहे हैं…") : tx("Select .docx file", ".docx फाइल चुनें")}
          onFiles={(files) => void convertFile(files[0])}
        />

        {fileResult?.kind === "done" && (
          <AppStatus tone="success" title={tx("Word file ready", "वर्ड फाइल तैयार")}>
            {tx("Downloaded", "डाउनलोड हुई:")} {fileResult.filename}.{" "}
            {fileResult.unsupported.length > 0 &&
              `${tx("Kept unchanged, no KrutiDev form:", "कृतिदेव रूप न होने से बिना बदले:")} ${fileResult.unsupported.join(" ")}`}
          </AppStatus>
        )}
        {fileResult?.kind === "nothing" && (
          <AppStatus tone="info" title={tx("Nothing to convert", "बदलने को कुछ नहीं मिला")}>
            {toKruti
              ? tx("This file has no Unicode Hindi text.", "इस फाइल में यूनिकोड हिंदी टेक्स्ट नहीं है।")
              : tx(
                  "No text in this file uses a KrutiDev or DevLys font. If the Hindi looks like English letters in another font, copy it into the box above instead.",
                  "इस फाइल का कोई टेक्स्ट कृतिदेव या देवलिस फॉन्ट में नहीं है। अगर हिंदी किसी दूसरे फॉन्ट में अंग्रेज़ी अक्षरों जैसी दिखती है, तो उसे ऊपर के बॉक्स में कॉपी करें।",
                )}
          </AppStatus>
        )}
        {fileResult?.kind === "error" && (
          <AppStatus tone="error" title={tx("Couldn’t convert this file", "यह फाइल नहीं बदल पाई")}>
            {fileResult.notDocx
              ? tx(
                  "Only Word .docx files can be converted. Save an old .doc file as .docx in Word first.",
                  "सिर्फ वर्ड .docx फाइलें बदलती हैं। पुरानी .doc फाइल को पहले वर्ड में .docx के रूप में सेव करें।",
                )
              : tx("The file could not be read. Try saving it again in Word.", "फाइल पढ़ी नहीं जा सकी। इसे वर्ड में दोबारा सेव करके देखें।")}
          </AppStatus>
        )}

        {!toKruti && (
          <p className="utility-tool__note font-converter__pdf-link">
            {tx("Have a KrutiDev PDF?", "कृतिदेव पीडीएफ है?")}{" "}
            <a href={toolHref("krutidev", lang)}>{tx("Convert the PDF to a Unicode Word file", "पीडीएफ को यूनिकोड वर्ड फाइल में बदलें")}</a>
          </p>
        )}
      </div>
    </ToolShell>
  );
}
