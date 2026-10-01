import { useTx } from "../lib/i18n";
import { FileText, Files } from "lucide-react";

import "./SelectedFileSummary.css";

type Props = {
  name: string;
  meta?: string;
  label?: string;
  multiple?: boolean;
};

/** Consistent selected-file heading used by the browser PDF tools. */
export function SelectedFileSummary({
  name,
  meta,
  label = "Selected PDF",
  multiple = false,
}: Props) {
  const tx = useTx();
  const Icon = multiple ? Files : FileText;
  return (
    <div className="selected-file-summary">
      <span className="selected-file-summary__icon" aria-hidden="true">
        <Icon size={23} strokeWidth={2} />
      </span>
      <div className="selected-file-summary__copy">
        <span className="selected-file-summary__label">
          {label ?? tx("Selected PDF", "चुनी गई पीडीएफ")}
        </span>
        <h2>{name}</h2>
        {meta && <p>{meta}</p>}
      </div>
    </div>
  );
}
