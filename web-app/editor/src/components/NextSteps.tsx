import { ArrowRight } from 'lucide-react';

import { useLanguage, useTx } from '../lib/i18n';
import { navigate } from '../lib/navigation';
import { stashPendingFiles } from '../lib/pendingFiles';
import { TOOLS, toolHref, type ToolId } from '../lib/tools';
import { TOOL_VISUALS } from './toolVisuals';
import './NextSteps.css';

type Props = {
  /** Tool that just produced the file; it is left out of the suggestions. */
  current: ToolId;
  /** The exported PDF, handed to the next tool in memory. Null falls back to plain links. */
  output: File | null;
};

/** Shown after a successful export so the file can go straight into another tool. */
export function NextSteps({ current, output }: Props) {
  const { lang, isHindi } = useLanguage();
  const tx = useTx();

  return (
    <nav className="next-steps" aria-label={tx('Next steps', 'आगे क्या करें')}>
      <p className="next-steps__label">
        {output ? tx('Keep going with this PDF', 'इसी पीडीएफ के साथ आगे बढ़ें') : tx('Try another tool', 'दूसरा टूल आज़माएं')}
      </p>
      <ul>
        {TOOLS.filter((tool) => tool.id !== current).map((tool) => {
          const { icon: Icon, chip, nameEn, nameHi } = TOOL_VISUALS[tool.id];
          const content = (
            <>
              <span className={`next-steps__chip ${chip}`}>
                <Icon size={18} aria-hidden="true" />
              </span>
              <span className="next-steps__name">{isHindi ? nameHi : nameEn}</span>
              <ArrowRight size={16} aria-hidden="true" className="next-steps__arrow" />
            </>
          );
          return (
            <li key={tool.id}>
              {output ? (
                <button
                  type="button"
                  onClick={() => {
                    stashPendingFiles([output]);
                    navigate({ lang, toolId: tool.id });
                  }}
                >
                  {content}
                </button>
              ) : (
                <a href={toolHref(tool.id, lang)}>{content}</a>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
