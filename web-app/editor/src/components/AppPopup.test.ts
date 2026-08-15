import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AppPopupProvider } from './AppPopup';
import { useAppPopup } from './appPopupContext';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Expected test element: ${selector}`);
  return element;
}

function PopupHarness({ resolved }: { resolved: string[] }) {
  const { showPopup } = useAppPopup();
  return createElement(
    'div',
    null,
    createElement(
      'button',
      {
        type: 'button',
        'data-testid': 'show-error',
        onClick: async () => {
          await showPopup({
            title: 'Translation couldn’t finish',
            message: 'Gemini could not complete this request.',
            tone: 'error',
            eyebrow: 'Translation failed',
            actionLabel: 'Back to editor',
          });
          resolved.push('error');
        },
      },
      'Show error',
    ),
    createElement(
      'button',
      {
        type: 'button',
        'data-testid': 'queue-popups',
        onClick: () => {
          void showPopup({ title: 'First popup', message: 'First message' });
          void showPopup({ title: 'Second popup', message: 'Second message', tone: 'success' });
        },
      },
      'Queue popups',
    ),
  );
}

describe('AppPopupProvider', () => {
  let container: HTMLDivElement;
  let root: Root;
  let resolved: string[];

  beforeEach(async () => {
    resolved = [];
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(
          AppPopupProvider,
          null,
          createElement(PopupHarness, { resolved }),
        ),
      );
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.body.style.overflow = '';
  });

  it('shows a branded accessible error popup and resolves its action', async () => {
    const trigger = requiredElement<HTMLButtonElement>('[data-testid="show-error"]');
    await act(async () => trigger.click());

    const dialog = requiredElement<HTMLDivElement>('[role="dialog"]');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.classList.contains('app-popup__panel--error')).toBe(true);
    expect(dialog.textContent).toContain('Translation couldn’t finish');
    expect(dialog.textContent).toContain('Gemini could not complete this request.');
    expect(document.body.style.overflow).toBe('hidden');

    await act(async () => {
      requiredElement<HTMLButtonElement>('[data-popup-initial-focus]').click();
    });

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(resolved).toEqual(['error']);
    expect(document.body.style.overflow).toBe('');
  });

  it('dismisses with Escape and restores focus to the trigger', async () => {
    const trigger = requiredElement<HTMLButtonElement>('[data-testid="show-error"]');
    trigger.focus();
    await act(async () => trigger.click());

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(resolved).toEqual(['error']);
  });

  it('queues simultaneous popup requests instead of overwriting them', async () => {
    await act(async () => {
      requiredElement<HTMLButtonElement>('[data-testid="queue-popups"]').click();
    });
    expect(requiredElement('[role="dialog"]').textContent).toContain('First popup');

    await act(async () => {
      requiredElement<HTMLButtonElement>('[data-popup-initial-focus]').click();
    });
    const secondDialog = requiredElement<HTMLDivElement>('[role="dialog"]');
    expect(secondDialog.textContent).toContain('Second popup');
    expect(secondDialog.classList.contains('app-popup__panel--success')).toBe(true);

    await act(async () => {
      requiredElement<HTMLButtonElement>('[data-popup-initial-focus]').click();
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
