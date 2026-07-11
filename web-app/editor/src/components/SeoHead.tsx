import { useEffect } from 'react';

import {
  applyHomeJsonLd,
  applySeo,
  applyToolJsonLd,
  clearHomeJsonLd,
  clearToolJsonLd,
  seoForTool,
} from '../lib/seo';
import type { ToolId } from '../lib/tools';

type Props = {
  toolId: ToolId | null;
};

/**
 * Keeps document head (title, description, canonical, OG/Twitter, JSON-LD) in sync with
 * the active SPA tool route so crawlers and answer engines see the right page signals.
 */
export function SeoHead({ toolId }: Props) {
  useEffect(() => {
    const payload = seoForTool(toolId);
    applySeo(payload);
    if (toolId) {
      clearHomeJsonLd();
      applyToolJsonLd(toolId);
    } else {
      clearToolJsonLd();
      applyHomeJsonLd();
    }
  }, [toolId]);

  return null;
}
