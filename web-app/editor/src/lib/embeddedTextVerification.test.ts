import { describe, expect, it } from "vitest";

import {
  readsAsHindi,
  joinSplitHindiWords,
  combineEmbeddedLatinWithOcr,
  canJudgeDevanagari,
  embeddedDevanagariVerdict,
  hasDevanagari,
  hasGluedDevanagariWords,
  hasIntrinsicDevanagariCorruption,
  hasMixedUnrelatedScript,
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

describe('readsAsHindi', () => {
  const known = new Set('सभी अभिभावकों को सूचित किया जाता है कि विद्यालय का वार्षिक कार्यक्रम'.split(' '));
  const isKnown = (word: string) => known.has(word);

  it('accepts text whose words are dictionary words', () => {
    expect(readsAsHindi(Array(3).fill('सभी अभिभावकों को सूचित किया जाता है कि विद्यालय का').join(' '), isKnown)).toBe(true);
  });

  it('rejects mis-mapped text and text too short to judge', () => {
    expect(readsAsHindi(Array(3).fill('सभी अभभावकों को सूचत कया जाता है क वद्यालय का').join(' '), isKnown)).toBe(false);
    expect(readsAsHindi('सभी अभिभावकों को', isKnown)).toBe(false);
  });
});

describe('joinSplitHindiWords', () => {
  const known = new Set(['आरक्षण', 'योग्य', 'योग्यता', 'महत्व', 'पूर्ण', 'महत्वपूर्ण', 'उम्मीदवारों', 'के', 'लिए']);
  const isKnown = (word: string) => known.has(word);

  it('joins a word split by a gap when only the whole is a word', () => {
    expect(joinSplitHindiWords('के लिए आरक्ष ण तथा', isKnown)).toBe('के लिए आरक्षण तथा');
    expect(joinSplitHindiWords('योग्य ता/पात्र', isKnown)).toBe('योग्यता/पात्र');
    expect(joinSplitHindiWords('उम् मीदवारों,', isKnown)).toBe('उम्मीदवारों,');
  });

  it('keeps two real words apart', () => {
    expect(joinSplitHindiWords('महत्व पूर्ण', isKnown)).toBe('महत्व पूर्ण');
    expect(joinSplitHindiWords('के लिए', isKnown)).toBe('के लिए');
  });

  it('judges letters only, not a danda or digits after them', () => {
    // Like HindiSpeller, accept what is not a Devanagari word (so "अपेक्षितहै।" would pass).
    const speller = (word: string) => known.has(word) || /[^\u0900-\u0963\u0971-\u097F]/u.test(word);
    expect(joinSplitHindiWords('करना अपेक्षित है। उम्मीदवार', speller)).toBe('करना अपेक्षित है। उम्मीदवार');
    expect(joinSplitHindiWords('आरक्ष ण।', speller)).toBe('आरक्षण।');
  });
});

describe("hasMixedUnrelatedScript", () => {
  it("flags Devanagari words mixed with unrelated Unicode blocks (U+1B80–U+1CFF and other non-Latin scripts) even on short pages", () => {
    expect(hasMixedUnrelatedScript("पिरिश᳥")).toBe(true);
    expect(hasMixedUnrelatedScript("इस मास्टर पिरपᮢ म ᱶसमेिकत अिधसूचनाᲐ")).toBe(true);
    expect(hasMixedUnrelatedScript("03 अᲦूबर 2003")).toBe(true);
    expect(hasMixedUnrelatedScript("देखᱶ।")).toBe(true);
    expect(hasMixedUnrelatedScript("हिंदीЖशब्द")).toBe(true);
    expect(hasIntrinsicDevanagariCorruption("पिरिश᳥ पिरपᮢ")).toBe(true);
    // Counts as corrupted for verification even when the page is far too short for canJudgeDevanagari.
    expect(canJudgeDevanagari("पिरिश᳥ पिरपᮢ")).toBe(false);
    expect(embeddedDevanagariVerdict("पिरिश᳥ पिरपᮢ", "परिशिष्ट परिपत्र")).toBe("corrupted");
    expect(isEmbeddedDevanagariCorrupted("पिरिश᳥ पिरपᮢ", "परिशिष्ट परिपत्र")).toBe(true);
  });

  it("keeps clean Hindi, bilingual Hindi+English, punctuation, currency and PUA marks untouched", () => {
    expect(hasMixedUnrelatedScript(CORRECT)).toBe(false);
    expect(hasMixedUnrelatedScript("अध्याय 12 — Chapter 12 (₹ 500/-) ‘नोटिस’")).toBe(false);
    expect(hasMixedUnrelatedScript("ए.पी.(डीआइआर) सं. 22/2000-आरबी")).toBe(false);
    expect(hasMixedUnrelatedScript("स\uE0F1िवल सव\uE0F0ोच्च")).toBe(false);
  });
});

describe("hasGluedDevanagariWords", () => {
  const GLUED_SHORT_PAGE = [
    "अस्वीकरण:- स्थानीयभाषामेंअनुवादितनिर्णयकेवलवादियोंकेअपनी",
    "भाषामेंलाभकेलिएहैंतथाइनकाकिसीअन्यउद्देश्यकेलिएउपयोगनहीं",
    "कियाजासकता।निर्णयकाअंग्रेजीसंस्करणसभीव्यावहारिकऔर",
    "आधिकारिकउद्देश्योंकेलिएप्रामाणिकहोगाऔरइसेलागूकरनेमें",
    "प्राथमिकतादीजाएगी।",
    "एडवोकेटविष्णुजांगिड़",
  ].join(" ");

  it("flags pages whose Hindi is glued into a few very long tokens even when too short for canJudgeDevanagari", () => {
    expect(canJudgeDevanagari(GLUED_SHORT_PAGE)).toBe(false);
    expect(hasGluedDevanagariWords(GLUED_SHORT_PAGE)).toBe(true);
    expect(hasIntrinsicDevanagariCorruption(GLUED_SHORT_PAGE)).toBe(true);
    expect(
      embeddedDevanagariVerdict(
        GLUED_SHORT_PAGE,
        "अस्वीकरण स्थानीय भाषा में अनुवादित निर्णय केवल वादियों के अपनी भाषा में लाभ के लिए हैं",
      ),
    ).toBe("corrupted");
  });

  it("does not flag normal Hindi pages, short normal headings, or isolated long compound words", () => {
    expect(hasGluedDevanagariWords(CORRECT)).toBe(false);
    expect(hasGluedDevanagariWords("कममचारी की भती")).toBe(false);
    expect(hasGluedDevanagariWords("अध्याय 12: विश्वविद्यालय पुनर्व्यवस्थापन नियम")).toBe(false);
    // One glued typo on an otherwise normal full paragraph stays below the character-share threshold.
    expect(hasGluedDevanagariWords(`${CORRECT} स्थानीयभाषामेंअनुवादितनिर्णयकेवल`)).toBe(false);
  });
});

describe("embeddedDevanagariVerdict with a previously failed font", () => {
  it("judges a short page corrupted when its font already failed and its words disagree with OCR", () => {
    // Without fontFailed, a 3-word page stays unknown.
    expect(embeddedDevanagariVerdict("कममचारी की भती", "कर्मचारी की भर्ती")).toBe("unknown");
    // With fontFailed, disagreement on the short page is judged corrupted so OCR replaces it.
    expect(embeddedDevanagariVerdict("कममचारी की भती", "कर्मचारी की भर्ती", { fontFailed: true })).toBe("corrupted");
    // If the short page's words actually match OCR, it stays ok.
    expect(embeddedDevanagariVerdict("कर्मचारी की भर्ती", "कर्मचारी की भर्ती", { fontFailed: true })).toBe("ok");
  });
});
