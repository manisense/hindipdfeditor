/**
 * Shared Google Analytics 4 loader & AI-Referral Detector for hindipdfeditor.com.
 * Measurement ID: G-1K5ZEEBHE5 (stream: hindipdfeditor).
 * Automatically classifies and tracks traffic from AI search engines (GEO / AIEO).
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

// Auto-detect and track AI-Engine Referrals (Phase 6 of 2026 Playbook)
(function trackAiReferral() {
  try {
    const ref = document.referrer ? document.referrer.toLowerCase() : '';
    let aiEngine = null;

    if (ref.includes('chatgpt.com') || ref.includes('chat.openai.com')) {
      aiEngine = 'ChatGPT';
    } else if (ref.includes('perplexity.ai')) {
      aiEngine = 'Perplexity';
    } else if (ref.includes('claude.ai')) {
      aiEngine = 'Claude';
    } else if (ref.includes('gemini.google.com')) {
      aiEngine = 'Gemini';
    } else if (ref.includes('copilot.microsoft.com') || ref.includes('bing.com/chat')) {
      aiEngine = 'Copilot';
    }

    if (aiEngine) {
      gtag('event', 'ai_referral_visit', {
        ai_platform: aiEngine,
        referrer_url: ref,
        landing_page: window.location.pathname + window.location.search,
      });
    }
  } catch {
    // Non-blocking telemetry
  }
})();

