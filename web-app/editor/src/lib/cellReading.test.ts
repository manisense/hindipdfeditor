import { expect, it } from 'vitest';

import { cleanCellReading } from './cellReading';

it('drops unsure speckle words at the ends of a cell', () => {
  expect(cleanCellReading([
    { text: 'विज्ञान', confidence: 95 },
    { text: 'प्रदर्शनी', confidence: 94 },
    { text: 'का', confidence: 21 },
  ])).toEqual({ text: 'विज्ञान प्रदर्शनी', confidence: 94.5 });
  expect(cleanCellReading([{ text: '|', confidence: 80 }, { text: '10:00', confidence: 96 }, { text: '.', confidence: 30 }])?.text).toBe('10:00');
});

it('keeps sure short words and words in the middle', () => {
  expect(cleanCellReading([{ text: 'नाम', confidence: 90 }, { text: 'का', confidence: 88 }])?.text).toBe('नाम का');
  expect(cleanCellReading([{ text: 'अ', confidence: 90 }, { text: 'व', confidence: 20 }, { text: 'ब', confidence: 90 }])?.text).toBe('अ व ब');
});

it('returns null for a cell of speckle only', () => {
  expect(cleanCellReading([{ text: '०', confidence: 12 }, { text: ',', confidence: 50 }])).toBeNull();
  expect(cleanCellReading([])).toBeNull();
});
