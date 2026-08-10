import { ExternalLink, Play } from 'lucide-react';
import { PLAY_STORE_URL } from '../links';
import { Btn } from './button';

export function GooglePlayMark({ className = '' }: { className?: string }) {
  return <Play aria-hidden className={`size-4 fill-current ${className}`.trim()} strokeWidth={2} />;
}

export function GooglePlayLink({
  children = 'Get it on Google Play',
  ...props
}: Omit<React.ComponentProps<typeof Btn>, 'children' | 'href'> & {
  children?: React.ReactNode;
}) {
  return (
    <Btn
      {...props}
      href={PLAY_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Get Hindi PDF Editor on Google Play (opens in a new tab)"
    >
      <GooglePlayMark />
      <span>{children}</span>
      <ExternalLink
        aria-hidden
        className="size-3.5 opacity-55 transition-opacity group-hover:opacity-90"
        strokeWidth={2}
      />
    </Btn>
  );
}
