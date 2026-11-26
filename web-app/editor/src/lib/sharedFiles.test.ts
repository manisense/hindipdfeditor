import { expect, it } from 'vitest';

import { sharedKind, toolsForSharedFiles } from './sharedFiles';

const pdf = { name: 'notice.pdf', type: 'application/pdf' };
const photo = { name: 'IMG_1.jpg', type: 'image/jpeg' };
const word = { name: 'letter.docx', type: '' };

it('recognises shared files by type or name', () => {
  expect(sharedKind(pdf)).toBe('pdf');
  expect(sharedKind({ name: 'scan.PDF', type: '' })).toBe('pdf');
  expect(sharedKind(photo)).toBe('image');
  expect(sharedKind(word)).toBe('docx');
  expect(sharedKind({ name: 'song.mp3', type: 'audio/mpeg' })).toBe('other');
});

it('offers tools that fit the shared files', () => {
  expect(toolsForSharedFiles([pdf])[0]).toBe('edit');
  expect(toolsForSharedFiles([pdf, pdf])).toEqual(['merge']);
  expect(toolsForSharedFiles([photo])).toEqual(['jpg-to-pdf', 'resize-image']);
  expect(toolsForSharedFiles([photo, photo])).toEqual(['jpg-to-pdf']);
  expect(toolsForSharedFiles([word])).toEqual(['word-to-pdf', 'unicode-to-krutidev']);
});

it('offers nothing for mixed, unknown or no files', () => {
  expect(toolsForSharedFiles([pdf, photo])).toEqual([]);
  expect(toolsForSharedFiles([{ name: 'a.zip', type: 'application/zip' }])).toEqual([]);
  expect(toolsForSharedFiles([])).toEqual([]);
});
