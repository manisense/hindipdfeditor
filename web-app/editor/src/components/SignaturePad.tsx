import { useEffect, useRef, useState } from 'react';

import { AppButton } from './AppButton';
import { AppPopup } from './AppPopup';
import { inkBounds } from '../lib/imagePlacement';
import { useTx } from '../lib/i18n';
import './SignaturePad.css';

/** Pen colours: near-black and ballpoint blue. */
const INKS = [
  { color: '#16181f', en: 'Black', hi: 'काला' },
  { color: '#1f3a93', en: 'Blue', hi: 'नीला' },
] as const;
/** Stroke width, in CSS px. */
const STROKE_PX = 2.5;
/** Clear margin kept around the trimmed signature, in canvas px. */
const TRIM_PAD_PX = 8;

export type DrawnSignature = { uri: string; pxWidth: number; pxHeight: number };

type Props = {
  open: boolean;
  onCancel: () => void;
  onAdd: (signature: DrawnSignature) => void;
};

/** Draw-a-signature dialog. Returns a transparent PNG cropped to the ink. */
export function SignaturePad({ open, onCancel, onAdd }: Props) {
  const tx = useTx();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [ink, setInk] = useState<string>(INKS[0].color);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    if (!open) return;
    setEmpty(true);
    const frame = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ratio = window.devicePixelRatio || 1;
      const box = canvas.getBoundingClientRect();
      canvas.width = Math.round(box.width * ratio);
      canvas.height = Math.round(box.height * ratio);
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const box = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) / box.width) * canvas.width,
      y: ((event.clientY - box.top) / box.height) * canvas.height,
    };
  };

  const stroke = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const ratio = canvas.width / Math.max(1, canvas.getBoundingClientRect().width);
    context.strokeStyle = ink;
    context.lineWidth = STROKE_PX * ratio;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  };

  /** Switches the pen colour and repaints what is already drawn in it: a signature is one colour. */
  const recolour = (color: string) => {
    setInk(color);
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.save();
    context.globalCompositeOperation = 'source-in';
    context.fillStyle = color;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.restore();
  };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
  };

  const add = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const bounds = inkBounds(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
    if (!bounds) return;
    const x = Math.max(0, bounds.x - TRIM_PAD_PX);
    const y = Math.max(0, bounds.y - TRIM_PAD_PX);
    const w = Math.min(canvas.width - x, bounds.w + 2 * TRIM_PAD_PX);
    const h = Math.min(canvas.height - y, bounds.h + 2 * TRIM_PAD_PX);
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    out.getContext('2d')?.drawImage(canvas, x, y, w, h, 0, 0, w, h);
    onAdd({ uri: out.toDataURL('image/png'), pxWidth: w, pxHeight: h });
  };

  return (
    <AppPopup
      open={open}
      title={tx('Draw your signature', 'अपना हस्ताक्षर बनाएं')}
      onClose={onCancel}
      closeLabel={tx('Cancel', 'रद्द करें')}
      actions={
        <>
          <AppButton title={tx('Clear', 'मिटाएं')} variant="secondary" small onClick={clear} disabled={empty} />
          <AppButton title={tx('Add signature', 'हस्ताक्षर जोड़ें')} small onClick={add} disabled={empty} />
        </>
      }
    >
      <p className="signature-pad__hint">
        {tx(
          'Sign with your mouse, finger or stylus. You can move and resize it on the page.',
          'माउस, उंगली या स्टायलस से हस्ताक्षर करें। पेज पर इसे खिसका और छोटा-बड़ा कर सकते हैं।',
        )}
      </p>
      <canvas
        ref={canvasRef}
        className="signature-pad__canvas"
        aria-label={tx('Signature drawing area', 'हस्ताक्षर बनाने की जगह')}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          const p = point(event);
          lastRef.current = p;
          stroke(p, { x: p.x + 0.01, y: p.y });
          setEmpty(false);
        }}
        onPointerMove={(event) => {
          const last = lastRef.current;
          if (!last) return;
          const p = point(event);
          stroke(last, p);
          lastRef.current = p;
        }}
        onPointerUp={() => {
          lastRef.current = null;
        }}
        onPointerCancel={() => {
          lastRef.current = null;
        }}
      />
      <div className="signature-pad__inks" role="radiogroup" aria-label={tx('Ink colour', 'स्याही का रंग')}>
        {INKS.map((option) => (
          <button
            key={option.color}
            type="button"
            role="radio"
            aria-checked={ink === option.color}
            className="signature-pad__ink"
            onClick={() => recolour(option.color)}
          >
            <span className="signature-pad__swatch" style={{ background: option.color }} aria-hidden="true" />
            {tx(option.en, option.hi)}
          </button>
        ))}
      </div>
    </AppPopup>
  );
}
