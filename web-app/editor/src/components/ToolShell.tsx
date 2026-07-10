import type { ReactNode } from 'react';

import { AppLink } from './AppButton';
import type { ToolMeta } from '../lib/tools';
import './ToolShell.css';

type Step = { label: string; active?: boolean; done?: boolean };

type Props = {
  tool?: ToolMeta | null;
  steps?: Step[];
  actions?: ReactNode;
  children: ReactNode;
};

export function ToolShell({ tool, steps, actions, children }: Props) {
  return (
    <div className="tool-shell">
      <header className="tool-shell__header">
        <div className="tool-shell__brand">
          <AppLink href="/">Hindi PDF Editor</AppLink>
          {tool && (
            <>
              <span className="tool-shell__sep" aria-hidden="true">
                /
              </span>
              <AppLink href="/edit/">{tool.shortTitle}</AppLink>
            </>
          )}
        </div>
        <div className="tool-shell__actions">
          <AppLink href="/edit/">All tools</AppLink>
          {actions}
        </div>
      </header>

      {tool && (
        <div className="tool-shell__intro">
          <h1 style={{ ['--tool-accent' as string]: tool.accent }}>{tool.title}</h1>
          <p>{tool.description}</p>
        </div>
      )}

      {steps && steps.length > 0 && (
        <ol className="tool-shell__steps" aria-label="Progress">
          {steps.map((step, index) => (
            <li
              key={step.label}
              className={`tool-shell__step ${step.active ? 'is-active' : ''} ${step.done ? 'is-done' : ''}`}
            >
              <span className="tool-shell__step-num">{index + 1}</span>
              <span>{step.label}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="tool-shell__body">{children}</div>
    </div>
  );
}
