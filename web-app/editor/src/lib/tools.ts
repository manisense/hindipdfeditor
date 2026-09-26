export type ToolId = "edit" | "merge" | "split" | "compress" | "translate";

export type ToolMeta = {
  id: ToolId;
  title: string;
  shortTitle: string;
  description: string;
  accent: string;
  category: "edit" | "organize" | "optimize" | "convert";
};

export const TOOLS: ToolMeta[] = [
  {
    id: "edit",
    title: "Edit Hindi PDF",
    shortTitle: "Edit PDF",
    description:
      "Tap detected Hindi or English text to replace it, add new overlays, or erase burned-in text — then export a new PDF.",
    accent: "#1843dd",
    category: "edit",
  },
  {
    id: "translate",
    title: "Translate Hindi ↔ English",
    shortTitle: "Translate",
    description:
      "Translate detected Hindi or English text securely in either direction, then download a new PDF.",
    accent: "#16a34a",
    category: "convert",
  },
  {
    id: "merge",
    title: "Merge PDF",
    shortTitle: "Merge",
    description:
      "Combine multiple PDFs into one file. Runs entirely in your browser.",
    accent: "#7c3aed",
    category: "organize",
  },
  {
    id: "split",
    title: "Split PDF",
    shortTitle: "Split",
    description:
      "Extract page ranges into a new PDF without uploading to a server.",
    accent: "#7c3aed",
    category: "organize",
  },
  {
    id: "compress",
    title: "Compress PDF",
    shortTitle: "Compress",
    description: "Shrink a PDF by re-encoding page images at a lower quality.",
    accent: "#f0700f",
    category: "optimize",
  },
];

export function getTool(id: string | null): ToolMeta | null {
  if (!id) return null;
  return TOOLS.find((t) => t.id === id) ?? null;
}

/** URL slug (no slashes) of each tool's public page, shared by both languages. */
export const TOOL_SLUGS: Record<ToolId, string> = {
  edit: "edit-hindi-pdf",
  translate: "translate-hindi-pdf",
  merge: "merge-pdf",
  split: "split-pdf",
  compress: "compress-pdf",
};

/** Public path of a tool page, e.g. `/merge-pdf/` or `/hi/merge-pdf/`. */
export function toolHref(id: ToolId, lang: "en" | "hi" = "en"): string {
  return `${lang === "hi" ? "/hi" : ""}/${TOOL_SLUGS[id]}/`;
}

export function readEditModeFromLocation(): "edit" | "addText" | "erase" {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  if (mode === "addText" || mode === "erase" || mode === "edit") return mode;
  return "edit";
}
