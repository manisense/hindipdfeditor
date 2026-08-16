import { CircleCheck, CircleX, Info, LoaderCircle, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import './AppStatus.css';

type AppStatusTone = 'info' | 'success' | 'warning' | 'error';

type Props = {
  tone?: AppStatusTone;
  title?: string;
  busy?: boolean;
  children: ReactNode;
  className?: string;
};

const toneIcons = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleX,
} as const;

/** Shared branded feedback banner for progress, success, warning, and error states. */
export function AppStatus({
  tone = 'info',
  title,
  busy = false,
  children,
  className = '',
}: Props) {
  const Icon = busy ? LoaderCircle : toneIcons[tone];
  return (
    <div
      className={`app-status app-status--${tone} ${busy ? 'app-status--busy' : ''} ${className}`.trim()}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
    >
      <span className="app-status__icon" aria-hidden="true">
        <Icon size={20} strokeWidth={2.2} />
      </span>
      <div className="app-status__copy">
        {title && <strong>{title}</strong>}
        <div>{children}</div>
      </div>
    </div>
  );
}
