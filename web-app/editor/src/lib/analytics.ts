import type { ToolId } from "./tools";

export type ToolEvent = "pdf_open_success" | "export_success" | "export_failed";

/** Send only coarse workflow metadata; never filenames, text or raw errors. */
export function trackToolEvent(event: ToolEvent, toolId: ToolId): void {
  try {
    window.gtag?.("event", event, {
      tool_id: toolId,
      ui_language: document.documentElement.lang === "hi" ? "hi" : "en",
    });
  } catch {
    // Analytics availability must not interrupt document work.
  }
}
