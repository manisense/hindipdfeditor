/**
 * Shared Google Analytics 4 loader for hindipdfeditor.com.
 * Measurement ID: G-1K5ZEEBHE5 (stream: hindipdfeditor).
 * Loaded once per page via <script src="/assets/analytics.js"> immediately after <head>.
 * Do not also paste a second inline gtag snippet on the same page.
 */
const GOOGLE_ANALYTICS_ID = 'G-1K5ZEEBHE5';

window.dataLayer = window.dataLayer || [];
function gtag() {
  window.dataLayer.push(arguments);
}
window.gtag = gtag;

const tag = document.createElement('script');
tag.async = true;
tag.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`;
document.head.appendChild(tag);

gtag('js', new Date());
gtag('config', GOOGLE_ANALYTICS_ID, {
  anonymize_ip: true,
  cookie_flags: 'SameSite=Lax;Secure',
});
