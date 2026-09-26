import { TOOLS, type ToolId } from './tools';

const KEY = 'hpe:lastTool';

/**
 * Remembers which tool the visitor used last, so the home page can offer "Continue".
 * Only the tool id is stored — never file names or document content.
 */
export function rememberLastTool(id: ToolId): void {
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    // Storage blocked (private mode, disabled site data): the shortcut simply won't show.
  }
}

/** The last tool used on this browser, or null if unknown or storage is unavailable. */
export function readLastTool(): ToolId | null {
  try {
    const value = window.localStorage.getItem(KEY);
    return TOOLS.some((tool) => tool.id === value) ? (value as ToolId) : null;
  } catch {
    return null;
  }
}
