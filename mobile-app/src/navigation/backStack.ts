import type { MainTab } from '../ui/BottomNav';
import type { ToolId } from '../components/ToolShell';
import type { RecentFile } from '../state/recentFilesStore';

export type NavState = { activeTool: ToolId | null; tab: MainTab };
export type BackAction = { type: 'closeTool' } | { type: 'goHome' } | { type: 'exit' };

/** Decides what Android back does when no sheet or dialog is open. */
export function resolveBack(state: NavState): BackAction {
  if (state.activeTool) return { type: 'closeTool' };
  if (state.tab !== 'home') return { type: 'goHome' };
  return { type: 'exit' };
}

/** The return point a sibling tool goes back to: the Reader and the file it showed. */
export type ReturnPoint = { tool: 'viewer'; file: RecentFile };

/**
 * The open tool, the file it was opened with, and at most one remembered return point. Only the
 * Reader is remembered, and only one level deep: Reader → Edit or Translate → back returns to
 * the Reader; anything else returns to the tabs.
 */
export type ToolSession = {
  activeTool: ToolId | null;
  file: RecentFile | null;
  returnTo: ReturnPoint | null;
};

export type ToolSessionAction =
  /** Opens `tool`. `fromReader` remembers the Reader (showing `file`) as the return point. */
  | { type: 'open'; tool: ToolId; file: RecentFile | null; fromReader?: boolean }
  /** Close or Android back from the open tool. */
  | { type: 'close' };

export const NO_TOOL: ToolSession = { activeTool: null, file: null, returnTo: null };

/** Applies an open or close to the tool session. */
export function toolSessionReducer(state: ToolSession, action: ToolSessionAction): ToolSession {
  if (action.type === 'open') {
    const returnTo: ReturnPoint | null =
      action.fromReader && action.file ? { tool: 'viewer', file: action.file } : null;
    return { activeTool: action.tool, file: action.file, returnTo };
  }
  if (state.returnTo) {
    return { activeTool: state.returnTo.tool, file: state.returnTo.file, returnTo: null };
  }
  return NO_TOOL;
}
