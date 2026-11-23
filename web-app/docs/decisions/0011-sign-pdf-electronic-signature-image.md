# 0011 — Sign PDF adds an electronic signature image, not a certificate signature

Date: 23 November 2026

## Decision

The Sign PDF tool (`/tools/sign-pdf/`) places a signature **image** — drawn on a pad, typed (shaped by the browser, Hindi or English) or uploaded (optionally with its paper made transparent) — by hand, on every page or on chosen pages. It is built on the editor's export: each placement is an `ImageEdit`, so unsigned pages are copied unchanged, page rotation is handled and the output is re-opened before it is offered. Everything runs in the browser.

Automatic placement (every page, chosen pages), added 23 November 2026:

- **Shared position:** six presets, or **Custom**, a spot the user drags the signature to on any page. A custom spot is stored as the signature centre's share of the page width and height, so it lands on the same spot on pages of other sizes, and it stays inside the page.
- **Per page:** with "This page only" selected, moving or resizing the signature changes only the open page. Its box is kept in PDF points; its height follows the signature's shape. The remove button takes the signature off that page alone. Each page can be reset, or all at once.
- **Moving with "All pages":** turns the position into Custom and sets the shared width.
- **Code:** the placement logic is pure (`placementRect`, `anchorFromRect` in `signPlacement.ts`) and unit-tested.

The tool and its public copy say plainly that this is an electronic signature image and **not** a certificate-based digital signature (DSC / PAdES).

## Why

- Most users signing Hindi forms, letters and agreements need a visible signature; that is local, instant and private.
- A real digital signature needs the signer's certificate and private key (usually a USB token or a cloud signing service), PKCS#7/CMS signing and an incremental update. Doing that in the browser would mean handling private keys or sending documents to a signing service, which changes the privacy model and needs a separate decision.
- Calling an image a "digital signature" would mislead people filing documents that legally require a DSC.

## Rejected

- Certificate signing in the browser (WebCrypto + PKCS#12 upload): keys in a web page, no token support, legal weight unclear without a CA chain.
- A server signing service: documents would leave the device.
