import { useEffect, useState } from "react";

import { useTx } from "../lib/i18n";
import { pageFromInput } from "../lib/pageJump";
import "./PageJump.css";

type Props = {
  /** Zero-based index of the page shown. */
  current: number;
  count: number;
  onGo: (pageIndex: number) => void;
};

/** "Page [3] of 31": type a page number and press Enter (or leave the box) to go there. */
export function PageJump({ current, count, onGo }: Props) {
  const tx = useTx();
  const [draft, setDraft] = useState(String(current + 1));
  useEffect(() => setDraft(String(current + 1)), [current]);
  const commit = () => {
    const page = pageFromInput(draft, count);
    if (page === null) setDraft(String(current + 1));
    else {
      setDraft(String(page + 1));
      if (page !== current) onGo(page);
    }
  };
  return (
    <label className="page-jump">
      <span>{tx("Page", "पेज")}</span>
      <input
        value={draft}
        inputMode="numeric"
        aria-label={tx(`Page number, 1 to ${count}`, `पेज नंबर, 1 से ${count}`)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
        onFocus={(event) => event.target.select()}
      />
      <span>{tx(`of ${count}`, `/ ${count}`)}</span>
    </label>
  );
}
