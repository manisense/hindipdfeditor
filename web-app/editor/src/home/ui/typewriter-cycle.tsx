import { useEffect, useState } from 'react';
import { cn } from '../../lib/cn';

type Phrase = { text: string; className?: string };

export function TypewriterCycle({
  phrases,
  className,
  caretClassName,
  typingSpeed = 65,
  deletingSpeed = 32,
  pause = 1500,
}: {
  phrases: Phrase[];
  className?: string;
  caretClassName?: string;
  typingSpeed?: number;
  deletingSpeed?: number;
  pause?: number;
}) {
  const [index, setIndex] = useState(0);
  const [sub, setSub] = useState('');
  const [deleting, setDeleting] = useState(false);

  const current = phrases[index % phrases.length];

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (!deleting && sub === current.text) {
      t = setTimeout(() => setDeleting(true), pause);
    } else if (deleting && sub === '') {
      setDeleting(false);
      setIndex((i) => (i + 1) % phrases.length);
    } else {
      t = setTimeout(
        () =>
          setSub(
            deleting
              ? current.text.slice(0, sub.length - 1)
              : current.text.slice(0, sub.length + 1),
          ),
        deleting ? deletingSpeed : typingSpeed,
      );
    }
    return () => clearTimeout(t);
  }, [sub, deleting, current, phrases.length, pause, typingSpeed, deletingSpeed]);

  return (
    <span className={cn('inline', current.className, className)} aria-label={current.text}>
      {sub}
      <span className={cn('caret bg-brand align-baseline', caretClassName)} aria-hidden>
        &nbsp;
      </span>
    </span>
  );
}
