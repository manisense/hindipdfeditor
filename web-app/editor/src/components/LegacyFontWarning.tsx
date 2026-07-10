import './LegacyFontWarning.css';

type Props = {
  fontNames: string[];
};

export function LegacyFontWarning({ fontNames }: Props) {
  const isUnknown = fontNames.length === 0;

  return (
    <div className="legacy-font-warning">
      <p className="legacy-font-warning__title">
        {isUnknown
          ? '⚠ Font encoding could not be verified — editing disabled on this page'
          : `⚠ Legacy font detected (${fontNames.join(', ')}) — editing disabled on this page`}
      </p>
      <p className="legacy-font-warning__body">
        {isUnknown
          ? "This page's font could not be inspected, so it can't be confirmed safe to edit. " +
            'An unverifiable page is treated the same as a known legacy font rather than assumed safe.'
          : "This page's text was set in a pre-Unicode Devanagari font. Masking or adding text here " +
            'would build on top of a mismatched text layer, so editing is disabled on this page.'}
      </p>
    </div>
  );
}
