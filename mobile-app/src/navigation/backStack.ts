import type { MainTab } from '../ui/BottomNav';
import type { ToolId } from '../components/ToolShell';

export type NavState = { activeTool: ToolId | null; tab: MainTab };
export type BackAction = { type: 'closeTool' } | { type: 'goHome' } | { type: 'exit' };

/** Decides what Android back does when no sheet or dialog is open. */
export function resolveBack(state: NavState): BackAction {
  if (state.activeTool) return { type: 'closeTool' };
  if (state.tab !== 'home') return { type: 'goHome' };
  return { type: 'exit' };
}
