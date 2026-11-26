import { describe, expect, it } from "vitest";

import {
  combineEmbeddedLatinWithOcr,
  canJudgeDevanagari,
  embeddedDevanagariVerdict,
  hasDevanagari,
  isEmbeddedDevanagariCorrupted,
  isLikelyOcrNoise,
  missedDevanagariRows,
  trimOcrBorderNoise,
  verificationSample,
} from "./embeddedTextVerification";
import type { OcrLine } from "../state/editStore";

function line(text: string, yPt: number, source: OcrLine["source"]): OcrLine {
  return { id: `${source}-${yPt}`, text, xPt: 100, yPt, wPt: 300, hPt: 12, source };
}

const CORRECT =
  "अभ्यर्थियों को सूचित किया जाता है कि वे अधिक जानकारी और अपडेट के लिए नियमित रूप से बैंक की वेबसाइट देखें। " +
  "सभी पत्राचार केवल अभ्यर्थी द्वारा अपने ऑनलाइन आवेदन पत्र में उल्लिखित ईमेल आईडी पर ही किए जाएंगे। " +
  "आवेदन के पंजीकरण की प्रक्रिया तभी पूरी होगी जब शुल्क भुगतान की अंतिम तारीख से पहले बैंक में शुल्क जमा कर दिया जाएगा। " +
  "बैंक ऑफ़ बड़ौदा में अधीनस्थ कर्मचारी संवर्ग में नियमित आधार पर कार्यालय सहायक की भर्ती होगी और सूचना दी जाएगी।";

// The Bank of Baroda notice's broken map: the ि and reph glyphs map to their base consonant,
// so नियमित is stored as ननयममत and कर्मचारी as कममचारी.
const CORRUPTED = CORRECT.replace(/([क-ह]़?)ि/gu, "$1$1").replace(/र्([क-ह])/gu, "$1$1");

describe("isEmbeddedDevanagariCorrupted", () => {
  it("accepts embedded text that OCR reads the same way", () => {
    expect(isEmbeddedDevanagariCorrupted(CORRECT, CORRECT)).toBe(false);
  });

  it("flags a broken text map whose complex words OCR never sees", () => {
    expect(isEmbeddedDevanagariCorrupted(CORRUPTED, CORRECT)).toBe(true);
  });

  it("does not judge pages with too little Devanagari", () => {
    expect(isEmbeddedDevanagariCorrupted("कममचारी की भती", "कर्मचारी की भर्ती")).toBe(false);
    expect(isEmbeddedDevanagariCorrupted("Plain English text only", "")).toBe(false);
  });
});

it("hasDevanagari", () => {
  expect(hasDevanagari("abc क")).toBe(true);
  expect(hasDevanagari("abc")).toBe(false);
});

describe("combineEmbeddedLatinWithOcr", () => {
  it("keeps embedded Latin lines, takes Hindi from OCR and drops corrupted embedded Hindi", () => {
    const embedded = [
      line("कममचारी संवर्म में ननयममत", 100, "embedded"),
      line("BOB/HRM/REC/ADVT/2025/05", 140, "embedded"),
      line(",", 180, "embedded"),
    ];
    const ocr = [
      line("कर्मचारी संवर्ग में नियमित", 101, "ocr"),
      line("808/मार/र60/407/7/2025/05", 141, "ocr"),
      line("नई पंक्ति", 180, "ocr"),
    ];
    const result = combineEmbeddedLatinWithOcr(embedded, ocr);
    expect(result.map((l) => l.text)).toEqual([
      "कर्मचारी संवर्ग में नियमित",
      "BOB/HRM/REC/ADVT/2025/05",
      "नई पंक्ति",
    ]);
    expect(result.every((l) => l.source === "embedded-degraded")).toBe(true);
  });
});

describe("missedDevanagariRows", () => {
  it("joins split fragments of a row OCR skipped and pads the box", () => {
    const fragment = (text: string, xPt: number, wPt: number): OcrLine => ({
      id: text, text, xPt, yPt: 150, wPt, hPt: 10, source: "embedded",
    });
    const embedded = [
      fragment(" ध्य", 270, 2),
      fragment("ान देने योग्य महत्वपूणम बा", 270, 54),
      fragment("तें", 347, 5),
      line("कममचारी संवर्म", 100, "embedded"),
      line("BOB/HRM", 300, "embedded"),
    ];
    const ocr = [line("कर्मचारी संवर्ग", 101, "ocr")];
    expect(missedDevanagariRows(embedded, ocr)).toEqual([
      {
        crop: { xPt: 264, yPt: 147, wPt: 94, hPt: 16 },
        line: { xPt: 264, yPt: 150, wPt: 94, hPt: 10 },
      },
    ]);
  });
});

it("treats logo and border fragments as OCR noise but keeps real low-confidence headings", () => {
  expect(isLikelyOcrNoise("पड) छिक्षा 0 82008 रे", 33)).toBe(true);
  expect(isLikelyOcrNoise("६. बन ऊ ही हैं ४4 5- भा", 17)).toBe(true);
  expect(isLikelyOcrNoise(". . राज्यवार रिक्तियों और पदों में आरक्षण का विवरण", 40)).toBe(false);
  expect(isLikelyOcrNoise("ध्यान देने योग्य महत्वपूर्ण बातें", 86)).toBe(false);
});

it("trims table-border marks from OCR line ends but keeps real punctuation", () => {
  expect(trimOcrBorderNoise("* | पत्र/ सूचना आदि")).toBe("पत्र/ सूचना आदि");
  expect(trimOcrBorderNoise("'ध्यान देने योग्य महत्वपूर्ण बातें |")).toBe("ध्यान देने योग्य महत्वपूर्ण बातें");
  expect(trimOcrBorderNoise("(चपरासी) की भर्ती।")).toBe("(चपरासी) की भर्ती।");
  expect(trimOcrBorderNoise("1. अभ्यर्थी")).toBe("1. अभ्यर्थी");
});

it("sizes OCR lines from the PDF run they cover, not the taller OCR box", () => {
  const embedded = [line("कममचारी संवर्म", 100, "embedded")]; // 12 pt run at y 100
  const tallOcr: OcrLine = {
    id: "o", text: "1. कर्मचारी संवर्ग", xPt: 90, yPt: 96, wPt: 320, hPt: 22, source: "ocr",
  };
  const [result] = combineEmbeddedLatinWithOcr(embedded, [tallOcr]);
  expect(result).toMatchObject({ text: "1. कर्मचारी संवर्ग", xPt: 90, wPt: 320, yPt: 100, hPt: 12 });
});

describe("verificationSample", () => {
  const line = (text: string, i: number): OcrLine => ({ id: `l${i}`, text, xPt: 50, yPt: 100 + i * 20, wPt: 400, hPt: 14 });
  // Each line: 5 complex words (with ि) and 5 plain ones.
  const text = "किताब लिखा दिन मिला सिर कमल घर जल नल बस";

  it("takes the top lines of a long page, with enough words of each kind", () => {
    const lines = Array.from({ length: 40 }, (_, i) => line(text, i));
    const sample = verificationSample(lines);
    expect(sample).not.toBeNull();
    // 30 words of each kind need 6 lines.
    expect(sample?.text.split(" ").length).toBe(60);
    expect(sample?.yPt).toBe(100);
    expect(sample?.hPt).toBe(5 * 20 + 14);
  });

  it("needs the whole page when it has too little text, or the band would be most of it", () => {
    expect(verificationSample(Array.from({ length: 4 }, (_, i) => line(text, i)))).toBeNull();
    expect(verificationSample(Array.from({ length: 8 }, (_, i) => line(text, i)))).toBeNull();
    expect(verificationSample([])).toBeNull();
  });
});

describe("embeddedDevanagariVerdict for converted KrutiDev text", () => {
  const words = (word: string, n: number) => Array.from({ length: n }, () => word).join(" ");
  // 20 complex words (10 read by OCR, 10 misread) and 20 plain ones (all read).
  const embedded = `${words("जनजाति", 10)} ${words("अनुसूचित", 10)} ${words("कमल", 20)}`;

  it("keeps a conversion when OCR misses many complex words in small table text", () => {
    // OCR found the plain words and only some complex ones: a ratio test would call this broken.
    const ocr = "कमल जनजाति";
    expect(embeddedDevanagariVerdict(embedded, ocr)).toBe("corrupted");
    expect(embeddedDevanagariVerdict(embedded, ocr, { converted: true })).toBe("ok");
  });

  it("rejects a conversion that matches almost nothing", () => {
    expect(embeddedDevanagariVerdict(embedded, "राम श्याम सीता गीता", { converted: true })).toBe("corrupted");
  });
});

describe("canJudgeDevanagari", () => {
  const words = (word: string, n: number) => Array.from({ length: n }, () => word).join(" ");

  it("needs enough words of both kinds for a verdict", () => {
    expect(canJudgeDevanagari("अध्याय 12 — Chapter 12")).toBe(false);
    expect(canJudgeDevanagari(words("किताब", 40))).toBe(false);
    expect(canJudgeDevanagari(`${words("किताब", 15)} ${words("कमल", 15)}`)).toBe(true);
  });
});
