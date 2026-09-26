import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

import { Footer } from '../home/Footer';
import { useLanguage } from '../lib/i18n';
import { TOOLS, toolHref, type ToolMeta } from '../lib/tools';
import { SiteHeader } from './SiteHeader';
import { ToolGuide, ToolIntro } from './ToolGuide';
import { TOOL_VISUALS } from './toolVisuals';
import './ToolShell.css';

type Step = { label: string; active?: boolean; done?: boolean };

type Props = {
  tool?: ToolMeta | null;
  steps?: Step[];
  actions?: ReactNode;
  compact?: boolean;
  children: ReactNode;
};

export function ToolShell({ tool, steps, actions, compact = false, children }: Props) {
  const { lang, isHindi } = useLanguage();

  return (
    <div
      className={`tool-shell ${tool ? `tool-shell--${tool.id}` : ''} ${compact ? 'tool-shell--compact' : ''}`.trim()}
      style={tool ? { ['--tool-accent' as string]: tool.accent } : undefined}
    >
      <div className="tool-shell__ambient" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <SiteHeader activeToolId={tool?.id ?? null} />

      <main className="tool-shell__main">
        {tool && (
          <nav className="tool-shell__tool-switcher" aria-label="PDF tools">
            {TOOLS.map((item) => {
              const visual = TOOL_VISUALS[item.id];
              const Icon = visual.icon;
              const name = isHindi ? visual.nameHi : item.shortTitle;
              return (
                <a
                  key={item.id}
                  href={toolHref(item.id, lang)}
                  className={item.id === tool.id ? 'is-active' : ''}
                  aria-current={item.id === tool.id ? 'page' : undefined}
                >
                  <Icon size={16} strokeWidth={2.1} aria-hidden="true" />
                  <span>{name}</span>
                </a>
              );
            })}
          </nav>
        )}

        {tool && <ToolIntro toolId={tool.id} />}

        {((steps && steps.length > 0) || actions) && (
          <div className="tool-shell__bar">
            {steps && steps.length > 0 && (
              <ol className="tool-shell__steps" aria-label="Progress">
                {steps.map((step, index) => (
                  <li
                    key={step.label}
                    className={`tool-shell__step ${step.active ? 'is-active' : ''} ${step.done ? 'is-done' : ''}`}
                    aria-current={step.active ? 'step' : undefined}
                  >
                    <span className="tool-shell__step-num">
                      {step.done ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : index + 1}
                    </span>
                    <span>{step.label}</span>
                  </li>
                ))}
              </ol>
            )}
            {actions && <div className="tool-shell__actions">{actions}</div>}
          </div>
        )}

        <div className="tool-shell__body">{children}</div>

        {tool && <ToolGuide toolId={tool.id} />}
      </main>

      <Footer />
    </div>
  );
}
