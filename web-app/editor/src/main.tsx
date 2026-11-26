import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";

import App from "./App";
import "./home.css";

const app = (
  <StrictMode>
    <App />
  </StrictMode>
);
const root = document.getElementById("root")!;
if (root.dataset.prerendered === "home") hydrateRoot(root, app);
else createRoot(root).render(app);

// The service worker receives files shared to the installed app (see web-app/sw.js).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Sharing to the app needs it; every tool still works without it.
    });
  });
}
