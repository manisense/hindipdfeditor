import { useTx } from "../lib/i18n";
import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { FileType2, Files, ShieldCheck, UploadCloud } from "lucide-react";

import { AppButton } from "./AppButton";
import "./DropZone.css";

type Props = {
  /** Files the zone takes: PDFs (default) or Word documents (.docx). */
  kind?: "pdf" | "docx";
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
  /** Offer the bundled Hindi sample PDF so a visitor can try the tool without a file. */
  sample?: boolean;
};

const SAMPLE_URL = "/assets/samples/devanagari-fixture.pdf";

const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function isPdf(file: File): boolean {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

function isDocx(file: File): boolean {
  return file.type === DOCX_TYPE || file.name.toLowerCase().endsWith(".docx");
}

export function DropZone({
  kind = "pdf",
  accept,
  multiple = false,
  disabled,
  title,
  subtitle,
  buttonLabel = "Select PDF files",
  accent = "#1843dd",
  onFiles,
  children,
  compact = false,
  sample = false,
}: Props) {
  const tx = useTx();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const [loadingSample, setLoadingSample] = useState(false);

  const openSample = async () => {
    setLoadingSample(true);
    setValidationMessage(null);
    try {
      const response = await fetch(SAMPLE_URL);
      if (!response.ok) throw new Error(`Sample PDF: HTTP ${response.status}`);
      const blob = await response.blob();
      onFiles([new File([blob], "hindi-sample.pdf", { type: "application/pdf" })]);
    } catch (error) {
      console.error(error);
      setValidationMessage(tx("The sample PDF could not load. Check your connection and try again.", "नमूना पीडीएफ लोड नहीं हुई। इंटरनेट देखें और फिर कोशिश करें।"));
    } finally {
      setLoadingSample(false);
    }
  };

  const word = kind === "docx";
  const accepted = word ? isDocx : isPdf;
  const fileType = word ? tx("Word file (.docx)", "वर्ड फाइल (.docx)") : tx("PDF file (.pdf)", "पीडीएफ फाइल (.pdf)");
  const emit = (list: FileList | File[]) => {
    if (disabled) return;
    const selected = Array.from(list);
    const files = selected.filter(accepted);
    if (files.length === 0) {
      setValidationMessage(tx(`Choose a ${fileType}. No file was opened.`, `${fileType} चुनें। कोई फाइल नहीं खुली।`));
      return;
    }
    if (files.length !== selected.length) {
      setValidationMessage(
        tx(
          `Choose ${word ? "Word files" : "PDF files"} only. No files were opened; remove unsupported files and try again.`,
          `सिर्फ ${word ? "वर्ड" : "पीडीएफ"} फाइलें चुनें। कोई फाइल नहीं खुली; दूसरी फाइलें हटाकर फिर कोशिश करें।`,
        ),
      );
      return;
    }
    if (!multiple && files.length > 1) {
      setValidationMessage(tx("Choose one file at a time. No file was opened.", "एक बार में एक फाइल चुनें। कोई फाइल नहीं खुली।"));
      return;
    }
    setValidationMessage(null);
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
      className={`drop-zone ${compact ? "drop-zone--compact" : ""} ${dragging ? "drop-zone--active" : ""} ${disabled ? "drop-zone--disabled" : ""}`}
      style={{ ["--drop-accent" as string]: accent }}
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
        accept={accept ?? (word ? `.docx,${DOCX_TYPE}` : "application/pdf")}
        multiple={multiple}
        className="drop-zone__input"
        disabled={disabled}
        onChange={(e) => {
          if (e.target.files) emit(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="drop-zone__icon" aria-hidden="true">
        {multiple ? (
          <Files size={30} strokeWidth={1.9} />
        ) : (
          <UploadCloud size={30} strokeWidth={1.9} />
        )}
      </div>
      <div className="drop-zone__copy">
        {compact ? (
          <h2 className="drop-zone__title">{title}</h2>
        ) : (
          <h1 className="drop-zone__title">{title}</h1>
        )}
        {subtitle && <p className="drop-zone__subtitle">{subtitle}</p>}
      </div>
      <AppButton
        title={buttonLabel ?? tx("Select PDF files", "पीडीएफ फाइलें चुनें")}
        icon={<UploadCloud size={17} aria-hidden="true" />}
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
      />
      <p className="drop-zone__hint">
        {word
          ? tx("or drop a Word file here", "या वर्ड फाइल यहाँ छोड़ें")
          : multiple
            ? tx("or drop PDFs here", "या पीडीएफ यहाँ छोड़ें")
            : tx("or drop PDF here", "या पीडीएफ यहाँ छोड़ें")}
      </p>
      {sample && !compact && (
        <button
          type="button"
          className="drop-zone__sample"
          disabled={disabled || loadingSample}
          onClick={() => void openSample()}
        >
          {loadingSample
            ? tx("Opening sample…", "नमूना खुल रहा है…")
            : tx("No PDF handy? Try a Hindi sample", "पीडीएफ नहीं है? हिंदी नमूना आज़माएं")}
        </button>
      )}
      {validationMessage && (
        <p className="drop-zone__validation" role="alert">
          {validationMessage}
        </p>
      )}
      <div className="drop-zone__assurances" aria-label={tx("File handling details", "फाइल की जानकारी")}>
        <span>
          <ShieldCheck size={14} aria-hidden="true" />{" "}
          {tx("Private by default", "डिफ़ॉल्ट रूप से प्राइवेट")}
        </span>
        <span>
          <FileType2 size={14} aria-hidden="true" />{" "}
          {word ? tx("Word .docx files only", "सिर्फ वर्ड .docx फाइलें") : tx("PDF files only", "सिर्फ पीडीएफ फाइलें")}
        </span>
      </div>
      {children}
    </div>
  );
}
