import { expect, it } from 'vitest';

import { pageImageName, pageImageSize } from './pdfPagesToImages';

it('sizes an A4 page at the chosen dpi', () => {
  expect(pageImageSize(595.28, 841.89, 150)).toMatchObject({ widthPx: 1240, heightPx: 1754 });
  expect(pageImageSize(595.28, 841.89, 300)).toMatchObject({ widthPx: 2480, heightPx: 3508 });
});

it('caps a huge page at 8000 px on its long side', () => {
  const size = pageImageSize(5000, 2000, 300);
  expect(size.widthPx).toBe(8000);
  expect(size.heightPx).toBe(3200);
});

it('names page images so they sort in page order', () => {
  expect(pageImageName('notice', 3, 12, 'jpeg')).toBe('notice-page-03.jpg');
  expect(pageImageName('notice', 7, 150, 'png')).toBe('notice-page-007.png');
});
