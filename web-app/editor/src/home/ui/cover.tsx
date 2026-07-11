import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../../lib/cn';

/**
 * Aceternity-style Cover: on hover a dark pill fades in behind the word, with
 * horizontal beams sweeping across and sparkles popping. Text turns white.
 */
export function Cover({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [hover, setHover] = useState(false);
  const beams = [22, 40, 58, 76];
  const sparkles = [
    { top: '16%', left: '12%', d: 0 },
    { top: '70%', left: '24%', d: 0.15 },
    { top: '30%', left: '58%', d: 0.3 },
    { top: '78%', left: '80%', d: 0.1 },
    { top: '20%', left: '86%', d: 0.25 },
  ];

  return (
    <span
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn('relative inline-block rounded-xl px-3 py-0.5 transition-colors', className)}
    >
      <AnimatePresence>
        {hover && (
          <motion.span
            aria-hidden
            className="absolute inset-0 -z-0 rounded-xl bg-navy"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </AnimatePresence>

      <span aria-hidden className="absolute inset-0 overflow-hidden rounded-xl">
        {beams.map((top, i) => (
          <motion.span
            key={i}
            className="absolute left-0 h-px w-full"
            style={{
              top: `${top}%`,
              background: 'linear-gradient(90deg, transparent, #3a5cf0, #12a551, transparent)',
            }}
            initial={{ x: '-100%', opacity: 0 }}
            animate={hover ? { x: '100%', opacity: 1 } : { x: '-100%', opacity: 0 }}
            transition={{
              duration: 0.9,
              delay: i * 0.06,
              ease: 'easeInOut',
              repeat: hover ? Infinity : 0,
            }}
          />
        ))}
      </span>

      <span aria-hidden className="absolute inset-0 overflow-visible">
        {sparkles.map((s, i) => (
          <motion.span
            key={i}
            className="absolute size-1 rounded-full bg-white"
            style={{ top: s.top, left: s.left }}
            initial={{ opacity: 0, scale: 0 }}
            animate={hover ? { opacity: [0, 1, 0], scale: [0, 1.3, 0] } : { opacity: 0, scale: 0 }}
            transition={{ duration: 0.9, delay: s.d, repeat: hover ? Infinity : 0 }}
          />
        ))}
      </span>

      <span
        className={cn(
          'relative z-10 transition-colors duration-200',
          hover ? 'text-white' : 'text-brand',
        )}
      >
        {children}
      </span>
    </span>
  );
}
