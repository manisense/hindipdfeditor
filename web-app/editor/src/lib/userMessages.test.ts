import { expect, it } from 'vitest';

import { exportFailureMessage, MAX_EDIT_PAGES, openFailureMessage, tooManyPagesMessage } from './userMessages';

const named = (name: string) => Object.assign(new Error('raw library text'), { name });

it('explains password-protected and damaged files in both languages without library text', () => {
  expect(openFailureMessage(named('PasswordException')).en).toContain('password-protected');
  expect(openFailureMessage(named('PasswordException')).hi).toContain('पासवर्ड');
  expect(openFailureMessage(named('InvalidPDFException')).en).toContain('not a valid PDF');
  for (const message of [openFailureMessage(new Error('boom')), exportFailureMessage()]) {
    expect(message.en).not.toContain('boom');
    expect(message.hi.length).toBeGreaterThan(10);
  }
});

it('names the page limit', () => {
  expect(tooManyPagesMessage(400).en).toContain(String(MAX_EDIT_PAGES));
  expect(tooManyPagesMessage(400).hi).toContain('400');
});
