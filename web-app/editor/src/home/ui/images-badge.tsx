import { motion } from 'motion/react';
import { cn } from '../../lib/cn';

/**
 * Aceternity-style "images badge": a cluster of overlapping circular thumbnails
 * with a rating + label. Here the thumbnails are mini Hindi doc chips.
 */
const docs = [
  { g: 'अ', bg: 'bg-brand-tint', fg: 'text-brand' },
  { g: 'हिं', bg: 'bg-accent-tint', fg: 'text-accent' },
  { g: 'क', bg: 'bg-pop-yellow-tint', fg: 'text-[#B58400]' },
  { g: 'फ़', bg: 'bg-pop-lav', fg: 'text-[#5B4BD6]' },
  { g: 'PDF', bg: 'bg-navy', fg: 'text-white' },
];

export function ImagesBadge({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3.5', className)}>
      <div className="flex -space-x-3">
        {docs.map((d, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.1 * i, type: 'spring', stiffness: 260, damping: 20 }}
            whileHover={{ y: -4, zIndex: 20 }}
            className={cn(
              'grid size-10 place-items-center rounded-full ring-[3px] ring-white font-display font-bold shadow-sm',
              d.bg,
              d.fg,
              d.g.length > 2 ? 'text-[11px]' : 'text-[15px]',
            )}
          >
            {d.g}
          </motion.div>
        ))}
      </div>
      <div className="leading-tight">
        <div className="flex text-pop-yellow text-sm" aria-hidden>
          {'★★★★★'}
        </div>
        <span className="text-[13.5px] text-muted">{label}</span>
      </div>
    </div>
  );
}
