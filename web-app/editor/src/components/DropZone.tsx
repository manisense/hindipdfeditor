import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { FileType2, Files, ShieldCheck, UploadCloud } from 'lucide-react';

import { useTx } from '../lib/i18n';
import { AppButton } from './AppButton';
import './DropZone.css';

type Props = {
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  title: string;
  subtitle?: string;
  buttonLabel?: string;
  accent?: string;
  onFiles: (files: File[]) => void;
  children?: ReactNode;
  compact?: boolean;
};

function isPdf(file: File): boolean {
  return (
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  );
}

export function DropZone({
  accept = 'application/pdf',
  multiple = false,
  disabled,
  title,
  subtitle,
  buttonLabel,
  accent = '#1843dd',
  onFiles,
  children,
  compact = false,
}: Props) {
  const tx = useTx();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const emit = (list: FileList | File[]) => {
    const files = Array.from(list).filter(isPdf);
    if (files.length === 0) return;
    onFiles(multiple ? files : files.slice(0, 1));
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    emit(event.dataTransfer.files);
  };

  return (
    <div
      className={`drop-zone ${compact ? 'drop-zone--compact' : ''} ${dragging ? 'drop-zone--active' : ''} ${disabled ? 'drop-zone--disabled' : ''}`}
      style={{ ['--drop-accent' as string]: accent }}
      onDragEnter={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="drop-zone__input"
        disabled={disabled}
        onChange={(e) => {
          if (e.target.files) emit(e.target.files);
          e.target.value = '';
        }}
      />
      <div className="drop-zone__icon" aria-hidden="true">
        {multiple ? <Files size={30} strokeWidth={1.9} /> : <UploadCloud size={30} strokeWidth={1.9} />}
      </div>
      <div className="drop-zone__copy">
        <span className="drop-zone__eyebrow">{tx('Ready when you are', 'तैयार हैं')}</span>
        <h2 className="drop-zone__title">{title}</h2>
        {subtitle && <p className="drop-zone__subtitle">{subtitle}</p>}
      </div>
      <AppButton
        title={buttonLabel ?? tx('Select PDF files', 'पीडीएफ फाइलें चुनें')}
        icon={<UploadCloud size={17} aria-hidden="true" />}
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
      />
      <p className="drop-zone__hint">{tx(`or drop PDF${multiple ? 's' : ''} here`, 'या पीडीएफ यहाँ छोड़ें')}</p>
      <div className="drop-zone__assurances" aria-label={tx('File handling details', 'फाइल की जानकारी')}>
        <span>
          <ShieldCheck size={14} aria-hidden="true" /> {tx('Private by default', 'डिफ़ॉल्ट रूप से प्राइवेट')}
        </span>
        <span>
          <FileType2 size={14} aria-hidden="true" /> {tx('PDF files only', 'सिर्फ पीडीएफ फाइलें')}
        </span>
      </div>
      {children}
    </div>
  );
}
