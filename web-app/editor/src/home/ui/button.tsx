import { ArrowRight } from 'lucide-react';

import { cn } from '../../lib/cn';
import { buttonBase as base, buttonSizes as sizes, buttonVariants as variants } from './button-classes';

export function Btn({
  children,
  variant = 'primary',
  size = 'md',
  className,
  href = '#',
  arrow = false,
  ...props
}: {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  className?: string;
  href?: string;
  /** Trailing arrow icon for forward-moving calls to action. */
  arrow?: boolean;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a href={href} className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
      {arrow && (
        <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
      )}
    </a>
  );
}
