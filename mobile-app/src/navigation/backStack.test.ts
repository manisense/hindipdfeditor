import type { RecentFile } from '../state/recentFilesStore';
import { NO_TOOL, resolveBack, toolSessionReducer } from './backStack';

describe('resolveBack', () => {
  it('closes an open tool first', () => {
    expect(resolveBack({ activeTool: 'merge', tab: 'tools' })).toEqual({ type: 'closeTool' });
  });
  it('returns to Home from another tab', () => {
    expect(resolveBack({ activeTool: null, tab: 'files' })).toEqual({ type: 'goHome' });
  });
  it('lets Android exit from Home', () => {
    expect(resolveBack({ activeTool: null, tab: 'home' })).toEqual({ type: 'exit' });
  });
});

const file: RecentFile = {
  id: 'a',
  name: 'पत्र.pdf',
  uri: 'file:///a.pdf',
  sizeBytes: 1024,
  pageCount: 2,
  date: '',
  category: 'downloads',
};

describe('toolSessionReducer', () => {
  it('returns to the Reader after Edit or Translate opened from it', () => {
    const reader = toolSessionReducer(NO_TOOL, { type: 'open', tool: 'viewer', file });
    const editor = toolSessionReducer(reader, {
      type: 'open',
      tool: 'edit',
      file,
      fromReader: true,
    });
    expect(editor).toEqual({ activeTool: 'edit', file, returnTo: { tool: 'viewer', file } });
    expect(toolSessionReducer(editor, { type: 'close' })).toEqual({
      activeTool: 'viewer',
      file,
      returnTo: null,
    });
  });

  it('remembers only one level, so back from the restored Reader goes to the tabs', () => {
    const editor = toolSessionReducer(NO_TOOL, {
      type: 'open',
      tool: 'translate',
      file,
      fromReader: true,
    });
    const reader = toolSessionReducer(editor, { type: 'close' });
    expect(toolSessionReducer(reader, { type: 'close' })).toEqual(NO_TOOL);
  });

  it('forgets the Reader when another route opens a tool', () => {
    const editor = toolSessionReducer(NO_TOOL, {
      type: 'open',
      tool: 'edit',
      file,
      fromReader: true,
    });
    const saved = toolSessionReducer(editor, { type: 'open', tool: 'viewer', file });
    expect(saved.returnTo).toBeNull();
    expect(toolSessionReducer(saved, { type: 'close' })).toEqual(NO_TOOL);
  });

  it('closes a tool opened from a tab straight to the tabs', () => {
    const merge = toolSessionReducer(NO_TOOL, { type: 'open', tool: 'merge', file: null });
    expect(toolSessionReducer(merge, { type: 'close' })).toEqual(NO_TOOL);
  });
});
