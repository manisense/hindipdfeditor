/**
 * Hover sweep for one or two words: a navy pill fades in behind them while thin
 * beams cross it. Pure CSS (see `.cover` in home.css), so it costs no script.
 */
export function Cover({ children }: { children: React.ReactNode }) {
  return (
    <span className="cover">
      <span aria-hidden="true" className="cover-beam" style={{ top: "24%" }} />
      <span aria-hidden="true" className="cover-beam" style={{ top: "44%" }} />
      <span aria-hidden="true" className="cover-beam" style={{ top: "64%" }} />
      <span aria-hidden="true" className="cover-beam" style={{ top: "82%" }} />
      <span className="relative">{children}</span>
    </span>
  );
}
