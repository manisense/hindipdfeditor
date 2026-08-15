import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { CircleCheck, CircleX, Info, TriangleAlert, X } from 'lucide-react';

import { AppButton } from './AppButton';
import {
  AppPopupContext,
  type AppPopupTone,
  type ShowPopupOptions,
} from './appPopupContext';
import './AppPopup.css';

export type { AppPopupTone, ShowPopupOptions } from './appPopupContext';

type AppPopupProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  eyebrow?: string;
  tone?: AppPopupTone;
  onClose?: () => void;
  closeLabel?: string;
};

const toneIcons = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleX,
} as const;

const focusableSelector = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Brand-consistent modal window used by every popup flow in the web app.
 * It traps focus, restores the prior focus target, and supports Escape/backdrop dismissal.
 */
export function AppPopup({
  open,
  title,
  children,
  actions,
  eyebrow = 'Hindi PDF Editor',
  tone = 'info',
  onClose,
  closeLabel = 'Close popup',
}: AppPopupProps) {
  const titleId = useId();
  const bodyId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const Icon = toneIcons[tone];

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const priorFocus = document.activeElement as HTMLElement | null;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusPopup = window.requestAnimationFrame(() => {
      const initialTarget = panelRef.current?.querySelector<HTMLElement>(
        '[data-popup-initial-focus]',
      );
      (initialTarget ?? panelRef.current)?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onCloseRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => element.getAttribute('aria-hidden') !== 'true');
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusPopup);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = priorOverflow;
      if (priorFocus?.isConnected) priorFocus.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="app-popup__backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        className={`app-popup__panel app-popup__panel--${tone}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
      >
        <div className="app-popup__glow" aria-hidden="true" />
        <header className="app-popup__header">
          <span className="app-popup__icon" aria-hidden="true">
            <Icon size={25} strokeWidth={2.25} />
          </span>
          <div className="app-popup__heading">
            <span className="app-popup__eyebrow">{eyebrow}</span>
            <h2 id={titleId}>{title}</h2>
          </div>
          {onClose && (
            <button
              type="button"
              className="app-popup__close"
              aria-label={closeLabel}
              onClick={onClose}
            >
              <X size={19} aria-hidden="true" />
            </button>
          )}
        </header>
        <div id={bodyId} className="app-popup__body">
          {children}
        </div>
        {actions && <footer className="app-popup__actions">{actions}</footer>}
      </div>
    </div>,
    document.body,
  );
}

type PopupRequest = ShowPopupOptions & {
  id: number;
  resolve: () => void;
};

/** Provides a queued, promise-based replacement for native browser alert windows. */
export function AppPopupProvider({ children }: { children: ReactNode }) {
  const nextIdRef = useRef(0);
  const queueRef = useRef<PopupRequest[]>([]);
  const activeRef = useRef<PopupRequest | null>(null);
  const [active, setActive] = useState<PopupRequest | null>(null);

  const showPopup = useCallback((options: ShowPopupOptions) => {
    return new Promise<void>((resolve) => {
      const request: PopupRequest = {
        ...options,
        id: ++nextIdRef.current,
        resolve,
      };
      if (activeRef.current) {
        queueRef.current.push(request);
        return;
      }
      activeRef.current = request;
      setActive(request);
    });
  }, []);

  const closeActive = useCallback(() => {
    const completed = activeRef.current;
    const next = queueRef.current.shift() ?? null;
    activeRef.current = next;
    setActive(next);
    completed?.resolve();
  }, []);

  useEffect(
    () => () => {
      activeRef.current?.resolve();
      for (const request of queueRef.current) request.resolve();
      queueRef.current = [];
      activeRef.current = null;
    },
    [],
  );

  const value = useMemo(() => ({ showPopup }), [showPopup]);

  return (
    <AppPopupContext.Provider value={value}>
      {children}
      <AppPopup
        key={active?.id}
        open={active !== null}
        title={active?.title ?? ''}
        tone={active?.tone}
        eyebrow={active?.eyebrow}
        onClose={closeActive}
      >
        <p>{active?.message}</p>
        <div className="app-popup__inline-action">
          <AppButton
            title={active?.actionLabel ?? 'Got it'}
            onClick={closeActive}
            data-popup-initial-focus
          />
        </div>
      </AppPopup>
    </AppPopupContext.Provider>
  );
}
