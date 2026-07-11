import { useRef, useState, type DragEvent, type ReactNode } from 'react';

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
  buttonLabel = 'Select PDF files',
  accent = '#1843dd',
  onFiles,
  children,
}: Props) {
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
      className={`drop-zone ${dragging ? 'drop-zone--active' : ''} ${disabled ? 'drop-zone--disabled' : ''}`}
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
        <svg viewBox="0 0 48 48" width="48" height="48" fill="none">
          <rect x="8" y="6" width="32" height="36" rx="4" stroke="currentColor" strokeWidth="2.5" />
          <path d="M16 18h16M16 24h16M16 30h10" stroke="currentColor" strokeWidth="2.5" />
        </svg>
      </div>
      <h2 className="drop-zone__title">{title}</h2>
      {subtitle && <p className="drop-zone__subtitle">{subtitle}</p>}
      <AppButton
        title={buttonLabel}
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
      />
      <p className="drop-zone__hint">or drop PDF{multiple ? 's' : ''} here</p>
      {children}
    </div>
  );
}
