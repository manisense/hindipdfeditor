/**
 * Decides whether a page pointer gesture should only dismiss the active text editor.
 * Capturing this at pointer-down time preserves the intent across the browser's later
 * focusout/blur events, which run before the corresponding click.
 */
export function shouldDismissFocusedEdit(
  focusedEditId: string | null,
  targetEditId: string | null,
): boolean {
  return focusedEditId !== null && targetEditId !== focusedEditId;
}

/** Returns true when a page gesture originated on an existing editable text overlay. */
export function pointerTargetsEditableText(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[data-edit-id]') !== null;
}
