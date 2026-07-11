import { cn } from '../../lib/cn';

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-display font-semibold transition-all active:translate-y-px whitespace-nowrap';

const variants = {
  primary: 'bg-brand text-white shadow-[var(--shadow-brand)] hover:bg-brand-hover',
  subtle: 'bg-[#eceef2] text-ink hover:bg-[#e2e5ea]',
  ghost:
    'bg-white text-ink border border-line shadow-[0_2px_8px_rgba(21,23,44,0.05)] hover:-translate-y-0.5 hover:border-[#d9d7cd]',
  green: 'bg-accent text-white hover:bg-accent-500',
  dark: 'bg-navy text-white hover:bg-navy-800',
};

const sizes = {
  md: 'text-[15px] px-6 py-3',
  lg: 'text-[16px] px-7 py-4',
};

export function Btn({
  children,
  variant = 'primary',
  size = 'md',
  className,
  href = '#',
  ...props
}: {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  className?: string;
  href?: string;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a href={href} className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </a>
  );
}
