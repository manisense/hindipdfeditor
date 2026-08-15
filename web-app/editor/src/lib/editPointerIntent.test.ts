import { describe, expect, it } from 'vitest';

import { shouldDismissFocusedEdit } from './editPointerIntent';

describe('shouldDismissFocusedEdit', () => {
  it('keeps a pointer gesture on the active editor interactive', () => {
    expect(shouldDismissFocusedEdit('edit-a', 'edit-a')).toBe(false);
  });

  it('makes a click on a different editor dismiss-only', () => {
    expect(shouldDismissFocusedEdit('edit-a', 'edit-b')).toBe(true);
  });

  it('makes a click on the page dismiss-only while an editor is active', () => {
    expect(shouldDismissFocusedEdit('edit-a', null)).toBe(true);
  });

  it('allows a fresh page gesture when no editor is active', () => {
    expect(shouldDismissFocusedEdit(null, null)).toBe(false);
    expect(shouldDismissFocusedEdit(null, 'edit-b')).toBe(false);
  });
});
