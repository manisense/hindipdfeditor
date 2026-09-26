import { useRef, useState, type DragEvent } from 'react';
import { ArrowRight, ChevronRight, FileText, UploadCloud, X } from 'lucide-react';

import { TOOL_VISUALS } from '../components/toolVisuals';
import { cn } from '../lib/cn';
import { useLanguage, useTx } from '../lib/i18n';
import { navigate } from '../lib/navigation';
import { stashPendingFiles } from '../lib/pendingFiles';
import { TOOLS, toolHref, type ToolId } from '../lib/tools';
import { btnClasses } from './ui/button-classes';

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The hero's action card: choose or drop a PDF, then pick what to do with it.
 * The file is handed to the tool in memory (no upload) through a client-side route change.
 */
export function HeroPicker() {
  const { lang, isHindi } = useLanguage();
  const tx = useTx();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragTarget, setDragTarget] = useState<ToolId | 'zone' | null>(null);
  const [rejected, setRejected] = useState(false);

  const pdfsFrom = (list: FileList | null): File[] => {
    const pdfs = Array.from(list ?? []).filter(isPdf);
    setRejected(Boolean(list?.length) && pdfs.length === 0);
    return pdfs;
  };

  const openIn = (toolId: ToolId, picked: File[]) => {
    stashPendingFiles(picked);
    navigate({ lang, toolId });
  };

  const dragProps = (target: ToolId | 'zone') => ({
    onDragEnter: (e: DragEvent) => {
      e.preventDefault();
      setDragTarget(target);
    },
    onDragOver: (e: DragEvent) => e.preventDefault(),
    onDragLeave: (e: DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragTarget(null);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragTarget(null);
      const pdfs = pdfsFrom(e.dataTransfer.files);
      if (pdfs.length === 0) return;
      // Dropping straight onto a task goes there; dropping on the card asks which task.
      if (target === 'zone') setFiles(pdfs);
      else openIn(target, pdfs);
    },
  });

  const first = files[0];

  return (
    <div
      {...dragProps('zone')}
      className={cn(
        'rounded-3xl border bg-white p-4 shadow-[0_8px_24px_rgba(20,22,31,0.06)] transition-colors sm:p-6',
        dragTarget === 'zone' ? 'border-brand bg-brand-wash' : 'border-line',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const pdfs = pdfsFrom(e.target.files);
          if (pdfs.length > 0) setFiles(pdfs);
          e.target.value = '';
        }}
      />

      {first ? (
        <div className="flex items-center gap-3 rounded-2xl bg-brand-wash p-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white text-brand">
            <FileText className="size-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[15px] font-semibold text-ink">
              {files.length > 1 ? tx(`${files.length} PDFs selected`, `${files.length} पीडीएफ चुनी गईं`) : first.name}
            </p>
            <p className="text-[13px] text-muted">
              {formatSize(files.reduce((sum, f) => sum + f.size, 0))} · {tx('stays on this device', 'इसी डिवाइस पर रहती है')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFiles([])}
            aria-label={tx('Remove file', 'फाइल हटाएं')}
            className="grid size-10 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-white hover:text-ink"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
      ) : (
        <div
          className={cn(
            'flex flex-col items-center rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors sm:py-8',
            dragTarget === 'zone' ? 'border-brand' : 'border-line',
          )}
        >
          <span className="grid size-12 place-items-center rounded-xl bg-cat-edit-tint text-cat-edit">
            <UploadCloud className="size-6" aria-hidden />
          </span>
          <p className="mt-3 font-display text-[18px] font-bold text-ink">
            <span className="hidden sm:inline">{tx('Drop a PDF here', 'पीडीएफ यहाँ छोड़ें')}</span>
            <span className="sm:hidden">{tx('Start with your PDF', 'अपनी पीडीएफ से शुरू करें')}</span>
          </p>
          <p className="mt-1 text-[14px] text-muted">
            {tx('Then choose what to do with it.', 'फिर चुनें कि उसके साथ क्या करना है।')}
          </p>
          <button type="button" onClick={() => inputRef.current?.click()} className={cn(btnClasses('primary', 'md'), 'mt-4')}>
            <UploadCloud className="size-5" aria-hidden />
            {tx('Choose a PDF', 'पीडीएफ चुनें')}
          </button>
          {rejected && (
            <p role="alert" className="mt-3 text-[13px] font-medium text-[#EF6C4D]">
              {tx('That file isn’t a PDF. Choose a .pdf file.', 'यह पीडीएफ फाइल नहीं है। कोई .pdf फाइल चुनें।')}
            </p>
          )}
        </div>
      )}

      <p className="mt-4 px-1 text-[12px] font-semibold uppercase tracking-wider text-faint">
        {first ? tx('What do you want to do?', 'क्या करना है?') : tx('Or start with a task', 'या कोई टूल चुनें')}
      </p>
      <ul className="mt-2 grid gap-1">
        {TOOLS.map((tool) => {
          const v = TOOL_VISUALS[tool.id];
          const Icon = v.icon;
          const rowClass = cn(
            'group flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-brand-wash',
            dragTarget === tool.id && 'bg-brand-wash ring-2 ring-brand',
          );
          const body = (
            <>
              <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl', v.chip)}>
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[15px] font-semibold text-ink">
                  {isHindi ? v.nameHi : v.nameEn}
                </span>
                <span className="block truncate text-[13px] text-muted">{isHindi ? v.taglineHi : v.taglineEn}</span>
              </span>
              {first ? (
                <ArrowRight className="size-5 shrink-0 text-brand transition-transform group-hover:translate-x-0.5" aria-hidden />
              ) : (
                <ChevronRight className="size-4 shrink-0 text-faint" aria-hidden />
              )}
            </>
          );
          return (
            <li key={tool.id} {...dragProps(tool.id)}>
              {first ? (
                <button type="button" className={rowClass} onClick={() => openIn(tool.id, files)}>
                  {body}
                </button>
              ) : (
                <a href={toolHref(tool.id, lang)} className={rowClass}>
                  {body}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
