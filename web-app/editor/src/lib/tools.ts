import routeManifest from "../../../tool-routes.json";

export type ToolId = "edit" | "merge" | "split" | "compress" | "translate";

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

export function readEditModeFromLocation(): "edit" | "addText" | "erase" {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  if (mode === "addText" || mode === "erase" || mode === "edit") return mode;
  return "edit";
}
