import { useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { cn } from '../../lib/cn';

/**
 * Aceternity-style PointerHighlight: draws an animated rectangle around the
 * children and slides in a pointer cursor when the element enters view.
 */
export function PointerHighlight({
  children,
  className,
  rectClassName,
  pointerClassName,
}: {
  children: React.ReactNode;
  className?: string;
  rectClassName?: string;
  pointerClassName?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: false, amount: 0.6 });

  return (
    <span ref={ref} className={cn('relative inline-block', className)}>
      <span className="relative z-10">{children}</span>

      <motion.span
        aria-hidden
        className={cn(
          'pointer-events-none absolute -inset-x-1.5 -inset-y-1 rounded-md border-2 border-brand',
          rectClassName,
        )}
        initial={{ opacity: 0, scaleX: 0 }}
        animate={inView ? { opacity: 1, scaleX: 1 } : { opacity: 0, scaleX: 0 }}
        style={{ originX: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      />

      <motion.span
        aria-hidden
        className={cn('pointer-events-none absolute -bottom-4 -right-3 z-20', pointerClassName)}
        initial={{ opacity: 0, x: -8, y: -8 }}
        animate={inView ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, x: -8, y: -8 }}
        transition={{ duration: 0.5, delay: 0.55, ease: 'easeOut' }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="text-brand drop-shadow"
        >
          <path d="M3 2l7.5 18 2.7-7.8L21 9.5 3 2z" />
        </svg>
      </motion.span>
    </span>
  );
}
