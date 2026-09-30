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
