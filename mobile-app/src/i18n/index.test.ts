import { pickText } from './index';

describe('pickText', () => {
  it('returns English for english', () => {
    expect(pickText('english', 'Files', 'फ़ाइलें')).toBe('Files');
  });
  it('returns Hindi for hindi', () => {
    expect(pickText('hindi', 'Files', 'फ़ाइलें')).toBe('फ़ाइलें');
  });
  it('joins both for bilingual, English first', () => {
    expect(pickText('bilingual', 'Files', 'फ़ाइलें')).toBe('Files · फ़ाइलें');
  });
  it('falls back to English when Hindi is empty', () => {
    expect(pickText('hindi', 'PDF', '')).toBe('PDF');
  });
});
