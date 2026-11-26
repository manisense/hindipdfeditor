# Global PDF tools vs Hindi/Devanagari PDFs (state as of Nov 2026)

Scope note: about 16 searches and fetches. Adobe is well documented because its community forum is public and active. iLovePDF and PDFgear have primary pages. Smallpdf, Sejda, Foxit/PDFescape, LightPDF and Word reflow have little Hindi-specific evidence; see Gaps. "Verified" means a vendor document or a staff statement. "Anecdotal" means a user report.

## 1. Editing existing Devanagari text and adding new Hindi text

### Takeaway
Adobe Acrobat (desktop Pro and DC) is the best-documented failure. Users report that matras such as ि and े move or detach when existing Hindi text is edited, and that Mangal text turns to garbage when it is edited again. A community volunteer said Acrobat "doesn't support editing Hindi text yet." No confirmed fix exists. UPDF and PDFgear claim they can edit Hindi, but only on their own marketing pages; no independent test was found. Nothing documented was found either way for iLovePDF, Smallpdf, Sejda, Foxit or PDFescape editing Hindi.

### Cited Findings
- **Acrobat Pro, Oct 2025 thread (anecdotal, multi-user).** Editing an existing Hindi PDF shifts the matras out of position, often after the consonant instead of before it. Edit > Edit Page gives mismatched fonts and overlapping text. The user says the problem has lasted "for years." No Adobe staff replied. Community Experts suggested setting the document language and Preferences > Languages to Hindi, and turning off "New Acrobat"; the user said none of it helped. — [Adobe Community, 8 Oct 2025](https://community.adobe.com/t5/acrobat-discussions/hindi-language-all-pdf-edit-problem-edit-is-mismatch-not-accurate/td-p/15538131)
- **Acrobat: more threads with the same symptom.** Matras ("ि", "े", "ो") shift or detach. A community reply states that Acrobat doesn't support editing Hindi text yet. — [Adobe Community: Hindi text editing bug in Acrobat DC](https://community.adobe.com/t5/acrobat-discussions/pdf-document-editing-hindi-text-editing-bug-in-adobe-acrobat-dc/td-p/15398453); [Hindi language pdf page edit problem](https://community.adobe.com/questions-9/hindi-language-pdf-page-edit-problem-1304863); [Acrobat font pairing problem in Hindi edit](https://community.adobe.com/t5/acrobat-discussions/acrobat-font-pairing-problem-in-hindi-language-edit/m-p/15280831); [Hindi text split while editing in Acrobat DC (older, 2022-era thread id)](https://community.adobe.com/t5/acrobat-discussions/hindi-text-split-while-editing-in-acrobat-dc/td-p/13175121)
- **Acrobat with Mangal (anecdotal).** Text typed in Mangal looks fine at first. After saving and reopening, editing it again makes it "mushed"/unintelligible. The suggested workaround is to convert the text to outlines, after which it can no longer be edited. Another suggestion is OCR, then copy into Word or Google Docs, edit there, and re-export. — [Adobe Community: Issues in editing PDFs in Hindi](https://community.adobe.com/t5/acrobat-discussions/issues-in-editing-pdf-s-in-quot-hindi-quot/m-p/14792384)
- **Acrobat: text extraction is a separate problem.** A June 2026 report says conjuncts and matras change during copy and search even when the PDF displays correctly. An Adobe post says text extraction and search have limited support for Indian languages. — [Adobe Community: Hindi Unicode PDF search and copy-paste issue](https://community.adobe.com/questions-9/hindi-unicode-pdf-search-and-copy-paste-issue-1629373)
- **Adobe Express, other Adobe products (anecdotal bug reports).** One report says "Save to PDF doesn't support Hindi perfectly." Another says a Hindi font is wrong in PDF export but fine in JPG/PNG. Gujarati is distorted in Reader's Reading Mode. Punjabi and Gujarati render wrongly in form inputs. These point to a systemic Indic shaping weakness across Adobe's PDF stack. — [Express Save to PDF Hindi](https://community.adobe.com/bug-reports-328/adobe-express-save-to-pdf-doesn-t-support-hindi-perfectly-1468805); [Hindi font wrong in PDF export](https://community.adobe.com/bug-reports-328/hindi-font-not-displaying-correctly-in-pdf-export-works-fine-in-jpg-png-letterhead-issue-1622235); [Gujarati in Reader Reading Mode](https://community.adobe.com/questions-15/gujarati-text-becomes-distorted-in-acrobat-reader-reading-mode-while-normal-mode-displays-it-correctly-1644096); [Punjabi and Gujarati in form inputs](https://community.adobe.com/questions-9/problems-rendering-punjabi-and-gujarati-text-in-pdf-form-inputs-1552298)
- **Nitro Pro (anecdotal, single comment).** A forum user claims Nitro Pro handles Hindi text "perfectly." This has not been tested. — reported in [Adobe Community Hindi editing threads](https://community.adobe.com/questions-9/issues-in-editing-pdf-s-in-hindi-1295363)
- **UPDF (vendor claim).** It runs a dedicated "Hindi PDF editor" landing page, localised into many languages, which claims it keeps Hindi script and fonts intact when editing. — [UPDF Hindi PDF editor](https://updf.com/edit-pdf/hindi-pdf-editor/)
- **PDFgear (vendor claim).** It says you can "edit Hindi text directly" in its editor. The same page admits to problems with "complex script rendering" and with "non-Unicode encoding that can corrupt text." — [PDFgear: Hindi PDF to Word, updated 13 May 2026](https://www.pdfgear.com/pdf-converter/how-to-convert-hindi-pdf-to-word.htm)
- **Acrobat online (free in India).** Edit PDF (text, comments, highlights, signature) is part of the 25+ tools Adobe made free with an Adobe account. Coverage dated 19 Nov 2026 makes no mention of Hindi support. — [StartupTalky, 19 Nov 2026](https://startuptalky.com/adobe-acrobat-online-free/)

### Inferences
- Users regularly suggest "convert to outlines" and "OCR, then edit in Word or Docs." That means Acrobat users in India have no native way to make an editable, correctly shaped Hindi edit. This is the core gap hindipdfeditor.com fills: it removes the original glyphs and re-renders the text with correct shaping.
- The Adobe-wide pattern points to a shaping or re-encoding problem in Adobe's edit engine. Express, Reader Reading Mode and form fields show it too, so it is unlikely to be fixed soon. Several threads describe it as lasting "for years."
- Adobe's free online editor in India (Nov 2026) is now a zero-cost competitor on the general menu. Its Hindi editing inherits the same engine, which is untested but likely.

### Gaps
- No documented evidence, either way, for Hindi text editing in iLovePDF Edit, Smallpdf Edit, Sejda, Foxit PDF Editor, PDFescape or LightPDF. Searches returned only Adobe threads. A hands-on test with the project's conjunct, matra and reph fixture would settle it.
- No independent test of UPDF's or PDFgear's Hindi editing claims.
- No Reddit thread specific to iLovePDF or Smallpdf Hindi breakage was surfaced.

## 2. Hindi OCR (scanned PDF to searchable text or Word)

### Takeaway
Acrobat's built-in OCR does not support Hindi. Adobe staff confirmed this in Sept 2026; Hindi is available only in the separate Adobe Scan app. iLovePDF lists Hindi among its 120+ recognition languages, at least inside Translate PDF. UPDF and PDFgear market Hindi OCR. Google Drive's "Open with Google Docs" OCR detects Hindi automatically and is free, but no recent Hindi accuracy figure exists. No official Smallpdf OCR language list was found.

### Cited Findings
- **Acrobat (verified, staff).** An Adobe Community Manager (Amal Jaiswal, 8 Sept 2026) confirmed that Hindi isn't supported by Acrobat's built-in OCR, while Adobe Scan's OCR does support it. He called it "a product limitation rather than something you're missing in a setting." Acrobat uses language-specific recognition libraries and Hindi is not among them. A feature request exists. — [Adobe Community, 6 Sept 2026](https://community.adobe.com/questions-15/make-hindi-language-available-in-text-recognition-ocr-in-adobe-acrobat-1640655)
- **Acrobat online.** OCR is not part of the free tier in India. — [StartupTalky, 19 Nov 2026](https://startuptalky.com/adobe-acrobat-online-free/)
- **iLovePDF (verified, vendor).** Translate PDF includes text recognition in "over 120 languages," Hindi among them, and handles scanned PDFs automatically. — [iLovePDF blog, 25 Feb 2026](https://www.ilovepdf.com/hi/blog/introducing-translate-pdf-ai-pdf-translation). The language list for the standalone OCR PDF tool was not confirmed. The pricing page lists "OCR PDF" in the free tier (1 file, 15 MB), while "Advanced OCR PDF" and "PDF to Word/PPT/Excel with OCR" are Premium-only. — [iLovePDF pricing (Hindi/INR page)](https://www.ilovepdf.com/hi/pricing)
- **Smallpdf.** It has a marketing blog post on translating Indian-language documents that mentions built-in OCR for scanned files. No official OCR language list was found. Per StartupTalky, OCR is Pro-only. — [Smallpdf blog](https://smallpdf.com/blog/best-document-translator-for-indian-languages); [StartupTalky](https://startuptalky.com/adobe-acrobat-online-free/)
- **UPDF (vendor claim).** Hindi OCR is described as AI-based and turns scanned Hindi into editable, searchable text, out of 38+ OCR languages. Pricing is Pro US$69.99 one-time or UPDF AI US$79/yr, as listed on its pages. — [UPDF Hindi OCR](https://updf.com/ocr/hindi-ocr/)
- **PDFgear (vendor, with an admission).** It claims "advanced OCR features designed for Hindi PDFs" and recommends selecting the document language. It also admits that "OCR technology for Hindi isn't as advanced as for Latin languages." — [PDFgear, 13 May 2026](https://www.pdfgear.com/pdf-converter/how-to-convert-hindi-pdf-to-word.htm)
- **Google Drive/Docs (verified, official).** Right-click a file > Open with Google Docs. The output shows the image followed by the extracted text, and the language is detected automatically. Google's support page says PDFs and images should be 2 MB or smaller. A third-party guide mentions a 10-page limit, so this conflicts. — [Google Drive Help](https://support.google.com/drive/answer/176692); [Google Research blog, "Paper to Digital in 200+ languages"](https://www.research.google/blog/paper-to-digital-in-200-languages/). The accuracy claim of "over 90% for most languages" is from 2015, is not specific to Hindi, and comes second-hand. — [Global Voices, Aug 2015](https://globalvoices.org/2015/08/29/googles-optical-character-recognition-software-now-works-with-all-south-asian-languages/)
- **PDF-XChange (anecdotal, forum).** Hindi OCR depends on its licensed ABBYY engine adding the language. — [PDF-XChange forum](https://forum.pdf-xchange.com/viewtopic.php?p=184123)
- **Free niche OCR sites** list Hindi: OCR.space (Engine 3 recommended for Hindi) and i2OCR. — [OCR.space Hindi](https://ocr.space/hindi); [i2OCR Hindi PDF OCR](https://www.i2ocr.com/pdf-ocr-hindi)

### Inferences
- The best-known paid editor, Acrobat, cannot OCR Hindi at all as of Sept 2026. Users are sent to a separate mobile app. This is a clear messaging opportunity: "Hindi OCR that Acrobat lacks."
- Google Docs OCR is the free default many Indian users already rely on. The real competitor for Hindi OCR is probably Google Docs, not iLovePDF. Its weak points are layout (the output is plain text under an image) and the small size and page limits.

### Gaps
- No independent, recent accuracy benchmark for Hindi OCR in any of these tools (character error rate, conjuncts).
- Standalone OCR language lists for iLovePDF OCR PDF, Smallpdf, Sejda, Foxit and LightPDF were not verified. Adobe's helpx OCR language page returned 403.

## 3. PDF to Word with Hindi (broken characters, Mangal and KrutiDev)

### Takeaway
Garbled Hindi in PDF-to-Word output is a long-running complaint, documented mostly against Acrobat, including PDFs that use the Unicode font Mangal. Legacy KrutiDev and DevLys PDFs extract as Latin keystroke characters in every generic tool, because those fonts map Devanagari shapes onto Latin codes. No global tool advertises KrutiDev-to-Unicode conversion. PDFgear's own Hindi page does not mention Mangal or KrutiDev and admits non-Unicode encodings "can corrupt text."

### Cited Findings
- **Acrobat (anecdotal, older thread).** "Converting Hindi PDF to Word generates garbled text," a 2019-era thread by its ID. — [Adobe Community](https://community.adobe.com/t5/acrobat-discussions/converting-hindi-pdf-to-word-generates-garbled-text-any-help-please/m-p/10560459/highlight/true)
- **Acrobat export with Mangal (anecdotal).** "PDF export file not correct: contains Mangal Hindi Unicode font," a 2023-era thread by its ID. — [Adobe Community](https://community.adobe.com/t5/acrobat-discussions/pdf-export-file-not-correct-contains-mangal-hindi-unicode-font/td-p/14092254)
- **Microsoft Word (Microsoft Q&A, Mar 2026).** A moderator explains that Word can open a PDF but cannot truly edit it, and that image-only PDFs need OCR first. If a PDF looks right in Reader but garbled in Word, the fault is in Word's PDF reflow. No fix specific to Hindi or Mangal was given. — [Microsoft Q&A](https://learn.microsoft.com/en-us/answers/a/12672227). An older 2010 thread reports Unicode Hindi printing garbled from Word, with "print to PDF" as the workaround. — [Microsoft Q&A, 2010](https://learn.microsoft.com/en-us/answers/questions/4766409/printing-problem-in-unicode-hindi-text-using-micro)
- **Legacy fonts.** DevLys and KrutiDev-type fonts store glyphs on Latin code points, so copied text comes out as Latin characters, while Mangal is Unicode. A separate converter is needed. This is a third-party guide, Dec 2024. — [docset.in](https://docset.in/blog/hindi-font-conversion-guide)
- **PDFgear.** It claims its offline tool keeps "the same text, images, and formatting." It also admits that complex PDFs need manual fixes and that Google Docs conversion may lose formatting with non-English fonts. — [PDFgear, May 2026](https://www.pdfgear.com/pdf-converter/how-to-convert-hindi-pdf-to-word.htm)
- **WPS** publishes a help article on converting bilingual English+Hindi PDFs with OCR, which shows the problem is common enough to need a guide. — [WPS](https://www.wps.com/office-quick-solution/pdf-troubleshooting/how-to-convert-a-bilingual-english-and-hindi-pdf-using-ocr/)

### Inferences
- Detecting and converting KrutiDev to Unicode appears to be unaddressed by every global tool surveyed. This is a defensible differentiator, especially for Indian government documents, which are heavy on KrutiDev.

### Gaps
- No documented tests of iLovePDF, Smallpdf or Sejda PDF-to-Word output on Hindi. No documentation of how Word's reflow handles reph or ि ordering.

## 4. Translation of PDFs to and from Hindi

### Takeaway
iLovePDF launched Translate PDF on 25 Feb 2026. It supports Hindi in both directions, preserves layout "whenever possible" with substitute fonts when needed, and runs on AI credits. Smallpdf markets Indian-language document translation. Google Translate's document mode is the free baseline, but it was not researched here.

### Cited Findings
- **iLovePDF Translate PDF.** It has two modes: "Keep layout" and "Only text." Hindi is among the 25 output languages, and OCR is built in. When the original font is unavailable it uses "visually similar fonts." The free plan gets one translation per day up to 15 MB. Premium gets 200 MB and 2,000 AI credits per month. — [iLovePDF blog, 25 Feb 2026](https://www.ilovepdf.com/hi/blog/introducing-translate-pdf-ai-pdf-translation). **Conflict:** the pricing page lists PDF Translation as Premium-only and caps Advanced Translate at 67 pages on Premium. — [iLovePDF pricing](https://www.ilovepdf.com/hi/pricing)
- **Smallpdf.** A blog post titled "Best document translator for Indian languages" is marketing material. A fetch returned only the title, so its details are unverified. — [Smallpdf blog](https://smallpdf.com/blog/best-document-translator-for-indian-languages)

### Inferences
- In "Keep layout" mode, iLovePDF's output for Hindi depends on whether its renderer shapes Devanagari correctly with the substitute font. This is untested and worth a direct test with the fixture.

### Gaps
- Layout-preserving translation quality into Hindi (shaping in the output) is untested for iLovePDF, Smallpdf, Acrobat AI, DeepL and Google Translate documents.

## 5. Feature breadth, India pricing and free-tier limits

### Takeaway
iLovePDF publishes INR prices: Premium costs ₹500/month or ₹2,900/year (about ₹242/month), with OCR-to-Word, Advanced OCR, translation and AI features behind the paywall. Acrobat Standard starts at ₹477.90/month (annual plan), and Acrobat online's 25+ basic tools are now free with an Adobe account in India, but without OCR. Smallpdf shows regional prices only at checkout. PDFgear says it is free.

### Cited Findings
- **iLovePDF (official INR page).** Basic is free. Premium is ₹500/month, or ₹2,900/year (₹242/month), for 1–25 users. Business has custom pricing for 25+ users. Free-tier limits per task:

  | Task | Free limit |
  |---|---|
  | Merge | 25 files, 100 MB |
  | Compress | 2 files, 200 MB |
  | PDF to Word, PowerPoint or Excel | 1 file, 15 MB |
  | OCR | 1 file, 15 MB |
  | Edit, Repair, Crop | 1 file, 100 MB |
  | Sign | 3 files, 50 MB |
  | Redact | 1 file, 400 MB |

  Premium-only features are OCR-to-Office, Advanced OCR, PDF/A, AI Summarizer, Translation, Smart Split and Smart Redact. Premium includes 2,000 AI credits. The global price is US$9/month or US$60/year. — [iLovePDF pricing (hi)](https://www.ilovepdf.com/hi/pricing); [iLovePDF pricing (en)](https://www.ilovepdf.com/pricing)
- **Adobe Acrobat (India).** Standard costs from ₹477.90/month and Acrobat Studio (with the AI Assistant) from ₹797.68/month, both on an annual plan billed monthly. Acrobat online offers 25+ tools free with an Adobe account: compress up to 2 GB, merge, split, rotate, crop, organize, PDF to Word or Excel, Word and JPG to PDF, Edit PDF, and fill & sign. Without an account there are monthly per-tool caps. OCR, redaction, AI and the desktop app are excluded. — [StartupTalky, 19 Nov 2026](https://startuptalky.com/adobe-acrobat-online-free/)
- **Smallpdf.** No published INR price; the price is "shown by region at checkout." Edit Text, OCR and strong compression are Pro-only, and the free plan limits downloads. — [StartupTalky](https://startuptalky.com/adobe-acrobat-online-free/). Capterra lists a starting price of US$15/month. — [Capterra India: Smallpdf vs iLovePDF](https://www.capterra.in/compare/172606/173963/smallpdf/vs/ilovepdf)
- **UPDF.** Pro costs US$69.99 one-time and UPDF AI US$79/yr, according to vendor pages. — [UPDF Hindi OCR](https://updf.com/ocr/hindi-ocr/)
- **PDFgear.** It describes itself as free software with no daily limits and no watermark on its online converter. — [PDFgear](https://www.pdfgear.com/pdf-converter/how-to-convert-hindi-pdf-to-word.htm)

### Inferences
- In India the price floor for general PDF tools is now zero: Acrobat online (with an account), PDFgear and the iLovePDF free tier. Paid value has moved to OCR, translation and AI. Hindi-correct editing, Hindi OCR and KrutiDev conversion are exactly where the global free tiers are missing or broken.

### Gaps
- Sejda (free-tier task and hour limits, price), Foxit/PDFescape and LightPDF pricing in INR were not collected.
- Smallpdf's actual INR checkout price is unpublished.

## 6. Documented complaints of Hindi rendering bugs

### Takeaway
Documented complaints are concentrated on Adobe products: Acrobat edit, export and extraction, Reader Reading Mode, Express Save to PDF, and form fields. They run from about 2019 to Nov 2026 with no confirmed fixes. No comparable public complaint trail was found for iLovePDF, Smallpdf, Sejda or Foxit. That may mean low usage for Hindi editing or less public forums, not that those tools are better.

### Cited Findings
- See the Section 1 and 3 citations: Adobe Community threads from 2019 (garbled export) through Oct 2025 (matra shift on edit), June 2026 (extraction alters conjuncts) and Sept 2026 (no Hindi OCR, staff confirmed). — [Adobe Community threads](https://community.adobe.com/t5/acrobat-discussions/hindi-language-all-pdf-edit-problem-edit-is-mismatch-not-accurate/td-p/15538131)
- **Acrobat Reader on iOS (anecdotal).** Garbled text in PDFs with Hindi fonts. — [Adobe Community](https://community.adobe.com/t5/acrobat-reader-mobile-discussions/garbled-text-in-pdf-with-hindi-fonts-on-ios/m-p/14314488)
- **Firefox's built-in PDF viewer (pdf.js).** Reports of text not displaying correctly in PDFs; the Indic connection was not confirmed. — [Mozilla Support](https://support.mozilla.org/cs/questions/1402379)

### Inferences
- Marketing can honestly say that "Acrobat's own community reports matras shifting when Hindi is edited" and that "Acrobat's OCR has no Hindi," with links to the sources. Any claims about other named competitors need first-hand tests first, as the project's AGENTS.md requires.

### Gaps
- Reddit and YouTube (including Hindi-language tutorials) were not effectively surfaced in searches. Run targeted searches such as "PDF me Hindi edit kaise kare" and look at r/india or r/IndianGaming-type communities.
- No public evidence was found for Sejda, Foxit, PDFescape or LightPDF on Hindi.
