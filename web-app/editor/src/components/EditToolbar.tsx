import { AppButton } from './AppButton';
import { Check, Trash2 } from 'lucide-react';
import type { DevanagariFontFamily } from '../lib/fontAsset';
import './EditToolbar.css';

export const TEXT_COLOR_PRESETS = [
  { label: 'Black', value: '#15172c' },
  { label: 'Blue', value: '#1843dd' },
  { label: 'Red', value: '#c6303e' },
  { label: 'Green', value: '#01873e' },
] as const;

type Props = {
  fontSizePt: number;
  fontFamily: DevanagariFontFamily;
  color: string;
  fontWeight: 'normal' | 'bold';
  onFontSizeChange: (fontSizePt: number) => void;
  onFontFamilyChange: (fontFamily: DevanagariFontFamily) => void;
  onColorChange: (color: string) => void;
  onFontWeightChange: (fontWeight: 'normal' | 'bold') => void;
  onDelete: () => void;
  onDone: () => void;
};

const MIN_FONT_SIZE_PT = 6;
const MAX_FONT_SIZE_PT = 72;

export function EditToolbar({
  fontSizePt,
  fontFamily,
  color,
  fontWeight,
  onFontSizeChange,
  onFontFamilyChange,
  onColorChange,
  onFontWeightChange,
  onDelete,
  onDone,
}: Props) {
  return (
    <div className="edit-toolbar">
      <div className="edit-toolbar__heading">
        <strong>Text style</strong>
        <span>Changes apply to the selected text</span>
      </div>
      <div className="edit-toolbar__row">
        <div className="edit-toolbar__group" aria-label="Typeface">
          <button
            type="button"
            className={`edit-toolbar__chip ${fontFamily === 'NotoSansDevanagari' ? 'active' : ''}`}
            onClick={() => onFontFamilyChange('NotoSansDevanagari')}
          >
            Sans
          </button>
          <button
            type="button"
            className={`edit-toolbar__chip ${fontFamily === 'NotoSerifDevanagari' ? 'active' : ''}`}
            onClick={() => onFontFamilyChange('NotoSerifDevanagari')}
          >
            Serif
          </button>
          <button
            type="button"
            aria-label="Toggle bold"
            className={`edit-toolbar__chip edit-toolbar__chip--bold ${fontWeight === 'bold' ? 'active' : ''}`}
            onClick={() => onFontWeightChange(fontWeight === 'bold' ? 'normal' : 'bold')}
          >
            B
          </button>
        </div>
        <div className="edit-toolbar__group edit-toolbar__group--size" aria-label="Font size">
          <AppButton
            title="A−"
            small
            variant="secondary"
            disabled={fontSizePt <= MIN_FONT_SIZE_PT}
            onClick={() => onFontSizeChange(Math.max(MIN_FONT_SIZE_PT, fontSizePt - 1))}
          />
          <span className="edit-toolbar__size">{Math.round(fontSizePt)}pt</span>
          <AppButton
            title="A+"
            small
            variant="secondary"
            disabled={fontSizePt >= MAX_FONT_SIZE_PT}
            onClick={() => onFontSizeChange(Math.min(MAX_FONT_SIZE_PT, fontSizePt + 1))}
          />
        </div>
        <div className="edit-toolbar__group edit-toolbar__group--colors" aria-label="Text color">
          {TEXT_COLOR_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              aria-label={preset.label}
              className={`edit-toolbar__swatch ${color.toLowerCase() === preset.value ? 'active' : ''}`}
              style={{ backgroundColor: preset.value }}
              onClick={() => onColorChange(preset.value)}
            />
          ))}
        </div>
      </div>
      <div className="edit-toolbar__actions">
        <AppButton
          title="Delete"
          icon={<Trash2 size={15} aria-hidden="true" />}
          small
          variant="danger"
          onClick={onDelete}
        />
        <AppButton
          title="Done"
          icon={<Check size={15} aria-hidden="true" />}
          small
          onClick={onDone}
        />
      </div>
    </div>
  );
}
