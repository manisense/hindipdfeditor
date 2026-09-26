import { Combine, FileArchive, Languages, Pencil, Scissors, type LucideIcon } from 'lucide-react';

import type { ToolId } from '../lib/tools';

type ToolVisual = {
  icon: LucideIcon;
  nameEn: string;
  nameHi: string;
  /** One-line outcome shown under the tool name in pickers and menus. */
  taglineEn: string;
  taglineHi: string;
  /** Tailwind classes for the category icon chip (design-system.md accent table). */
  chip: string;
};

/** Icon, bilingual name and category chip for every tool, shared by all pickers and navs. */
export const TOOL_VISUALS: Record<ToolId, ToolVisual> = {
  edit: {
    icon: Pencil,
    nameEn: 'Edit Hindi PDF',
    nameHi: 'हिंदी पीडीएफ एडिट',
    taglineEn: 'Replace, add or erase text',
    taglineHi: 'टेक्स्ट बदलें, जोड़ें या मिटाएं',
    chip: 'bg-cat-edit-tint text-cat-edit',
  },
  translate: {
    icon: Languages,
    nameEn: 'Translate',
    nameHi: 'अनुवाद',
    taglineEn: 'Hindi ↔ English on the page',
    taglineHi: 'हिंदी ↔ अंग्रेजी, पेज पर ही',
    chip: 'bg-cat-translate-tint text-cat-translate',
  },
  merge: {
    icon: Combine,
    nameEn: 'Merge PDF',
    nameHi: 'पीडीएफ जोड़ें',
    taglineEn: 'Combine files in any order',
    taglineHi: 'कई फाइलें एक में',
    chip: 'bg-cat-merge-tint text-cat-merge',
  },
  split: {
    icon: Scissors,
    nameEn: 'Split PDF',
    nameHi: 'पेज अलग करें',
    taglineEn: 'Pull out a page range',
    taglineHi: 'चुने हुए पेज निकालें',
    chip: 'bg-cat-merge-tint text-cat-merge',
  },
  compress: {
    icon: FileArchive,
    nameEn: 'Compress PDF',
    nameHi: 'साइज कम करें',
    taglineEn: 'Shrink for portal uploads',
    taglineHi: 'पोर्टल अपलोड के लिए छोटा करें',
    chip: 'bg-cat-sarkari-tint text-cat-sarkari',
  },
};
