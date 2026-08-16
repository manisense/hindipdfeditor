import type { ButtonHTMLAttributes, ReactNode } from 'react';

import './AppButton.css';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  title: string;
  variant?: Variant;
  small?: boolean;
  icon?: ReactNode;
  iconAfter?: boolean;
};

export function AppButton({
  title,
  variant = 'primary',
  small,
  icon,
  iconAfter,
  className = '',
  ...rest
}: Props) {
  return (
    <button
      type="button"
      className={`app-button app-button--${variant} ${small ? 'app-button--small' : ''} ${className}`.trim()}
      {...rest}
    >
      {icon && !iconAfter && <span className="app-button__icon">{icon}</span>}
      <span>{title}</span>
      {icon && iconAfter && <span className="app-button__icon">{icon}</span>}
    </button>
  );
}
