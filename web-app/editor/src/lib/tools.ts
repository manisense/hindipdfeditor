import routeManifest from "../../../tool-routes.json";

export type ToolId =
  | "edit"
  | "sign"
  | "merge"
  | "split"
  | "compress"
  | "translate"
  | "pdf-to-word"
  | "word-to-pdf";

export type ToolMeta = {
  id: ToolId;
  path: string;
  title: string;
  shortTitle: string;
  description: string;
  accent: string;
  category: "edit" | "organize" | "optimize" | "convert";
};

export const TOOLS = routeManifest as ToolMeta[];

export function getTool(id: string | null): ToolMeta | null {
  if (!id) return null;
  return TOOLS.find((t) => t.id === id) ?? null;
}

export function toolHref(id: ToolId, language?: "en" | "hi"): string {
  const tool = getTool(id);
  if (!tool) throw new Error("Unknown PDF tool");
  return tool.path + (language === "hi" ? "?lang=hi" : "");
}

export function readToolIdFromLocation(): ToolId | null {
  const pathname = window.location.pathname.replace(/\/?$/, "/");
  const route = TOOLS.find((tool) => tool.path === pathname);
  if (route) return route.id;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("tool");
  if (
    raw === "sign" ||
    raw === "pdf-to-word" ||
    raw === "word-to-pdf" ||
    raw === "edit" ||
    raw === "merge" ||
    raw === "split" ||
    raw === "compress" ||
    raw === "translate"
  ) {
    return raw;
  }
  return null;
}

/** Editor tool selected on the page: tap to edit, place text, or drag a box. */
export type EditMode = "edit" | "addText" | "erase" | "highlight" | "whiteout";

const EDIT_MODES: readonly EditMode[] = ["edit", "addText", "erase", "highlight", "whiteout"];

export function readEditModeFromLocation(): EditMode {
  const mode = new URLSearchParams(window.location.search).get("mode");
  return EDIT_MODES.find((m) => m === mode) ?? "edit";
}
