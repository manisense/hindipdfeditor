# Corpus research, 27 November 2026

Survey of 36 public Hindi PDFs by Gemini 4 Neon (research only; the files themselves are not in git). Kept as evidence for the next fixes; see `docs/autonomous-log.md` for what was done with it.


**Date:** 27 November 2026  
**Scope:** 36 public official Hindi PDFs (1,111 total pages; first ≤4 pages scanned per file = 110 pages) collected from previously uncovered Indian state governments (Uttar Pradesh, Madhya Pradesh, Rajasthan, Bihar, Haryana, Uttarakhand, Jharkhand, Chhattisgarh, Himachal Pradesh), state PSCs (UPPSC, BPSC), district portals (`s3waas.gov.in`), universities (DU, Allahabad Univ, Lucknow Univ, BHU), courts (Allahabad HC, Rajasthan HC, Supreme Court of India), and banks (RBI, SBI).  
**Environment note:** All extraction metrics below were measured with Vitest calling the editor's `extractEmbeddedTextLines`, `detectLegacyFonts`, `repairMisMappedToUnicode`, `HindiSpeller` (`public/dict/hi-words.txt`), and `embeddedTextVerification` (`canJudgeDevanagari`, `readsAsHindi`) **after** applying `node scripts/patch-pdfjs.mjs` (PR #112 / ADR 0023) to untracked `node_modules/pdfjs-dist` so results match `origin/main` production behavior. *(Before patching `node_modules`, unpatched pdf.js 5 inflated Word Mangal unknown shares on `29_court_ahc` 29.0%→10.8%, `01_up_payscale` 28.5%→18.6%, and `32_court_sci` 20.3%→11.9%, confirming PR #112's effectiveness.)* Live headless-browser PDF-to-Word runs against `web-app/dist` were blocked by the local command policy (socket/server restriction), so OCR fallback handling was verified directly against `ocr.ts` (`readPageLines` / `verifyEmbeddedDevanagari`), `convertPdfToWord.ts`, and Vitest calls to `detectLegacyFonts`, `canJudgeDevanagari`, and `readsAsHindi`.

---

## 1. Corpus Inventory & Extraction Metrics (First ≤4 Pages)

Columns: **Pages** = `total(scanned)`; **Hindi W** = Devanagari words (≥2 chars) judged by `HindiSpeller`; **Unk %** = share unknown to `HindiSpeller`; **Matra** = words starting with vowel sign/virama; **PUA** = Private-Use chars `raw/extracted`; **Latin-1** = U+00A0–U+00FF chars `raw/extracted`; **Lat W** = Latin words (≥2 chars); **Legacy Det** = `detectLegacyFonts`; **ADR 0022** = `repairedFonts` (and `deg=N` / `miss=N` where non-zero).

| # | ID | Source | URL | Pages | Producer / Creator (`pdfinfo`) | Key Fonts (`pdffonts`) | Hindi W | Unk % | Matra | PUA | Latin-1 | Lat W | Legacy Det | ADR 0022 / Flags |
|---|---|--------|-----|------:|--------------------------------|------------------------|--------:|------:|------:|----:|--------:|------:|------------|------------------|
| 1 | `01_up_payscale` | UP Govt | https://www.library.up.gov.in/uploads/go/4.pdf | 7(4) | `www.ilovepdf.com` / `Microsoft® Word 2013` | `Mangal`, `Mangal-Bold`, `Calibri`, `ArialMT` | 1009 | 18.6% | 0 | 0/0 | 0/0 | 22 | none | Repaired: `ABCDEE+Mangal` (Bold skipped) |
| 2 | `02_up_revenue` | UP Govt | https://invest.up.gov.in/wp-content/uploads/2024/05/2023-08-03_230524.pdf | 4(4) | `Kodak Alaris Inc.` / `Smart Touch 1.8` | *(none)* | 0 | — | 0 | 0/0 | 0/0 | 0 | none | Pure scan |
| 3 | `03_uppsc_cal` | UPPSC | https://uppsc.up.nic.in/CMS/Examination/EC.pdf | 4(4) | `OmniPageCSDK19` / `HP Smart Document Scan 3.80` | `Helvetica`, `Times-Roman` (+4) | 0 | — | 0 | 0/0 | 7/7 | 284 | none | Invisible `Tr 3` English OCR |
| 4 | `04_up_rti` | UP Govt | https://rtionline.up.gov.in/RTI-Rules-2015-Hindi.pdf | 19(4) | `Microsoft® Office Word 2007` | `ABCDEE+Kruti Dev 010`, `Calibri` | 858 | 12.6% | 0 | 0/0 | 92/0 | 0 | Text heuristic only | Space in font name missed |
| 5 | `05_mp_1` | MP Govt (EOW) | https://eow.mp.gov.in/upload/files/915334571915.pdf | 4(4) | *(none)* / *(none)* | *(none)* | 0 | — | 0 | 0/0 | 0/0 | 0 | none | Pure scan |
| 6 | `06_mp_2` | MP Govt (Tax) | https://mptax.mp.gov.in/mpvatweb/download/home/ACTO_Transfer_Order.pdf | 9(4) | `iLovePDF` / *(none)* | `DevLys-010`, `Mangal-Regular`, `Mangal-Bold`, `LiberationSerif` (+6) | 234 | **26.5%** | 0 | 0/0 | 7/0 | 8 | `BAAAAA+DevLys-010` | Hybrid (p3-4 scan, p5 eOffice `miss=1`) |
| 7 | `07_mp_3` | MP Govt (Tax) | https://mptax.mp.gov.in/mpvatweb/download/home/Chhindwara-Division.pdf | 8(4) | `Microsoft: Print To PDF` / *(none)* | *(none)* | 0 | — | 0 | 0/0 | 0/0 | 0 | none | Rasterized scan |
| 8 | `08_mp_4` | MP Govt (Tax) | https://www.mptax.mp.gov.in/mpvatweb/download/home/ag-3.pdf | 2(2) | `PDFlib 8.0.1p3 (C++ legacy/Win32)` | *(none)* | 0 | — | 0 | 0/0 | 0/0 | 0 | none | Pure scan |
| 9 | `09_rj_jda1` | Rajasthan (JDA) | https://jdaservice.rajasthan.gov.in/PDF/Vigyapati/e9e24b2f-e855-4223-b3d2-704e8dbbb4e1.pdf | 23(4) | `Online2PDF.com` / `Online2PDF.com` | `BXZHSE+Times-Roman` | 0 | — | 0 | 0/0 | 0/0 | 0 | none | Scan (0 text items) |
| 10 | `10_rj_jda2` | Rajasthan (JDA) | https://jdaservice.rajasthan.gov.in/pdf/StandingOrder/e63ed6a6-ea45-43fb-b204-06777a70c1c8.pdf | 2(2) | `Adobe Acrobat Pro 11.0.0` / `Hewlett-Packard MFP` | *(none)* | 0 | — | 0 | 0/0 | 0/0 | 0 | none | Pure scan |
| 11 | `11_rj_doit` | Rajasthan (DOIT) | https://doitc.rajasthan.gov.in/Files/DOITCWEB/WriteReadData/EmpCUGOrders/202109270128084419088Fixation_order_10082018230.pdf | 5(4) | *(none)* / `Canon` | `Helvetica` | 0 | — | 0 | 0/0 | 0/0 | 963 | none | Invisible `Tr 3` English OCR |
| 12 | `12_br_survey` | Bihar (DLRS) | https://dlrs.bihar.gov.in/attachments/Rule/37.pdf | 2(2) | `PDFsharp 1.50.4000` / `NAPS2` | *(none)* | 0 | — | 0 | 0/0 | 0/0 | 0 | none | Pure scan |
| 13 | `13_br_sec` | Bihar (SEC) | https://sec.bihar.gov.in/Documents/Notice/202602121328534607.pdf | 1(1) | `secPdfProducer` / `Scan Assistant` | *(none)* | 0 | — | 0 | 0/0 | 0/0 | 0 | none | Pure scan |
| 14 | `14_bpsc_1` | BPSC | https://bpsc.bihar.gov.in/wp-content/uploads/BPSC_content/Notices/Final-Results-412025-MVI_BPSC-20260128-9jqix8.pdf | 2(2) | `HP Scan Extended Application` / `HP Scan` | *(none)* | 0 | — | 0 | 0/0 | 0/0 | 0 | none | Pure scan |
| 15 | `15_bpsc_2` | BPSC | https://bpsc.bihar.gov.in/wp-content/uploads/BPSC_content/Notices/Advt-43-2025-LDC-Sub-Hindi-Final-answer-key_BPSC-20251121-rbw1ay.pdf | 3(3) | `Microsoft: Print To PDF` | `CIDFont+F1`..`CIDFont+F6` | 40 | 17.5% | 0 | 0/0 | 7/0 | 28 | Text heuristic | p1-2 English key, p3 KrutiDev |
| 16 | `16_uk_ucc` | Uttarakhand | https://ucc.uk.gov.in/server/file/uploads/shared-files/ucc-rules-2025-hin.pdf | 173(4) | `iLovePDF` / *(none)* | `CIDFont+F1`..`F13` (+12) | 625 | 17.6% | 0 | 0/0 | 144/0 | 332 | Text heuristic (p3-4) | Hybrid: p1 `Tr 3` Eng OCR, p3-4 KrutiDev |
| 17 | `17_uk_gazette` | Uttarakhand | https://ucc.uk.gov.in/server/file/uploads/shared-files/ucc-acts-hin-final.pdf | 192(4) | `iLovePDF` / *(none)* | *(none)* | 0 | — | 0 | 0/0 | 0/0 | 0 | none | Pure scan (192p) |
| 18 | `18_uk_holiday` | Uttarakhand | https://eservices.uk.gov.in/docs/holidays-list.pdf | 5(4) | `OmniPageCSDK18` / `HP Smart Document Scan 3.70` | *(none)* | 0 | — | 0 | 0/0 | 0/0 | 0 | none | Pure scan |
| 19 | `19_hr_1` | Haryana Govt | https://coop.haryana.gov.in/sites/default/files/2025-12/Haryana%20Cooperative%20Societies%20Rules%2C%201989%20%28in%20Hindi%29.pdf | 48(4) | `iLovePDF` / `HP Smart Document Scan 3.70` | `Courier`, `Helvetica`, `Times-Bold` (+6) | 0 | — | 0 | 0/0 | 1/1 | 481 | none | Invisible `Tr 3` English OCR |
| 20 | `20_jh_da` | Jharkhand Govt | https://finance.jharkhand.gov.in/download/circular_notifiaction/26112026_3507.pdf | 2(2) | `iLovePDF` / *(none)* | `ArialMT` | 0 | — | 0 | 0/0 | 0/0 | 0 | none | Scan (`miss=2`, 0 text items) |
| 21 | `22_cg_mahatari` | Chhattisgarh | https://mahtarivandan.cgstate.gov.in/public_doc/aadesh.pdf | 12(4) | *(none)* / `Canon` | `Helvetica` | 0 | — | 0 | 0/0 | 0/0 | 582 | none | Invisible `Tr 3` English OCR |
| 22 | `23_hp_gazette` | Himachal Govt | https://rajpatra.hp.gov.in/OPENFILE1.aspx?ID=175/GAZETTE/2026-20/11/2026%20&etype=SPECIAL | 496(4) | `Adobe PDF Library 11.0` / `Acrobat PDFMaker 11 for Word` | `KrutiDev010`, `Mangal-Regular`, `Calibri`, `Cambria` (+7) | 823 | **34.8%** | 1 | 0/0 | 81/0 | 0 | `KrutiDev010` | KrutiDev bugs + village names |
| 23 | `24_hp_health` | Himachal Govt | https://dhsr.hp.gov.in/Files/R%20&%20P%20Rule%20Deputy%20PubicAnalyst%20(Hindi).pdf | 12(4) | `Marvell Semiconductor, Inc.` | *(none)* | 0 | — | 0 | 0/0 | 0/0 | 0 | none | Pure scan |
| 24 | `25_dist_ghazipur` | District (UP) | https://cdn.s3waas.gov.in/s3f2fc990265c712c49d51a18a32b39f0c/uploads/2026/11/17953349369706.pdf | 20(4) | `intsig.com pdf producer` (CamScanner) | *(none)* | 0 | — | 0 | 0/0 | 0/0 | 0 | none | Pure scan |
| 25 | `26_dist_rajnandgaon` | District (CG) | https://cdn.s3waas.gov.in/s34ffce04d92a4d6cb21c1494cdfcd6dc1/uploads/2026/11/17949130629684.pdf | 2(2) | `HP Scan Extended Application` / `HP Scan` | *(none)* | 0 | — | 0 | 0/0 | 0/0 | 0 | none | Pure scan |
| 26 | `27_dist_darbhanga` | District (BR) | https://cdn.s3waas.gov.in/s3beed13602b9b0e6ecb5b568ff5058f07/uploads/2024/09/2024090259.pdf | 2(2) | `Adobe PSL 1.3e for Canon` / `Canon iR2945` | *(none)* | 0 | — | 0 | 0/0 | 0/0 | 0 | none | Pure scan |
| 27 | `28_dist_gbnagar` | District (UP) | https://cdn.s3waas.gov.in/s30e01938fc48a2cfb5f2217fbfb00722d/uploads/2026/01/17672492347758.pdf | 1(1) | `Adobe Scan for Android 25.12.03` | `Times-Roman` | 0 | — | 0 | 0/0 | 8/8 | 166 | none | Invisible `Tr 3` English OCR |
| 28 | `29_court_ahc` | Allahabad HC | https://elegalix.allahabadhighcourt.in/elegalix/WebDownloadTranslatedHCJudgmentDocument.do?translatedJudgmentID=112617 | 55(4) | `Microsoft® Word 2021` | `Mangal` (x4), `Calibri` (+3) | 945 | 10.8% | 0 | 0/0 | 0/0 | 4 | none | Combining `िं` reorder bug |
| 29 | `30_court_hcraj` | Rajasthan HC | https://hcraj.nic.in/rhcjodh240618/orders/2025/206800008072025_3_H.pdf | 4(4) | `LibreOffice 6.3` / `Writer` | `NirmalaUI`, `NirmalaUI-Bold`, `ArialUnicodeMS` (+4) | 650 | **47.4%** | 3 | 0/0 | 0/0 | 13 | none | `deg=3`; p4 100% glued words |
| 30 | `32_court_sci` | Supreme Court | https://api.sci.gov.in/supremecourt_vernacular/2017/38298/38298_2017_6_42_11737_Judgement_25-Jan-2019_HIN.pdf | 3(3) | `Microsoft® Office Word 2007` | `ABCDEE+Mangal`, `ABCDEE+Mangal,Bold`, `Calibri` | 436 | 11.9% | 0 | 0/0 | 0/0 | 0 | none | Repaired: `ABCDEE+Mangal` (Bold skipped) |
| 31 | `33_univ_du` | Delhi Univ | https://www.du.ac.in/du/uploads/05062018_RTI_hindi.pdf | 1(1) | `Acrobat Distiller 9.0.0` / `PScript5.dll 5.2.2` | `JEOGNH+KrutiDev010`, `ArialMT`, `TimesNewRomanPSMT` | 217 | 8.3% | 0 | 0/0 | 3/0 | 19 | `JEOGNH+KrutiDev010` | Smart-quote `श→ष` bug |
| 32 | `34_univ_au` | Allahabad Univ | https://www.allduniv.ac.in/upload/news/%E0%A4%8F%E0%A4%95%20%E0%A4%A6%E0%A4%BF%E0%A4%B5%E0%A4%B8%E0%A5%80%E0%A4%AF%20%E0%A4%95%E0%A4%BE%E0%A4%B0%E0%A5%8D%E0%A4%AF%E0%A4%B6%E0%A4%BE%E0%A4%B2%E0%A4%BE.pdf | 2(2) | `secPdfProducer` / `Scan Assistant` | *(none)* | 0 | — | 0 | 0/0 | 0/0 | 0 | none | Pure scan |
| 33 | `35_univ_lu` | Lucknow Univ | https://www.lkouniv.ac.in/site/writereaddata/siteContent/202512291554474679holiday-list_291225.pdf | 3(3) | *(none)* / *(none)* | *(none)* | 0 | — | 0 | 0/0 | 0/0 | 0 | none | Pure scan |
| 34 | `36_univ_bhu` | BHU | https://www.bhu.ac.in/Images/files/Ph_Dcounsellingform.pdf | 4(4) | `SECnvtToPDF V1.0` / `TOSHIBA e-STUDIO2540C` | *(none)* | 0 | — | 0 | 0/0 | 0/0 | 0 | none | Pure scan |
| 35 | `37_bank_rbi` | RBI | https://www.rbi.org.in/hindi/Upload/content/PDFs/07MC_H25072013_V.pdf | 1(1) | `Acrobat Distiller 7.0` / `PDFMaker 7.0 for Word` | `MBPOMI+ArialUnicodeMS` | 132 | **37.1%** | 2 | 0/0 | 0/0 | 8 | none | Drawing-order + U+1B80–1CFF ligatures |
| 36 | `38_bank_sbi` | SBI | https://sbi.bank.in/webfiles/uploads/files/1542020092305_HINDI_ADVT_SCO.pdf | 3(3) | `Adobe PDF library 15.00` / `Illustrator CC 2017` | `CWIKXP+SHREE-DEV7-0714E-Bold`, `MyriadPro`, `Rupee` (+9) | 0 | — | 0 | 0/0 | 1989/1989 | 1725 | **none** | Undetected Shree-Dev legacy font |

---

## 2. Ranked Failure Classes (With Visual vs. Extracted Evidence)

Ranked by corpus reach (files affected and total/scanned pages impacted), distinguishing handled classes from **unhandled / partially handled** gaps.

### Rank 1: Pure Scanned Hindi PDFs Without a Text Layer — **HANDLED**
- **Impact:** **19 files** (17 zero-font scans + 2 empty-text-layer scans `09_rj_jda1`, `20_jh_da`, plus 2 scanned pages inside hybrid `06_mp_2`), **297 total pages** (56 scanned pages) — over **52% of the entire state/district/university corpus**.
- **Producers:** Kodak Alaris, HP Scan Extended, Adobe Acrobat Pro 11 (HP MFP), PDFsharp/NAPS2, `secPdfProducer`, OmniPageCSDK18, Marvell Semiconductor, CamScanner (`intsig.com`), Canon iR2945, TOSHIBA e-STUDIO, PDFlib 8, `Microsoft: Print To PDF` (rasterized), `iLovePDF`, `Online2PDF.com`.
- **Visual verification:** Page 1 PNGs of all 19 files were rendered with `pdftoppm` and visually confirmed to be genuine Hindi government/university scans.
- **Editor status:** **Handled** by OCR fallback (`extractEmbeddedTextLines` returns 0 lines → `ocr.ts` runs Tesseract `hin+eng` when OCR is enabled). Minor edge case: `20_jh_da` reports `missingGlyphPages: [0, 1]` on an empty `ArialMT` dict despite being a pure scan.

---

### Rank 2: Scanned Hindi PDFs With Invisible English-Only (`Tr 3`) OCR Layers — **NOT HANDLED (CRITICAL)**
- **Impact:** **6 files** (`03_uppsc_cal`, `11_rj_doit`, `19_hr_1`, `22_cg_mahatari`, `28_dist_gbnagar`, plus page 1 of hybrid `16_uk_ucc`), **71 affected pages** (18 scanned pages).
- **Producers:** `OmniPageCSDK19` (HP Smart Document Scan), `Canon` MFP (`11_rj_doit`, `22_cg_mahatari`), `iLovePDF` / HP Smart Document Scan (`19_hr_1`, `16_uk_ucc` p1), `Adobe Scan for Android 25.12.03` (`28_dist_gbnagar`).
- **Root cause:** Government scanners and mobile scan apps run **English-only OCR by default** on Hindi paper notices and embed an invisible text layer (`OPS.setTextRenderingMode = 3`) in `Helvetica`/`Times-Roman`/`Courier` over a single full-page raster image. Because `extractEmbeddedTextLines` returns dozens of non-degraded ASCII lines (`hasDevanagari === false`, `degraded === false`) and `detectLegacyFonts` returns `[]`, **`ocr.ts` exits immediately at line 514 (`if (!degraded && !embedded.some(l => hasDevanagari(l.text))) return embedded;`) and NEVER runs Hindi OCR.**
- **Visual vs. Extracted Evidence:**
  - `03_uppsc_cal` (UPPSC Exam Calendar 2026):
    - `कार्यालय : उत्तर प्रदेश लोक सेवा आयोग` → `wi ict` / `T 3ITl''I`
    - `विज्ञप्ति` → `LThi`
    - `प्रयागराज: दिनांक 30 जनवरी, 2026` → `qii'ci: f'iiq, 30 11q, 2026`
  - `11_rj_doit` (Rajasthan DOIT Order):
    - `राजस्थान सरकार` → `tluNeII;T 1!lf6'R`
    - `सूचना प्रौद्योगिकी और संचार विभाग` → `r1_a-{r EleYFIfrt ofh rial-t f{+rnr`
  - `19_hr_1` (Haryana Cooperative Societies Act, 48p):
    - `हरियाणा सहकारी सोसाइटी` → `6Rqlull *164)14)`
    - `अधिनियम, 1984` → `31f4ftzili, 1984`
    - `(हरियाणा अधिनियम क्र. 22, 1984)` → `(6Rqlull 3TrUftzili st) 22 1984)`
  - `22_cg_mahatari` (Chhattisgarh Mahatari Vandan Yojana, 12p):
    - `छत्तीसगढ़ शासन` → `trffig-.'tE qrr{rq`
    - `महिला एवं बाल विकास विभाग` → `erd fr-f,rs fqqrq`
  - `16_uk_ucc` p1 (Uttarakhand UCC Notification):
    - `उत्तराखण्ड शासन / गृह अनुभाग-5 / अधिसूचना` → `ERttlIg {FFI / T6 / 3[gqFr-5 / riqn`

---

### Rank 3: KrutiDev / DevLys Conversion Bugs & Font-Name Detection Gap — **PARTIALLY HANDLED**
- **Impact:** **6 files** (`04_up_rti`, `06_mp_2`, `15_bpsc_2`, `16_uk_ucc`, `23_hp_gazette`, `33_univ_du`), **701 total pages** (18 scanned Hindi pages). Every single KrutiDev/DevLys file in the corpus exhibited at least one systematic bug in `krutiDev.ts` / `@anthro-ai/krutidev-unicode` or `legacyFontDetector.ts`:
  1. **Curly double-quotes `[“”]` mapped to `"` (`ष्`) instead of `'` (`श्`) in `krutiDev.ts:22`** — hits **4 files** (`04_up_rti`: 19 hits on p1–4; `23_hp_gazette`: 5 hits; `15_bpsc_2`: 2 hits; `33_univ_du`: 1 hit). Microsoft Word AutoCorrect turns KrutiDev's `'` (`श्`) into `“`/`”` (WinAnsi 0x93/0x94), which visually renders the `श्` glyph in KrutiDev 010. `krutiDev.ts` explicitly runs `.replace(/[“”]/gu, '"')`, corrupting `श` → `ष`:
     - `04_up_rti`: `उत्तर प्रदेश शासन` → `उत्तर प्रदेष षासन`, `प्रशासनिक` → `प्रषासनिक`, `शक्ति` → `षक्ति`, `प्रकाशित` → `प्रकाषित`, `शिकायतें` → `षिकायतें`
     - `33_univ_du`: `दिल्ली विश्वविद्यालय` → `दिल्ली विष्वविद्यालय`
     - `23_hp_gazette`: `शाहपुर` → `षाहपुर`, `शक्तियों` → `षक्तियों`
     - `15_bpsc_2`: `प्रश्न` → `प्रष्न`, `प्राश्निक` → `प्राष्निक`, `सारांश` → `सारांष`
  2. **`è` (WinAnsi 0xE8 = half-`ध्`) converted to full `ध`, stranding `k` as `ा`** — hits `16_uk_ucc` (173p, 19 hits on p3–4 alone):
     - `अधिसूचना` (`vfèklwpuk`) → `अधिासूचना`
     - `अधिवसित` → `अधिावसित`
     - `उत्तराधिकार` → `उत्तराधिाकार`
     - `उपबंधों` → `उपबंधाों`
     - `अधिकार` → `अधिाकार`
  3. **Reph (`Z`) misplacement before conjuncts** — hits `06_mp_2` (`सामर्थ्य` → `सामथर्य`) and `23_hp_gazette` (`पुनर्व्यवस्थापन` → `पुनवर्यवस्थापन`).
  4. **Double matra / stray anusvara** — `04_up_rti` (`हैं` → `हैैं`), `23_hp_gazette` (`है0` → `ंहै0`).
  5. **Font-name whitespace miss in `legacyFontDetector.ts`** — `ABCDEE+Kruti Dev 010` (`04_up_rti`) fails `isLegacyDevanagariFontName()` because `LEGACY_FONT_NAME_PREFIXES` only checks `"KrutiDev"` without stripping spaces. It was rescued only by the ≥3 signature-word text heuristic (`looksLikeLegacyDevanagariText`), which fails on short or title pages.
  *(Note: On `23_hp_gazette` [34.8% unk] and `06_mp_2` [26.5% unk], the bulk of unknown words above ~15% are legitimate proper nouns—village/khasra/officer names in tables—not conversion errors.)*

---

### Rank 4: Mis-Mapped ToUnicode on Stripped-`cmap` Fonts Escaping ADR 0022 (`LibreOffice 6.3`, `Acrobat Distiller 7.0`, `NIC eOffice`) — **PARTIALLY HANDLED**
- **Impact:** **3 files** (`30_court_hcraj`, `37_bank_rbi`, `06_mp_2` p5), **6+ directly affected pages**.
- **Root cause:** ADR 0022 (`repairMisMappedToUnicode`) requires a `/Type0` font whose embedded `FontFile2` retains a readable `cmap`+`GSUB` (`fontGlyphText`). All three producers strip `cmap` (`fromFont = 0`), and LibreOffice 6.3 additionally emits simple `/TrueType` (not `/Type0`) fonts:
  1. **`30_court_hcraj` (`LibreOffice 6.3` Writer, 4p, 47.4% unk, `deg=3`):** `BAAAAA+NirmalaUI` / `GAAAAA+ArialUnicodeMS` (`TrueType`, `fromFont=0`).
     - Visual vs. extracted (p1): `एस.बी. सिविल रिट याचिका संख्या 807/2025` → `एस.बी. सिससिल रि ट यासिका सख्या 807/2025`; `प्रक्रिया` → `प्रकिया` / garbled `गीभगी`, `सदू`, `प्रमां`.
     - **Editor status:** Pages 1–3 are `embedded-degraded` (control chars `\x05`/`\x08`) so `verifyEmbeddedDevanagari` triggers OCR fallback; **page 4** is NOT degraded (see Rank 7).
  2. **`37_bank_rbi` (`Acrobat Distiller 7.0` / `PDFMaker 7.0`, 1p, 37.1% unk, 2 matra-start words):** `MBPOMI+ArialUnicodeMS` (`Type0`, `CIDToGIDMap: undefined`, `fromFont=0`). Maps ligature/conjunct glyphs to unrelated Unicode blocks (**U+1B80–U+1CFF**: Sundanese `ᮢ`/`ᮓ`, Ol Chiki `ᱶ`, Georgian `Ა`, Cyrillic `ᲂ`, Vedic `᳥`) and writes pre-base `ि` and reph `र्` in **visual drawing order**.
     - Visual vs. extracted: `परिशिष्ट` → `पिरिश᳥`, `परिपत्र` → `पिरपᮢ`, `अधिसूचनाओं` → `अिधसूचनाᲐ`, `क्रम` → `ᮓम`, `दिनांक` → `िदनांक`, `मार्च` → `माचर्`.
     - **Editor status:** ADR 0022 fails (`fromFont=0`). Page is not degraded (`deg=0`), but `canJudgeDevanagari` is `true` and `readsAsHindi` is `false`, so OCR fallback catches it **when OCR is enabled** (fails when OCR is off or skipped).
  3. **`06_mp_2` page 5 (NIC `eOffice`, merged via `iLovePDF`):** `Mangal-Regular`/`Mangal-Bold` (`fromFont=0`, `g0="\u0000"`, omitted conjunct/matra ToUnicode entries).
     - Visual vs. extracted: `मध्यप्रदेश शासन` → `मयदेश शासन`, `वाणिज्यिक कर विभाग` → `वा ण यक कर वभाग`, `मंत्रालय` → `मंालय`.
     - **Editor status:** ADR 0022 flags `missingGlyphPages: [4]` (treating dropped letters as empty boxes to omit) even though the page visually renders crisp Hindi.

---

### Rank 5: ADR 0022 Partial Miss on Bold Heading Subsets (`Word 2007` & `Word 2013 + iLovePDF`) — **NOT HANDLED**
- **Impact:** **2 files** (`01_up_payscale` 7p, `32_court_sci` 3p), **10 total pages** (7 scanned pages).
- **Root cause:** ADR 0022 repairs body `ABCDEE+Mangal` (`disagree=22` and `27`), **but skips `ABCDEE+Mangal-Bold` / `ABCDEE+Mangal,Bold`** for two compounding reasons:
  1. Small heading subsets have only **1–2 single-letter cmap disagreements** (`01_up_payscale`: `disagree=1`, `g133: ि→च`; `32_court_sci`: `disagree=2`, `g146: ि→ध`, `g157: र्व→व`) — below `MIN_DISAGREEMENTS = 3`.
  2. Contextual GSUB Type 6 `ि` variants (`g464, g465, g871, g874, g876`) return `NONE` from `fontGlyphText`, while Word's broken ToUnicode maps them directly to consonants (`व`, `द`, `स`, `र`, `ध`, `च`).
- **Visual vs. Extracted Evidence:**
  - `01_up_payscale`: `वित्त` → `ववत्त`, `दिनांकः` → `ददनांकः`, `दिसम्बर` → `ददसम्बर`, `विषयः` → `ववषयः`
  - `32_court_sci`: `सिविल अपीलीय अधिकारिता` → `ससवर्वल अपीलीय अधिकाररता`, `सिविल अपील संख्या` → `ससवर्वल अपील संख्या`
- **Editor status:** **NOT handled.** Because the body font is repaired, page-level `readsAsHindi` is `true` and OCR verification passes—corrupted bold headings are emitted silently.

---

### Rank 6: Undetected Non-KrutiDev Legacy Font (`SHREE-DEV7` / Shree-Lipi) — **NOT HANDLED (CRITICAL)**
- **Impact:** **1 file** (`38_bank_sbi`, SBI recruitment ad from `Adobe Illustrator CC 2017`), **3 pages**, **1,989 Latin-1 chars, 1,725 Latin words, 0 Hindi words**.
- **Root cause:** `CWIKXP+SHREE-DEV7-0714E-Bold` (and `SHREE-DEV7-0714E`) is absent from `LEGACY_FONT_NAME_PREFIXES` in `legacyFontDetector.ts` (which only lists `KrutiDev, Shivaji, Chanakya, DevLys, Walkman-Chanakya, Agra, Amar`). Because `detectLegacyFonts` returns `[]` and `hasDevanagari` is `false`, `ocr.ts` skips OCR completely and dumps 100% Shree-Dev mojibake into the editor and Word output.
- **Visual vs. Extracted Evidence (`38_bank_sbi` p1):**
  - `भारतीय स्टेट बैंक` → `` ^maVr` ñQ>oQ> ~¢H$ ``
  - `केन्द्रीय भर्ती एवं पदोन्नति विभाग` → `` Ho$ÝÐr` ^Vu Ed§ nXmoÝZ{V {d^mJ ``
  - `कॉरपोरेट केन्द्र, मुंबई` → `H$m°anmoaoQ> Ho$ÝÐ, _w§~B©`
  - `आवेदन के ऑनलाइन पंजीकरण और शुल्क का भुगतान` → `AmdoXZ Ho$ Am°ZbmBZ n§OrH$aU Am¡a ewëH$ H$m ^wJVmZ`

---

### Rank 7: Combining-Mark Reordering (`Word 2021`) & Complete Inter-Word Space Loss (`LibreOffice 6.3` Bold) — **NOT HANDLED**
- **Impact:** **2 files** (`29_court_ahc` 55p; `30_court_hcraj` p4).
- **Evidence:**
  1. **`29_court_ahc` (`Microsoft® Word 2021`, `BCDGEE+Mangal`, 55p):** Combining `िं` in `सिंह` detaches from `स` and shifts after `ह` or to the end of the line:
     - `अरुण प्रताप सिंह एवं 37 अन्य` → `अरुण प्रताप स ह एवं 37 अन्यिं`
     - `श्री निपुण सिंह, विद्वान` → `श्री निपुण स हिं , विद्वान`
     - `श्री शैलेन्द्र सिंह;` → `श्री शैलेन्द्र स हिं ;`
     *(Passes `readsAsHindi` at 10.8% unknown; never caught.)*
  2. **`30_court_hcraj` page 4 (`LibreOffice 6.3`, `FAAAAA+NirmalaUI-Bold`, 1p):** Every space between words vanishes, fusing entire lines into single tokens:
     - `स्थानीय भाषा में अनुवादित निर्णय केवल वादियों के अपनी` → `स्थानीयभाषामेंअनुवादितनिर्णयकेवलवादियोंकेअपनी`
     - `एडवोकेट विष्णु जांगिड़` → `एडवोकेटविष्णुजांगिड़`
     *(Leaves only 8 giant tokens on the page: `devW=8`, `unk=100%`, `deg=false`, `canJudgeDevanagari=false` — silently bypasses OCR fallback even though pages 1–3 already failed verification!)*

---

## 3. Recommended Top 3 Fixes

### Fix 1 (Highest Reach & Severity): Detect & OCR Scanned Pages With Invisible (`Tr 3`) Garbage OCR Layers
- **Fixes:** Rank 2 — **6 files, 71+ pages** across HP/OmniPage, Canon, iLovePDF, and Adobe Scan (every single one currently outputs 100% Latin gibberish with zero warning).
- **Approach:** In `pdfTextExtract.ts` / `ocr.ts`:
  1. Track whether a page's text items are drawn with `OPS.setTextRenderingMode === 3` (invisible text) over a full-page raster image (`imageOps >= 1` covering >70% of page area).
  2. When a page is an invisible-text-over-scan layer with `hasDevanagari === false`, score its Latin text for OCR-gibberish signals (high ratio of non-dictionary/mixed-case/digit-punctuation tokens like `6Rqlull`, `31f4ftzili`, `tluNeII;T`, `trffig-.'tE`, `ERttlIg`, `qii'ci:`). If the invisible layer fails basic English/alphanumeric sanity, discard it as an untrusted foreign-language OCR layer and trigger normal Hindi+English OCR fallback (and count the page in `sampleTextLayer.withoutText` so the UI warns the user).
- **Why #1:** High frequency across state PSCs, state departments, and districts; total data loss today; clean, deterministic structural signal (`Tr 3` + full-page image + non-English gibberish) with near-zero false-positive risk on real English digital PDFs.

### Fix 2 (Fastest High-ROI Accuracy Win): Fix `krutiDev.ts` Mapping Bugs & Expand `legacyFontDetector.ts` (`SHREE-DEV`, Spaced `Kruti Dev`)
- **Fixes:** Rank 3 (**6 files, 701 pages**) + Rank 6 (**1 file, 3 pages**; high-value bank/illustrator/publishing class).
- **Approach:**
  1. **`krutiDev.ts`:**
     - Map `[“”]` (WinAnsi 0x93/0x94 from Word Smart Quotes) to `"'"` (`श्`) rather than `'"'` (`ष्`) — fixes `प्रदेष`→`प्रदेश`, `षासन`→`शासन`, `विष्वविद्यालय`→`विश्वविद्यालय`, `प्रष्न`→`प्रश्न`, `षाहपुर`→`शाहपुर` across 4/6 KrutiDev files.
     - Fix `è` (`ध्` half-form) mapping so `vfèklwpuk` → `अधिसूचना` instead of `अधिासूचना` (`16_uk_ucc`, 173p).
     - Fix reph (`Z`) placement across half-form+consonant conjuncts (`सामथर्य`→`सामर्थ्य`, `पुनवर्यवस्थापन`→`पुनर्व्यवस्थापन`) and deduplicate `ैै`→`ै` (`हैैं`→`हैं`).
  2. **`legacyFontDetector.ts`:**
     - Normalize whitespace/hyphens before prefix matching (`withoutSubsetTag.replace(/[\s_-]+/g, '').toLowerCase()`) so `ABCDEE+Kruti Dev 010` matches directly by font name.
     - Add `SHREE-DEV` / `ShreeLipi` / `Shree` (plus `APS-DV`, `DV-TT`, `Kiran`, `AkrutiDev`) to `LEGACY_FONT_NAME_PREFIXES` as **unconvertible legacy fonts** so `convertPdfToWord` and the editor immediately warn and fall back to OCR instead of emitting 1,725 words of Latin-1 mojibake on `38_bank_sbi`.
- **Why #2:** Small, surgical, zero-regression changes that immediately fix errors across 7 files (704 pages) in the corpus without needing OCR on KrutiDev files.

### Fix 3 (High Impact on Digital Word & Court/Bank PDFs): Close ADR 0022 Bold-Subset & `fontGlyphText` Contextual-`ि` Gaps + Propagate Font-Failure OCR Fallback
- **Fixes:** Rank 5 (**2 files, 10 pages**: `01_up_payscale`, `32_court_sci`) + Rank 4/7 edge cases (`30_court_hcraj` p4, `37_bank_rbi`, `06_mp_2` p5).
- **Approach:**
  1. **Bold subsets in `pdfToUnicodeRepair.ts` + `fontGlyphText.ts`:** Parse GSUB Type 6 (Chaining Contextual Substitution) contextual `ि` variants in `fontGlyphText` (resolving `g464, g465, g871, g874, g876` in `Mangal Bold` to `PRE_BASE_MARK`), and lower the repair trigger when a sibling font in the same document (`ABCDEE+Mangal` alongside `ABCDEE+Mangal-Bold`) was already repaired or when any glyph in `existing` maps a `PRE_BASE_MARK`/`REPH_MARK` to a consonant (`वित्त`→`ववत्त`, `सिविल`→`ससवर्वल`, `अधिकारिता`→`अधिकाररता`).
  2. **Verification fallback on short/glued/non-Devanagari-block pages (`ocr.ts` / `embeddedTextVerification.ts`):**
     - Treat non-Devanagari exotic scripts mixed inside Devanagari runs (e.g., U+1B80–U+1CFF in `37_bank_rbi`: `पिरिश᳥`, `पिरपᮢ`) and glued >25-char Devanagari tokens (`30_court_hcraj` p4) as degraded/corrupted signals even when `devW < 30`.
     - When `fontTrust.failed` already holds a font used on a short page, fall back to OCR instead of returning unverified embedded text.
     - Do not mark `06_mp_2` p5 (`NIC eOffice`) solely as `missingGlyphPages` when `g0="\u0000"` and stripped-cmap `Mangal` still renders visible Hindi ink on the rasterized page — allow OCR verification to recover dropped conjuncts (`मयदेश`→`मध्यप्रदेश`).
- **Why #3:** Word 2007/2013 (`Mangal-Bold`), LibreOffice, Distiller, and NIC `eOffice` are the four most common digital producers of Indian court orders, bank circulars, and ministry notices; fixing these eliminates the subtle, silent heading/body corruptions that currently slip past `readsAsHindi`.
