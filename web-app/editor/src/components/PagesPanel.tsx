import { ChevronLeft, ChevronRight, FilePlus2, RotateCw, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useTx } from '../lib/i18n';
import type { PageOp } from '../lib/pageOps';
import './PagesPanel.css';

/** Width thumbnails are rendered at, in px (shown at about half that on high-density screens). */
const THUMBNAIL_PX = 240;

type PageInfo = { widthPt: number; heightPt: number; hasEdits: boolean };

type Props = {
  /** Changes whenever pages are reordered or rendered differently, so previews are redrawn. */
  documentId: string;
  pages: PageInfo[];
  currentPageIndex: number;
  busy: boolean;
  /** Message about the last change, with how to undo it. */
  status: string | null;
  renderThumbnail: (pageIndex: number, widthPx: number) => Promise<string>;
  onSelect: (pageIndex: number) => void;
  onOp: (op: PageOp) => void;
  onClose: () => void;
};

/** Page list for reordering, turning, deleting and adding pages, with lazily drawn previews. */
export function PagesPanel({ documentId, pages, currentPageIndex, busy, status, renderThumbnail, onSelect, onOp, onClose }: Props) {
  const tx = useTx();
  return (
    <section className="pages-panel" aria-label={tx('Pages', 'पेज')}>
      <div className="pages-panel__heading">
        <div>
          <strong>{tx('Pages', 'पेज')}</strong>
          <p className="pages-panel__hint">
            {tx(
              'Move, turn, delete or add pages. Turn a page before editing it.',
              'पेज खिसकाएं, घुमाएं, हटाएं या जोड़ें। किसी पेज को एडिट करने से पहले घुमाएं।',
            )}
          </p>
        </div>
        <button type="button" className="pages-panel__close" aria-label={tx('Close', 'बंद करें')} onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      {status && (
        <p className="pages-panel__status" role="status">
          {status}
        </p>
      )}
      <ol className="pages-panel__grid">
        {pages.map((page, index) => (
          <PageCard
            key={`${documentId}:${index}`}
            index={index}
            count={pages.length}
            page={page}
            current={index === currentPageIndex}
            busy={busy}
            render={() => renderThumbnail(index, THUMBNAIL_PX)}
            onSelect={() => onSelect(index)}
            onOp={onOp}
          />
        ))}
      </ol>
    </section>
  );
}

function PageCard({
  index,
  count,
  page,
  current,
  busy,
  render,
  onSelect,
  onOp,
}: {
  index: number;
  count: number;
  page: PageInfo;
  current: boolean;
  busy: boolean;
  render: () => Promise<string>;
  onSelect: () => void;
  onOp: (op: PageOp) => void;
}) {
  const tx = useTx();
  const ref = useRef<HTMLLIElement>(null);
  const [uri, setUri] = useState<string | null>(null);
  const renderRef = useRef(render);
  renderRef.current = render;

  // Previews are drawn when the card scrolls into view: a long document would otherwise render
  // every page at once.
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let cancelled = false;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      renderRef
        .current()
        .then((next) => {
          if (!cancelled) setUri(next);
        })
        .catch(() => undefined);
    });
    observer.observe(element);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  const n = index + 1;
  const rotateBlocked = page.hasEdits;
  return (
    <li ref={ref} className={`pages-panel__card${current ? ' pages-panel__card--current' : ''}`}>
      <button
        type="button"
        className="pages-panel__preview"
        onClick={onSelect}
        aria-current={current ? 'page' : undefined}
        aria-label={tx(`Go to page ${n}`, `पेज ${n} पर जाएं`)}
        style={{ aspectRatio: `${page.widthPt} / ${page.heightPt}` }}
      >
        {uri ? <img src={uri} alt="" /> : <span className="pages-panel__placeholder" aria-hidden="true" />}
      </button>
      <span className="pages-panel__number">{tx(`Page ${n}`, `पेज ${n}`)}</span>
      <div className="pages-panel__actions">
        <IconButton label={tx(`Move page ${n} earlier`, `पेज ${n} को पहले ले जाएं`)} disabled={busy || index === 0} onClick={() => onOp({ kind: 'move', from: index, to: index - 1 })}>
          <ChevronLeft size={16} aria-hidden="true" />
        </IconButton>
        <IconButton label={tx(`Move page ${n} later`, `पेज ${n} को बाद में ले जाएं`)} disabled={busy || index === count - 1} onClick={() => onOp({ kind: 'move', from: index, to: index + 1 })}>
          <ChevronRight size={16} aria-hidden="true" />
        </IconButton>
        <IconButton
          label={rotateBlocked ? tx(`Page ${n} has edits: turn pages before editing them`, `पेज ${n} पर बदलाव हैं: एडिट करने से पहले पेज घुमाएं`) : tx(`Turn page ${n} clockwise`, `पेज ${n} को दाईं ओर घुमाएं`)}
          disabled={busy || rotateBlocked}
          onClick={() => onOp({ kind: 'rotate', index, degrees: 90 })}
        >
          <RotateCw size={16} aria-hidden="true" />
        </IconButton>
        <IconButton label={tx(`Add a blank page after page ${n}`, `पेज ${n} के बाद खाली पेज जोड़ें`)} disabled={busy} onClick={() => onOp({ kind: 'insertBlank', after: index })}>
          <FilePlus2 size={16} aria-hidden="true" />
        </IconButton>
        <IconButton label={tx(`Delete page ${n}`, `पेज ${n} हटाएं`)} danger disabled={busy || count === 1} onClick={() => onOp({ kind: 'delete', index })}>
          <Trash2 size={16} aria-hidden="true" />
        </IconButton>
      </div>
    </li>
  );
}

function IconButton({
  label,
  disabled,
  danger,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`pages-panel__icon${danger ? ' pages-panel__icon--danger' : ''}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
