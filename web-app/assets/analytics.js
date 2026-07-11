const GOOGLE_ANALYTICS_ID = "G-1K5ZEEBHE5";

if (/^G-[A-Z0-9]+$/.test(GOOGLE_ANALYTICS_ID)) {
  const tag = document.createElement("script");
  tag.async = true;
  tag.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`;
  document.head.appendChild(tag);

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }

  gtag("js", new Date());
  gtag("config", GOOGLE_ANALYTICS_ID, {
    anonymize_ip: true,
    cookie_flags: "SameSite=Lax;Secure",
  });
}
