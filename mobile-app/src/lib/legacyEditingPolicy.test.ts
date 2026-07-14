import { legacyEditingPolicy, UNKNOWN_ENCODING_FONT_NAME } from './legacyEditingPolicy';

it('always blocks an inconclusive font inspection', () => {
  expect(legacyEditingPolicy([UNKNOWN_ENCODING_FONT_NAME], true)).toEqual({
    inspectionFailed: true,
    knownLegacyFontNames: [],
    editingBlocked: true,
  });
});

it('blocks a known legacy font until safe replacement is explicitly enabled', () => {
  expect(legacyEditingPolicy(['KrutiDev010'], false).editingBlocked).toBe(true);
  expect(legacyEditingPolicy(['KrutiDev010'], true)).toEqual({
    inspectionFailed: false,
    knownLegacyFontNames: ['KrutiDev010'],
    editingBlocked: false,
  });
});

it('allows a page with no detector warnings', () => {
  expect(legacyEditingPolicy([], false).editingBlocked).toBe(false);
});
