(function () {
  if (
    !["hindipdfeditor.com", "www.hindipdfeditor.com"].includes(
      window.location.hostname,
    )
  )
    return;
  /**
   * Shared Google Analytics 4 loader & AI-Referral Detector for hindipdfeditor.com.
   * Measurement ID: G-1K5ZEEBHE5 (stream: hindipdfeditor).
   * Automatically classifies and tracks traffic from AI search engines (GEO / AIEO).
   */
  function safeReferrerOrigin() {
    try {
      return document.referrer ? new URL(document.referrer).origin : "";
    } catch {
      return "";
    }
  }

  const GOOGLE_ANALYTICS_ID = "G-1K5ZEEBHE5";

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;

  const tag = document.createElement("script");
  tag.async = true;
  tag.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`;
  document.head.appendChild(tag);

  gtag("js", new Date());
  gtag("config", GOOGLE_ANALYTICS_ID, {
    page_location: window.location.origin + window.location.pathname,
    page_referrer: safeReferrerOrigin(),
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_flags: "SameSite=Lax;Secure",
  });

  // Auto-detect and track AI-Engine Referrals (Phase 6 of 2026 Playbook)
  (function trackAiReferral() {
    try {
      const ref = safeReferrerOrigin().toLowerCase();
      let aiEngine = null;

      if (ref === "https://chatgpt.com" || ref === "https://chat.openai.com") {
        aiEngine = "ChatGPT";
      } else if (ref === "https://perplexity.ai") {
        aiEngine = "Perplexity";
      } else if (ref === "https://claude.ai") {
        aiEngine = "Claude";
      } else if (ref === "https://gemini.google.com") {
        aiEngine = "Gemini";
      } else if (ref === "https://copilot.microsoft.com") {
        aiEngine = "Copilot";
      }

      if (aiEngine) {
        gtag("event", "ai_referral_visit", {
          ai_platform: aiEngine,
          landing_page: window.location.pathname,
        });
      }
    } catch {
      // Non-blocking telemetry
    }
  })();
})();
