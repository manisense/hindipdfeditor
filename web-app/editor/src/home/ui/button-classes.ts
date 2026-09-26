import { cn } from '../../lib/cn';

export const buttonBase =
  'group inline-flex items-center justify-center gap-2 rounded-full font-display font-semibold transition-all active:translate-y-px whitespace-nowrap';

export const buttonVariants = {
  primary:
    'bg-linear-to-r from-brand to-brand-deep !text-white shadow-[var(--shadow-brand)] hover:-translate-y-0.5 hover:brightness-110 hover:!text-white',
  ghost:
    'bg-white !text-ink border border-line shadow-[0_2px_8px_rgba(20,22,31,0.05)] hover:-translate-y-0.5 hover:border-brand/30 hover:!text-ink',
};

export const buttonSizes = {
  md: 'h-12 text-[15px] px-6',
  lg: 'h-14 text-[16px] px-8',
};

/** Class list for a button-styled element that isn't a link (e.g. a file-picker button). */
export function btnClasses(
  variant: keyof typeof buttonVariants = 'primary',
  size: keyof typeof buttonSizes = 'md',
): string {
  return cn(buttonBase, buttonVariants[variant], buttonSizes[size]);
}
