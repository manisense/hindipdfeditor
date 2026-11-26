# User pain points with Hindi PDFs and documents in India (2023–2026)

Research date: 2026-11-26. Method: web search plus fetches of primary threads (Adobe Community, official SSC, court and ministry notices). Caveat on coverage: Reddit, Quora, Play Store review pages and YouTube comments did not show up in search results, so direct quotes from those channels are missing. Most first-person quotes below come from Adobe Community threads. Vendor and coaching sites are marked as such. No guidance on altering authority-issued documents is collected here.

## Q1. What do people complain about?

### Takeaway
The pains that come up most, and that have the strongest evidence, are (1) garbled Hindi after copy/paste, search or PDF-to-Word, caused by legacy fonts (KrutiDev/DevLys) or broken Unicode mapping, even with Mangal; (2) existing Hindi text that cannot be edited because matras scatter when people try; and (3) hard file-size and format limits on exam and court portals. OCR of legacy-font or scanned Hindi is a frequent secondary pain. Evidence for stamp-paper printing and translating notices is thin.

### Cited Findings

**A. Broken characters after copy/paste, search, export (widespread, long-running)**
- Legacy fonts store Latin codes behind Devanagari glyphs ("क" is stored as "d", "भ" as "B"), so copied text comes out as gibberish. KrutiDev and DB Bhaskar are named — [DocSet guide, Dec 2024 (vendor)](https://docset.in/blog/hindi-font-conversion-guide)
- Fedora bug: some Hindi fonts are built as Latin-1 fonts that hold Hindi glyphs, so copying from Evince to gedit breaks — [Red Hat Bugzilla 627127](https://bugzilla.redhat.com/show_bug.cgi?id=627127)
- Even proper Unicode (Mangal) PDFs from InDesign CC 2026 or Word fail: "PDF displays perfectly, but search and text extraction are unreliable". "अहिंसा" and "ट्रिब्यून" are not consistently searchable, and conjuncts and matras change on extraction. An Adobe Community Manager replied that "Acrobat's text extraction and search features currently have limited support for Indian languages" and pointed to a feature request. No fix was given (Uday Mahajan, 24 Jun 2026) — [Adobe Community](https://community.adobe.com/questions-9/hindi-unicode-pdf-search-and-copy-paste-issue-1629373)
- In a PDF-to-Word export, only the text in Mangal came out garbled. The user asked for a Hindi language option in conversion and could not find Hindi under Set Language — [Adobe Community: Mangal export](https://community.adobe.com/questions-9/pdf-export-file-not-correct-contains-mangal-hindi-unicode-font-1285751)
- A large Hindi PDF (not an image) came out garbled through Acrobat DC Pro export to Word — [Adobe Community: Hindi PDF to Word garbled](https://community.adobe.com/t5/acrobat-discussions/converting-hindi-pdf-to-word-generates-garbled-text-any-help-please/m-p/10560459/highlight/true); similar threads: [issues exporting Hindi PDF to Word](https://community.adobe.com/t5/acrobat-discussions/issues-in-exporting-pdf-in-hindi-language-to-word/td-p/8952605), [exporting to Word shows junk characters](https://community.adobe.com/t5/acrobat-discussions/exporting-to-word-shows-junk-characters/m-p/14956778)
- Mozilla support says the problem is in the PDF, not the browser, and that only the PDF's creator can fix it — [Mozilla support 1402379](https://support.mozilla.org/zu/questions/1402379)
- A Hindi font displays wrongly in PDF export but fine in JPG/PNG, on letterhead (bug report) — [Adobe bug report 1622235](https://community.adobe.com/bug-reports-328/hindi-font-not-displaying-correctly-in-pdf-export-works-fine-in-jpg-png-letterhead-issue-1622235)
- A translator forum thread covers copying Hindi from PDFs for translation work — [ProZ forum: copying and pasting from a PDF in Hindi](https://tha.proz.com/forum/hindi/337415-copying_and_pasting_from_a_pdf_in_hindi.html)
- An academic user (Yashee Singh, 2 Dec 2025) writes that legacy-font PDFs "show Devanagari script on screen" while being "internally stored as Roman characters". Online converters "assumed English content" and failed. pdfplumber/PyMuPDF return garbled English for legacy fonts and None for scans. She calls it "a historical problem, rooted in the legacy of Indian publishing practices" — [The Digital Orientalist](https://digitalorientalist.com/2025/12/02/why-extracting-hindi-text-from-pdfs-is-so-much-harder-than-english-and-how-you-can-do-it/)

**B. Cannot edit existing Hindi text (widespread, strong frustration)**
- "all the Hindi matras (diacritical marks) get scattered, meaning they don't remain in their correct form". "This issue occurs with all Hindi PDFs, regardless of which font is used". The user says the problem has existed "for many years" (Abhishek Ravi, 30 Sep / 2 Oct 2025) — [Adobe Community: Hindi PDF page edit problem](https://community.adobe.com/questions-9/hindi-language-pdf-page-edit-problem-1304863)
- The same user a week later: "When editing Hindi PDFs, the matras that get scattered don't get fixed and ruin the entire sentence". The problem is in Edit mode and "has persisted since the start". Volunteer replies offered settings checks only (8 Oct 2025) — [Adobe Community: edit mismatch](https://community.adobe.com/t5/acrobat-discussions/hindi-language-all-pdf-edit-problem-edit-is-mismatch-not-accurate/m-p/15539551/highlight/true)
- Typing a name in Hindi in Acrobat Reader forms is a recurring question — [Adobe Community: typing name in Hindi](https://community.adobe.com/t5/acrobat-reader-discussions/adobe-acrobat-reader-dc-typin-name-in-hindi-language/m-p/10331213); Punjabi and Gujarati form inputs render badly too — [Adobe Community 1552298](https://community.adobe.com/questions-9/problems-rendering-punjabi-and-gujarati-text-in-pdf-form-inputs-1552298)
- Android PDF apps admit Indic limits in their own listings. One says "Malayalam and Hindi edits now save correctly", which implies they did not before. Another says PDF text uses Latin letters and "other scripts become ?" — [PDF Editor: Edit Text & Sign](https://play.google.com/store/apps/details?id=com.arzdrz.pdf_text_editor&hl=en_IN); [Easy PDF Edit](https://play.google.com/store/apps/details?id=app.manthan.pdf)
- Competitors that put Indic text on scans add it "as a crisp image", so it cannot be edited later — [Pixelpath Edit PDF](https://pdf.pixelpath.in/edit-pdf/)

**C. KrutiDev vs Unicode confusion (widespread among typists and offices)**
- KrutiDev-to-Unicode conversion is not a one-to-one swap. The same character can come from different keystroke orders and matras need reordering, so simple Word macros fail — [ProZ thread](https://ben.proz.com/post/3001315); [Kruti Dev, Wikipedia](https://en.wikipedia.org/wiki/Kruti_Dev)
- Font and layout get mixed up. Remington GAIL/CBI and Inscript are keyboard layouts, while Mangal (Unicode) and KrutiDev (legacy) are fonts. Tutorial sites have to spell this out — [TypingMaster (vendor)](https://www.typingmaster.com/typing-tutor/hindi-typing-test.html); [hindityping.info](https://hindityping.info/hindi-mangal-inscript-typing/)
- The official SSC CHSL 2023 Tier II typing instructions list Hindi Inscript, Hindi Krutidev, Hindi Remington GAIL and Hindi Remington CBI, so the exam keeps the legacy layout alive — [SSC CR candidate instructions 2023](https://mail.ssc-cr.org/noticeboard/CHSL%202023%20Tier%20II%20Typing_Candidate%20Instructions_%20v_3-_10_2023.pdf); [SSC KKR instructions](https://www.ssckkr.kar.nic.in/CHSLE-23(T-2)_TT%20Instructions.pdf)
- EPFO's SSA typing test (Nov 2023) uses Mangal for Hindi. IGM Kolkata's JOA test (2023) offers both KrutiDev 010 and Mangal Inscript — [EPFO notice](https://www.epfindia.gov.in:443/site_docs/PDFs/Recruitments_PDFs/Exam_SSATypingTest_02112023.pdf); [SPMCIL IGM Kolkata](https://igmkolkata.spmcil.com/wp-content/uploads/2023/04/Guidelines-for-Typing-Test-for-JOA.pdf)
- A research institute's circular cites the Department of Official Language's Annual Programme for 2026-27: central offices must adopt Unicode Hindi software and fonts, and KrutiDev is blamed for readability errors and formatting loss in file transfer. The circular's text is OCR-garbled, so the wording is approximate — [RFRI/ICFRE circular 38](https://rfri.icfre.org/circular-files/circular38.pdf)
- A CAG circular dated 08.04.2026 on Hindi in e-Office says bilingual work should be converted into Unicode font — [CAG circular](https://cag.gov.in/uploads/ae_circulars_office_orders/CircularsOfficeOrders-069d89fcba5ea81-97780071.pdf)
- Rajasthan High Court e-filing guidelines require Hindi to be typed in Unicode, and KrutiDev/DevLys are not allowed. A Jharkhand HC order instead refers to "Kruti Dev Unicode" for trial courts, so the rules are inconsistent — [Rajasthan HC e-filing guidelines](https://hcraj.nic.in/hcraj/Allfiles/GuidelinesForEfiling.pdf); [Jharkhand HC e-filing order 2020](https://www.jharkhandhighcourt.nic.in/display_pdf/E-FILING_578_2_2020_24112020.pdf) (summarised through search, PDFs not opened in full)
- A large long tail of KrutiDev↔Unicode converter sites (indiatyping, docset, goonlinetools, RajTool on Product Hunt, krutidev01.github.io) shows heavy, ongoing demand. Reverse converters (Unicode→DevLys/KrutiDev) exist for legacy DTP and portals — [indiatyping](https://indiatyping.com/index.php/font-converter/krutidev-to-unicode-converter); [DocSet Unicode→DevLys](https://docset.in/font-converter-tools/unicode-to-devlys); [RajTool](https://www.producthunt.com/p/rajtool/krutidev-to-unicode-converter-by-rajtool)

**D. OCR misreads (common, secondary)**
- Tesseract produced blank or mixed-up output on legacy-font PDFs. Acrobat (German build) lacked Hindi OCR — [The Digital Orientalist, Dec 2025](https://digitalorientalist.com/2025/12/02/why-extracting-hindi-text-from-pdfs-is-so-much-harder-than-english-and-how-you-can-do-it/)
- Research papers on post-OCR correction for Devanagari (2024–2025) point to look-alike characters and matra errors as the main failure modes — [RoundTripOCR, arXiv 2412.15248](https://arxiv.org/html/2412.15248v1); [MLM-BERT Hindi OCR correction](https://www.iieta.org/journals/isi/paper/10.18280/isi.290223)
- Panchayat, school and accounts registers lose their table structure in plain OCR. Handwriting and damaged pages need correction — [dev.to, Algoza (vendor), 2026](https://dev.to/algozasolutions/india-runs-on-scanned-documents-why-cant-we-convert-them-properly-4kcd)
- Bilingual Hindi+English PDF conversion needs OCR language set to Hindi — [WPS (vendor)](https://www.wps.com/office-quick-solution/pdf-troubleshooting/how-to-convert-a-bilingual-english-and-hindi-pdf-using-ocr/)

**E. File-size and format limits on portals (widespread, hard constraint)**
- SSC: signature JPEG 10–20 KB and photo 20–50 KB, 3.5×4.5 cm. Sources disagree on signature dimensions (6×2 cm vs 4×2 cm). The "date on photo" rule is called the most common rejection reason. All of these are coaching sources, not ssc.gov.in — [PW SSC CGL 2026](https://www.pw.live/ssc/exams/ssc-cgl-photo-and-signature-size-2026); [Adda247 SSC GD](https://www.adda247.com/exams/ssc/ssc-gd-photo-and-signature-size); [Testbook](https://testbook.com/news/ssc-gd-signature-photo-size/)
- Candidates ask in anxious questions whether a wrong-dimension upload will get their form rejected — [Careers360 Q&A](https://www.careers360.com/question-hello-i-have-mistakenly-uploaded-signature-picture-of-wrong-dimensions-in-ssc-chsl-will-my-form-be-rejected)
- UPSC: photo and signature most often given as 20–300 KB, with narrower ranges in some guides (20–200, 20–100). No official upsc.gov.in page was found, so sources conflict — [Vajiram & Ravi 2026](https://vajiramandravi.com/upsc-exam/upsc-photo-and-signature-guidelines/); [BYJU'S](https://byjus.com/free-ias-prep/requirements-for-photograph-and-signature-to-be-uploaded-for-upsc-exam)
- Sarkari tool guides list "PDF under 200 KB" compression as a standard form-upload need — [sopkit exam tools](https://sopkit.github.io/tool-guides/exam-tools/)
- Courts: Delhi HC raised its e-filing cap to 300 MB from 7 Feb 2026 (earlier 100 MB, district courts 20 MB). Rajasthan HC allows 20 MB and asks for large files to be split. Several courts require OCR-searchable PDF or PDF/A, with scans at 300 DPI — [Delhi HC notice 2026](https://delhihighcourt.nic.in/files/2026-02/announcements/16it.pdf); [Rajasthan HC guidelines](https://hcraj.nic.in/hcraj/Allfiles/GuidelinesForEfiling.pdf); [Karnataka eFiling Rules 2021](https://Karnatakajudiciary.kar.nic.in/govtNotifications/eFiling-Rules-2021.pdf)

**F. Stamp paper and affidavit printing (moderate signal, weak user voice)**
- Affidavits go on state non-judicial stamp paper (Rs 10–100) or an e-stamp certificate. Page 1 is on stamp paper and later pages on plain paper, which is a layout constraint for Hindi drafts — [SANSA Legal guide](https://www.sansalegal.com/post/how-to-draft-and-execute-an-affidavit-in-india-types-format-stamp-paper-notarization-process)
- Hindi legal drafts are offered as templates — [CourtBook Hindi draft](https://courtbook.in/draft/hindi/अभिवचन-साधारणतः-e3a81e8402164ce59ef59ee0)

### Inferences
- The core pain is not "missing Hindi fonts". The text in the PDF is wrong (legacy encoding or a broken ToUnicode map), and mainstream tools including Acrobat admit limited Indic support. An editor that shows the user what the file contains (legacy vs Unicode vs scan) has a clear wedge.
- Matra scattering in Acrobat edit mode is the most emotionally charged complaint. Correct shaping during editing is the headline differentiator.
- Portal size limits are hard constraints with official backing. Compression and photo/signature resizing are high-frequency, low-glamour jobs.
- Government policy (DoOL 2026-27, CAG 2026, Rajasthan HC) is pushing offices from KrutiDev to Unicode, so legacy→Unicode conversion of existing PDFs should see more demand through 2027.

### Gaps
- No Reddit, Quora or Play Store review quotes were retrieved. Search did not index them, and these channels likely hold the student/aspirant voice. They need manual collection.
- No YouTube view counts for Hindi tutorials (e.g. "KrutiDev to Unicode", "PDF me Hindi edit kaise kare") were found.
- No official ssc.gov.in or upsc.gov.in page confirming current KB limits was opened. The figures come from coaching sites.
- No user reports on translating Hindi government notices were found.
- Google Lens Hindi OCR complaints are not documented. Only Tesseract and research-level errors are.

## Q2. Which user groups and workflows recur?

### Takeaway
Six groups recur: exam aspirants (photo/signature/PDF uploads, typing tests), government office staff and typists (KrutiDev legacy, Unicode mandates, e-Office bilingual work), lawyers and court filers (Unicode-only Hindi, OCR-searchable PDF/A, size caps), publishers and DTP (InDesign Mangal export), researchers and translators (extracting Hindi from PDFs), and panchayat, school and accounts record-keepers (scanned registers).

### Cited Findings
- Aspirants and the SSC/UPSC upload workflow — [PW SSC CGL](https://www.pw.live/ssc/exams/ssc-cgl-photo-and-signature-size-2026); [Careers360 Q&A](https://www.careers360.com/question-hello-i-have-mistakenly-uploaded-signature-picture-of-wrong-dimensions-in-ssc-chsl-will-my-form-be-rejected)
- Typists in government recruitment tests (SSC CHSL, EPFO SSA, SPMCIL JOA) — [SSC CR 2023](https://mail.ssc-cr.org/noticeboard/CHSL%202023%20Tier%20II%20Typing_Candidate%20Instructions_%20v_3-_10_2023.pdf); [EPFO 2023](https://www.epfindia.gov.in:443/site_docs/PDFs/Recruitments_PDFs/Exam_SSATypingTest_02112023.pdf)
- Typists keep KrutiDev because it imitates the Remington typewriter layout they trained on, and switching to Inscript means retraining (converter-site claim) — [indiatyping / converter sites](https://indiatyping.com/index.php/font-converter/krutidev-to-unicode-converter)
- Central government offices under Official Language rules and e-Office bilingual noting — [CAG circular 08.04.2026](https://cag.gov.in/uploads/ae_circulars_office_orders/CircularsOfficeOrders-069d89fcba5ea81-97780071.pdf); [RFRI circular](https://rfri.icfre.org/circular-files/circular38.pdf)
- Lawyers and court e-filing — [Rajasthan HC](https://hcraj.nic.in/hcraj/Allfiles/GuidelinesForEfiling.pdf); [Delhi HC](https://delhihighcourt.nic.in/files/2026-02/announcements/16it.pdf)
- Publishers using InDesign/Word with Mangal for Hindi print PDFs (Tribune-like content, given the "ट्रिब्यून" example) — [Adobe Community Jun 2026](https://community.adobe.com/questions-9/hindi-unicode-pdf-search-and-copy-paste-issue-1629373)
- Researchers and translators — [Digital Orientalist](https://digitalorientalist.com/2025/12/02/why-extracting-hindi-text-from-pdfs-is-so-much-harder-than-english-and-how-you-can-do-it/); [ProZ](https://tha.proz.com/forum/hindi/337415-copying_and_pasting_from_a_pdf_in_hindi.html)
- Gram panchayat, school and invoice registers — [dev.to Algoza](https://dev.to/algozasolutions/india-runs-on-scanned-documents-why-cant-we-convert-them-properly-4kcd)

**Demand signal only: fixing errors on authority-issued documents.** Students often search for how to fix a wrong name or photo on an admit card. All guidance points to the legitimate route: the issuing body's correction window, or the helpdesk with ID proof. For WBBSE the route is the school headmaster. Handwritten or self-made corrections are invalid and lead to rejection — [PW CAT 2026](https://www.pw.live/news/cat-2026-admit-card-error-correction); [PW JEE Main 2026](https://www.pw.live/iit-jee/exams/jee-main-2026-session-2-admit-card-errors-what-to-do-if-any-detail-is-wrong); [Careers360 NEET](https://medicine.careers360.com/articles/what-to-do-if-name-is-wrong-in-nta-neet-admit-card-2026); [Collegedunia WBBSE](https://collegedunia.com/articles/e-1043-wbbse-madhyamik-supplementary-2026-admit-card-how-to-fix-wrong-name-photo-or-exam-centre). The product should send these users to the correction window or an affidavit, not offer to edit the document.

### Inferences
- Aspirants are the largest group by volume (every recruitment cycle) but want small utilities. Offices, courts and typists have deeper, repeat editing and conversion needs.
- Land records came up only as a forbidden-edit category. No legitimate editing workflow evidence was found.

### Gaps
- No quantified share of users by group. No data on teachers or coaching-note workflows (Hindi notes PDFs on Telegram) was retrieved.

## Q3. What workarounds are used today, and what role do cyber cafés and CSC operators play?

### Takeaway
People work around the problems with copy, then a converter site, then paste (KrutiDev/DevLys→Unicode), OCR (Tesseract, Google/Drive, WPS), installing the source font and pasting into Word, converting pages to JPG for OCR, and retyping. Cyber cafés and CSCs sell form filling as a service, which makes them high-frequency power users of resize, compress and fill tools. Evidence on their workflows is thin and comes mostly from shop listings.

### Cited Findings
- Copy the garbled text, then a DevLys/KrutiDev→Unicode converter, then paste — [DocSet guide (vendor)](https://docset.in/blog/hindi-font-conversion-guide); [Font2Unicode via Digital Orientalist](https://digitalorientalist.com/2025/12/02/why-extracting-hindi-text-from-pdfs-is-so-much-harder-than-english-and-how-you-can-do-it/)
- One user got correct text by pasting into Word with Arial Unicode MS — [Adobe Community: copy Hindi text](https://community.adobe.com/t5/acrobat-reader-discussions/copy-hindi-text-from-pdf-documents/m-p/5974654)
- PDF pages converted to JPG (Adobe/iLovePDF), then Tesseract with a Hindi pack in a custom Python script, which is slow and sensitive to image quality — [Digital Orientalist](https://digitalorientalist.com/2025/12/02/why-extracting-hindi-text-from-pdfs-is-so-much-harder-than-english-and-how-you-can-do-it/)
- OCR used to bypass a broken encoding — [WPS (vendor)](https://www.wps.com/office-quick-solution/pdf-troubleshooting/how-to-fix-copied-pdf-text-appearing-as-symbols-instead-of-letters/)
- Asking the publisher to re-export is the only "real" fix according to Mozilla/Adobe staff — [Mozilla support](https://support.mozilla.org/zu/questions/1402379)
- Typists keep typing in KrutiDev and convert before sharing — [converter-site summary](https://docset.in/blog/convert-kruti-dev-to-unicode-typing-test)
- Free browser tools for photo/signature resizing aimed at sarkari aspirants, some warning about uploading documents to free servers — [sarkari-pixel privacy post](https://sarkari-pixel-web.pages.dev/govtjob-image-resizer/public/blog/online-privacy-for-aspirants-why-uploading-documents-to-free-servers-is-dangerous); [DocSet resize SSC CGL](https://docset.in/resize/ssc-cgl)
- Cyber cafés and Jan Seva Kendras advertise competitive exam and admission form filling, data entry, and PAN/passport services — [IndiaMART cybercafe Arambagh](https://m.indiamart.com/cybercafe-arambagh); [Saraswati Digital Jan Seva Kendra](https://saraswatidigitaljansevakendra.odoo.com/); [Cyber Cafe form fill-up service](https://sites.google.com/view/cybercafeon/form-fillup-service)
- Government schemes route uploads through CSC logins (Assam ULB toilet-photo manual: resize and geotag the photo, then upload through CSC) — [Assam DoHUA manual](https://dohua.assam.gov.in/sites/default/files/swf_utility_folder/departments/udd_medhassu_in_oid_3/portlet/level_3/UserManual_ToiletPhotoUpload_CSC_ULB_Applicant.pdf)

### Inferences
- Every workaround is a multi-tool chain (reader, converter site, Word, OCR, retype). One flow that detects the encoding, converts or OCRs, and then lets the user edit removes several steps.
- Cyber café and CSC operators repeat the same resize, compress, fill and print jobs for many customers a day. Batch presets per portal (SSC, UPSC, IBPS, state) and fast offline processing would suit them. They also handle sensitive IDs, so local processing is a selling point.

### Gaps
- No first-person accounts from CSC or cyber café operators (YouTube and Telegram operator communities were not reachable through search). No data on per-job pricing or volume.
- No Play Store review mining of iLovePDF, Adobe Scan or Xodo for Hindi complaints was possible in this pass.
- IBPS and state PSC official size specs were not retrieved.
