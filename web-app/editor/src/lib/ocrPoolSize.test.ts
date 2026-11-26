import { describe, expect, it } from 'vitest';

import { ocrPageLimit, poolSizeFor } from './ocrPoolSize';

describe('poolSizeFor', () => {
  it('uses one worker on low-memory devices', () => {
    expect(poolSizeFor({ cores: 8, memoryGb: 2, mobile: true })).toBe(1);
    expect(poolSizeFor({ cores: 8, memoryGb: 1, mobile: true })).toBe(1);
  });

  it('uses two on 4 GB devices and on phones that do not report memory', () => {
    expect(poolSizeFor({ cores: 8, memoryGb: 4, mobile: true })).toBe(2);
    expect(poolSizeFor({ cores: 6, memoryGb: undefined, mobile: true })).toBe(2);
  });

  it('uses up to four on desktops, leaving a core for the page', () => {
    expect(poolSizeFor({ cores: 8, memoryGb: 8, mobile: false })).toBe(4);
    expect(poolSizeFor({ cores: 8, memoryGb: undefined, mobile: false })).toBe(4);
    expect(poolSizeFor({ cores: 4, memoryGb: 8, mobile: false })).toBe(3);
    expect(poolSizeFor({ cores: 2, memoryGb: 16, mobile: false })).toBe(1);
    expect(poolSizeFor({ cores: 0, memoryGb: undefined, mobile: false })).toBe(1);
  });
});

describe('ocrPageLimit', () => {
  it('reads fewer whole pages on devices with fewer OCR workers', () => {
    expect(ocrPageLimit(1)).toBe(15);
    expect(ocrPageLimit(2)).toBe(60);
    expect(ocrPageLimit(4)).toBe(300);
  });
});
