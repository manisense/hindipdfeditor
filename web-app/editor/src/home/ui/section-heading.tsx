import { cn } from '../../lib/cn';

/** Eyebrow + H2 + optional subtitle, the one heading pattern used by every home section. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  subtitle,
  align = 'center',
  className,
}: {
  id: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  align?: 'center' | 'left';
  className?: string;
}) {
  return (
    <div className={cn(align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl', className)}>
      <p className="font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-brand">{eyebrow}</p>
      <h2 id={id} className="mt-3 font-display text-[clamp(28px,3.4vw,40px)] font-bold leading-tight text-ink">
        {title}
      </h2>
      {subtitle && <p className="mt-4 text-[17px] leading-relaxed text-muted">{subtitle}</p>}
    </div>
  );
}
