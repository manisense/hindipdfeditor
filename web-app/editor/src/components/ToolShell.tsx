import {
  Combine,
  FileArchive,
  Grid2X2,
  Languages,
  Pencil,
  Scissors,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { TOOLS, toolHref, type ToolId, type ToolMeta } from '../lib/tools';
import './ToolShell.css';

type Step = { label: string; active?: boolean; done?: boolean };

type Props = {
  tool?: ToolMeta | null;
  steps?: Step[];
  actions?: ReactNode;
  compact?: boolean;
  children: ReactNode;
};

const toolIcons: Record<ToolId, LucideIcon> = {
  edit: Pencil,
  translate: Languages,
  merge: Combine,
  split: Scissors,
  compress: FileArchive,
};

export function ToolShell({ tool, steps, actions, compact = false, children }: Props) {
  const ActiveIcon = tool ? toolIcons[tool.id] : Grid2X2;

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

      <div className="tool-shell__nav-wrap">
        <header className="tool-shell__header">
          <a href="/edit/" className="tool-shell__logo-link">
            <img
              className="tool-shell__logo"
              src="/assets/app-icon.png"
              alt="Hindi PDF Editor logo"
              width={32}
              height={32}
            />
            <span className="tool-shell__wordmark">
              Hindi PDF <strong>Editor</strong>
            </span>
          </a>
          {tool && (
            <div className="tool-shell__current-tool" aria-label={`Current tool: ${tool.shortTitle}`}>
              <ActiveIcon size={15} strokeWidth={2.2} aria-hidden="true" />
              <span>{tool.shortTitle}</span>
            </div>
          )}
          <div className="tool-shell__actions">
            <a className="tool-shell__all-tools" href="/edit/#features">
              <Grid2X2 size={16} strokeWidth={2.2} aria-hidden="true" />
              <span>All tools</span>
            </a>
            {actions}
          </div>
        </header>
      </div>

      <main className="tool-shell__main">
        {tool && (
          <nav className="tool-shell__tool-switcher" aria-label="PDF tools">
            {TOOLS.map((item) => {
              const Icon = toolIcons[item.id];
              return (
                <a
                  key={item.id}
                  href={toolHref(item.id)}
                  className={item.id === tool.id ? 'is-active' : ''}
                  aria-current={item.id === tool.id ? 'page' : undefined}
                >
                  <Icon size={16} strokeWidth={2.1} aria-hidden="true" />
                  <span>{item.shortTitle}</span>
                </a>
              );
            })}
          </nav>
        )}

        {steps && steps.length > 0 && (
          <ol className="tool-shell__steps" aria-label="Progress">
            {steps.map((step, index) => (
              <li
                key={step.label}
                className={`tool-shell__step ${step.active ? 'is-active' : ''} ${step.done ? 'is-done' : ''}`}
                aria-current={step.active ? 'step' : undefined}
              >
                <span className="tool-shell__step-num">{step.done ? '✓' : index + 1}</span>
                <span>{step.label}</span>
              </li>
            ))}
          </ol>
        )}

        <div className="tool-shell__body">{children}</div>
      </main>

      <footer className="tool-shell__footer">
        <div>
          <span>© 2026 Hindi PDF Editor</span>
          <span className="tool-shell__footer-dot" aria-hidden="true">·</span>
          <span>Made for Devanagari · हिंदी</span>
        </div>
        <nav aria-label="Legal and support">
          <a href="/privacy/">Privacy</a>
          <a href="/support/">Support</a>
          <a href="/terms/">Terms</a>
        </nav>
      </footer>
    </div>
  );
}
