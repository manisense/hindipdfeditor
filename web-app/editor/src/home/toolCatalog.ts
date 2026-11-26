import {
  ArrowLeftRight,
  ClipboardPen,
  FileArchive,
  FileImage,
  FileText,
  FileType2,
  Images,
  Languages,
  Layers,
  LayoutGrid,
  Pencil,
  Signature,
  Split,
  Type,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ToolId } from "../lib/tools";

export type ToolEntry = {
  id: ToolId;
  icon: LucideIcon;
  /** Translation keys in `translations.ts` for the name and the one-line detail. */
  nameKey: string;
  detailKey: string;
};

export type ToolGroup = {
  id: "edit" | "convert" | "organize" | "optimize";
  en: string;
  hi: string;
  /** Category icon colour from AGENTS.md; text never uses it. */
  color: string;
  tools: ToolEntry[];
};

/**
 * Every tool on the site, grouped by the category in `tool-routes.json`.
 * The homepage nav menu, hero and mobile drawer all read this list, so a new
 * tool appears everywhere once it is added here.
 */
export const TOOL_GROUPS: ToolGroup[] = [
  {
    id: "edit",
    en: "Edit & sign",
    hi: "एडिट और हस्ताक्षर",
    color: "#1843DD",
    tools: [
      {
        id: "edit",
        icon: Pencil,
        nameKey: "tool.edit",
        detailKey: "tool.editSub",
      },
      {
        id: "sign",
        icon: Signature,
        nameKey: "tool.sign",
        detailKey: "tool.signSub",
      },
      {
        id: "fill-form",
        icon: ClipboardPen,
        nameKey: "tool.fill",
        detailKey: "tool.fillSub",
      },
    ],
  },
  {
    id: "convert",
    en: "Translate & convert",
    hi: "अनुवाद और कन्वर्ट",
    color: "#16A34A",
    tools: [
      {
        id: "translate",
        icon: Languages,
        nameKey: "tool.translate",
        detailKey: "tool.translateSub",
      },
      {
        id: "pdf-to-word",
        icon: FileType2,
        nameKey: "tool.pdfToWord",
        detailKey: "tool.pdfToWordSub",
      },
      {
        id: "word-to-pdf",
        icon: FileText,
        nameKey: "tool.wordToPdf",
        detailKey: "tool.wordToPdfSub",
      },
      {
        id: "pdf-to-jpg",
        icon: FileImage,
        nameKey: "tool.pdfToJpg",
        detailKey: "tool.pdfToJpgSub",
      },
      {
        id: "jpg-to-pdf",
        icon: Images,
        nameKey: "tool.jpgToPdf",
        detailKey: "tool.jpgToPdfSub",
      },
      {
        id: "krutidev",
        icon: Type,
        nameKey: "tool.krutidev",
        detailKey: "tool.krutidevSub",
      },
      {
        id: "unicode-to-krutidev",
        icon: ArrowLeftRight,
        nameKey: "tool.unicodeKrutidev",
        detailKey: "tool.unicodeKrutidevSub",
      },
    ],
  },
  {
    id: "organize",
    en: "Merge & split",
    hi: "जोड़ें और अलग करें",
    color: "#7C3AED",
    tools: [
      {
        id: "merge",
        icon: Layers,
        nameKey: "tool.merge",
        detailKey: "tool.mergeSub",
      },
      {
        id: "split",
        icon: Split,
        nameKey: "tool.split",
        detailKey: "tool.splitSub",
      },
      {
        id: "organize",
        icon: LayoutGrid,
        nameKey: "tool.organize",
        detailKey: "tool.organizeSub",
      },
    ],
  },
  {
    id: "optimize",
    en: "Compress",
    hi: "साइज कम करें",
    color: "#F0700F",
    tools: [
      {
        id: "compress",
        icon: FileArchive,
        nameKey: "tool.compress",
        detailKey: "tool.compressSub",
      },
    ],
  },
];

export const TOOL_COUNT = TOOL_GROUPS.reduce((n, g) => n + g.tools.length, 0);
