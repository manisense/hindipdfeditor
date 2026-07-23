import { useEffect, useRef, useState } from "react";

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY as
      string | undefined;
    if (!sitekey) {
      setError("AI security configuration is unavailable.");
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
          setError("Security check failed. Reload and try again.");
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
    <div>
      <div ref={containerRef} aria-label="Security check" />
      {error && <p className="app__status app__status--error">{error}</p>}
    </div>
  );
}
