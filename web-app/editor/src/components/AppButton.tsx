import type { ButtonHTMLAttributes, ReactNode } from 'react';

import './AppButton.css';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  title: string;
  variant?: Variant;
  small?: boolean;
};

export function AppButton({
  title,
  variant = 'primary',
  small,
  className = '',
  ...rest
}: Props) {
  return (
    <button
      type="button"
      className={`app-button app-button--${variant} ${small ? 'app-button--small' : ''} ${className}`.trim()}
      {...rest}
    >
      {title}
    </button>
  );
}

export function AppLink({
  href,
  children,
  className = '',
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a className={`app-link ${className}`.trim()} href={href}>
      {children}
    </a>
  );
}
