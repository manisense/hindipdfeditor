import { resolveBack } from './backStack';

describe('resolveBack', () => {
  it('closes an open tool first', () => {
    expect(resolveBack({ activeTool: 'merge', tab: 'tools' })).toEqual({ type: 'closeTool' });
  });
  it('returns to Home from another tab', () => {
    expect(resolveBack({ activeTool: null, tab: 'files' })).toEqual({ type: 'goHome' });
  });
  it('lets Android exit from Home', () => {
    expect(resolveBack({ activeTool: null, tab: 'home' })).toEqual({ type: 'exit' });
  });
});
