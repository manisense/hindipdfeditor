import { useEffect, useRef, useState } from "react";

import { useTx } from "../lib/i18n";
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
  const [error, setError] = useState<"unconfigured" | "failed" | null>(null);

  useEffect(() => {
    const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY as
      string | undefined;
    if (!sitekey) {
      setError("unconfigured");
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
        callback: (token) => onToken(token),
        "expired-callback": () => onToken(null),
        "error-callback": () => {
          onToken(null);
          setError("failed");
        },
        theme: "light",
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
    script.addEventListener("load", render);
    render();
    return () => {
      cancelled = true;
      script?.removeEventListener("load", render);
      if (widgetId) window.turnstile?.remove(widgetId);
      onToken(null);
    };
  }, [onToken]);

  return (
    <div className="turnstile-widget">
      <div className="turnstile-widget__frame" ref={containerRef} aria-label="Security check" />
      {error && (
        <AppStatus tone="error">
          {error === "unconfigured"
            ? tx("AI security configuration is unavailable.", "AI सुरक्षा सेटिंग उपलब्ध नहीं है।")
            : tx("Security check failed. Reload and try again.", "सुरक्षा चेक विफल रहा। पेज रीलोड करके फिर कोशिश करें।")}
        </AppStatus>
      )}
    </div>
  );
}
