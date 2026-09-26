import { ArrowRight } from 'lucide-react';

import { cn } from '../../lib/cn';

const base =
  'group inline-flex items-center justify-center gap-2 rounded-full font-display font-semibold transition-all active:translate-y-px whitespace-nowrap';

const variants = {
  primary:
    'bg-linear-to-r from-brand to-brand-deep !text-white shadow-[var(--shadow-brand)] hover:-translate-y-0.5 hover:brightness-110 hover:!text-white',
  ghost:
    'bg-white !text-ink border border-line shadow-[0_2px_8px_rgba(20,22,31,0.05)] hover:-translate-y-0.5 hover:border-brand/30 hover:!text-ink',
};

const sizes = {
  md: 'h-12 text-[15px] px-6',
  lg: 'h-14 text-[16px] px-8',
};

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
