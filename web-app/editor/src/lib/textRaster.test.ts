import { expect, it } from 'vitest';

import { groupIntoLines } from './textRaster';

it('groups graphemes by the line the browser put them on and drops wrap spaces', () => {
  const g = (text: string, top: number, left: number) => ({ text, top, left });
  expect(
    groupIntoLines(
      [g('क', 10, 5), g('र्मचा', 10.4, 25), g(' ', 10, 60), g('री', 58, 5), g('\n', 58, 30), g('X', 106, 5)],
      40,
    ),
  ).toEqual([
    { text: 'कर्मचा', left: 5 },
    { text: 'री', left: 5 },
    { text: 'X', left: 5 },
  ]);
});
