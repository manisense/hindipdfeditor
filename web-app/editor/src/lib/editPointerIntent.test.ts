import { describe, expect, it } from 'vitest';

import { pointerTargetsEditableText, shouldDismissFocusedEdit } from './editPointerIntent';

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

describe('pointerTargetsEditableText', () => {
  it('recognizes an editable overlay and its descendants', () => {
    const textarea = document.createElement('textarea');
    textarea.dataset.editId = 'edit-a';
    const child = document.createElement('span');
    textarea.append(child);

    expect(pointerTargetsEditableText(textarea)).toBe(true);
    expect(pointerTargetsEditableText(child)).toBe(true);
  });

  it('rejects page targets and missing targets', () => {
    expect(pointerTargetsEditableText(document.createElement('div'))).toBe(false);
    expect(pointerTargetsEditableText(null)).toBe(false);
  });
});
