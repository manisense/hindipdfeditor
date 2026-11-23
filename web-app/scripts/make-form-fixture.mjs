// Writes mobile-app/fixtures/form-fixture.pdf: an AcroForm with a one-line text field, a
// multi-line text field, a check box, a two-button radio group, a dropdown and a multi-select list
// box on page 1, each with a printed Latin label beside it; page 2 is turned (/Rotate 90) and holds
// a text field turned with it (MK /R 90), so its answer reads upright on screen. Used by the web edit-quality gate for Fill PDF form. Labels are Latin
// only: pdf-lib cannot shape Devanagari (the Hindi answers are typed by the gate).
//   node web-app/scripts/make-form-fixture.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const { PDFDocument, PDFName, PDFString, StandardFonts, degrees, rgb } = await import(path.join(here, "../editor/node_modules/@cantoo/pdf-lib/es/index.js"));

const doc = await PDFDocument.create();
doc.setCreationDate(new Date("2026-11-23T00:00:00Z"));
doc.setModificationDate(new Date("2026-11-23T00:00:00Z"));
const page = doc.addPage([595, 842]);
const font = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);
const form = doc.getForm();
const label = (text, y) => page.drawText(text, { x: 60, y: y + 6, size: 12, font, color: rgb(0.1, 0.1, 0.1) });

page.drawText("Application form", { x: 60, y: 770, size: 20, font: bold });

label("Full name", 700);
const name = form.createTextField("applicant.name");
name.addToPage(page, { x: 200, y: 700, width: 320, height: 24, font });
name.acroField.dict.set(PDFName.of("TU"), PDFString.of("Full name"));

label("Address", 600);
const address = form.createTextField("applicant.address");
address.enableMultiline();
address.addToPage(page, { x: 200, y: 580, width: 320, height: 60, font });

label("City", 540);
form.createTextField("applicant.city").addToPage(page, { x: 200, y: 540, width: 200, height: 24, font });

label("I agree", 490);
form.createCheckBox("applicant.agree").addToPage(page, { x: 200, y: 492, width: 16, height: 16 });

label("Category", 440);
const category = form.createRadioGroup("applicant.category");
category.addOptionToPage("General", page, { x: 200, y: 442, width: 16, height: 16 });
category.addOptionToPage("Other", page, { x: 280, y: 442, width: 16, height: 16 });
page.drawText("General", { x: 222, y: 446, size: 11, font });
page.drawText("Other", { x: 302, y: 446, size: 11, font });

label("State", 390);
const state = form.createDropdown("applicant.state");
state.addOptions(["Uttar Pradesh", "Madhya Pradesh", "Bihar"]);
state.addToPage(page, { x: 200, y: 390, width: 200, height: 24, font });

label("Languages", 320);
const languages = form.createOptionList("applicant.languages");
languages.addOptions(["Hindi", "English", "Urdu"]);
languages.enableMultiselect();
languages.addToPage(page, { x: 200, y: 296, width: 200, height: 48, font });

// Page 2: a landscape form stored as a portrait page turned 90 degrees, as scanners and some
// office suites write it. Labels and the field are turned with the page.
const turned = doc.addPage([595, 842]);
turned.setRotation(degrees(90));
turned.drawText("Remarks", { x: 100, y: 60, size: 12, font, rotate: degrees(90) });
const remarks = form.createTextField("applicant.remarks");
remarks.addToPage(turned, { x: 76, y: 160, width: 24, height: 320, font });
remarks.acroField.getWidgets()[0].getOrCreateAppearanceCharacteristics().setRotation(90);
remarks.acroField.dict.set(PDFName.of("TU"), PDFString.of("Remarks"));
remarks.defaultUpdateAppearances(font);

const out = path.join(here, "../../mobile-app/fixtures/form-fixture.pdf");
fs.writeFileSync(out, await doc.save());
console.log("wrote", out);
