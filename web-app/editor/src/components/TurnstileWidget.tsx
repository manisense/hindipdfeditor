import { useEffect, useRef, useState } from "react";

import { useTx } from "../lib/i18n";
import type { Bilingual } from "../lib/userMessages";
import { AppStatus } from "./AppStatus";
import "./TurnstileWidget.css";

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
      theme: "light";
      size: "compact";
    },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_ID = "cloudflare-turnstile-script";

export function TurnstileWidget({
  onToken,
}: {
  onToken: (token: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tx = useTx();
  const [error, setError] = useState<Bilingual | null>(null);

  useEffect(() => {
    const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY as
      string | undefined;
    if (!sitekey) {
      setError({ en: "AI security configuration is unavailable.", hi: "AI सुरक्षा सेटिंग उपलब्ध नहीं है।" });
      onToken(null);
      return;
    }
    let widgetId: string | null = null;
    let cancelled = false;
    const render = () => {
      if (cancelled || !window.turnstile || !containerRef.current || widgetId)
        return;
      widgetId = window.turnstile.render(containerRef.current, {
        sitekey,
        action: "ai-session",
        callback: (token) => {
          setError(null);
          onToken(token);
        },
        "expired-callback": () => onToken(null),
        "error-callback": () => {
          onToken(null);
          setError({ en: "Security check failed. Reload and try again.", hi: "सुरक्षा जाँच नहीं हो पाई। पेज दोबारा लोड करके फिर कोशिश करें।" });
        },
        theme: "light",
        size: "compact",
      });
    };
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    const onScriptError = () => {
      onToken(null);
      setError({
        en: "Security check could not load. Check your connection and reload to retry.",
        hi: "सुरक्षा जाँच लोड नहीं हुई। इंटरनेट देखें और पेज दोबारा लोड करें।",
      });
    };
    script.addEventListener("error", onScriptError);
    script.addEventListener("load", render);
    render();
    return () => {
      cancelled = true;
      script?.removeEventListener("load", render);
      script?.removeEventListener("error", onScriptError);
      if (widgetId) window.turnstile?.remove(widgetId);
      onToken(null);
    };
  }, [onToken]);

  return (
    <div className="turnstile-widget">
      <div
        className="turnstile-widget__frame"
        ref={containerRef}
        aria-label={tx("Security check", "सुरक्षा जाँच")}
      />
      {error && <AppStatus tone="error">{tx(error.en, error.hi)}</AppStatus>}
    </div>
  );
}
