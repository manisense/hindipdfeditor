import {
  Combine,
  FileArchive,
  Globe,
  Grid2X2,
  Languages,
  Pencil,
  Scissors,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { useLanguage } from '../lib/i18n';
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

const toolHindiNames: Record<ToolId, string> = {
  edit: 'हिंदी एडिट',
  translate: 'अनुवाद',
  merge: 'मर्ज (जोड़ें)',
  split: 'स्प्लिट (अलग करें)',
  compress: 'कंप्रेस करें',
};

export function ToolShell({ tool, steps, actions, compact = false, children }: Props) {
  const { lang, setLang, isHindi } = useLanguage();
  const ActiveIcon = tool ? toolIcons[tool.id] : Grid2X2;

  const toggleLanguage = () => {
    setLang(lang === 'en' ? 'hi' : 'en');
  };

  const toolDisplayTitle = tool
    ? isHindi
      ? toolHindiNames[tool.id] || tool.shortTitle
      : tool.shortTitle
    : '';

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
            <div className="tool-shell__current-tool" aria-label={`Current tool: ${toolDisplayTitle}`}>
              <ActiveIcon size={15} strokeWidth={2.2} aria-hidden="true" />
              <span>{toolDisplayTitle}</span>
            </div>
          )}
          <div className="tool-shell__actions">
            {/* Language Toggle in Tool Header */}
            <button
              type="button"
              onClick={toggleLanguage}
              title={isHindi ? 'Switch to English' : 'हिंदी भाषा में बदलें'}
              aria-label="Switch Language"
              className="tool-shell__lang-btn"
            >
              <Globe size={13} style={{ color: 'var(--brand)' }} />
              <span className="tool-shell__lang-text">{isHindi ? 'English' : 'हिन्दी'}</span>
            </button>

            <a className="tool-shell__all-tools" href="/edit/#features">
              <Grid2X2 size={16} strokeWidth={2.2} aria-hidden="true" />
              <span>{isHindi ? 'सभी टूल्स' : 'All tools'}</span>
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
              const name = isHindi ? toolHindiNames[item.id] || item.shortTitle : item.shortTitle;
              return (
                <a
                  key={item.id}
                  href={toolHref(item.id)}
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
          <span>{isHindi ? '100% सुरक्षित देवनागरी एडिटर' : 'Made for Devanagari · हिंदी'}</span>
        </div>
        <nav aria-label="Legal and support">
          <a href="/privacy/">{isHindi ? 'प्राइवेसी' : 'Privacy'}</a>
          <a href="/support/">{isHindi ? 'सपोर्ट' : 'Support'}</a>
          <a href="/terms/">{isHindi ? 'शर्तें' : 'Terms'}</a>
        </nav>
      </footer>
    </div>
  );
}
