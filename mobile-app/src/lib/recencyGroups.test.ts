import { groupByRecency } from './recencyGroups';

const DAY = 86_400_000;
const now = new Date('2026-10-24T15:00:00+05:30').getTime();

describe('groupByRecency', () => {
  it('splits into today, this week and earlier', () => {
    const items = [now - 2 * 3600_000, now - 3 * DAY, now - 20 * DAY];
    const groups = groupByRecency(items, (t) => t, now);
    expect(groups.map((g) => [g.key, g.items.length])).toEqual([
      ['today', 1],
      ['week', 1],
      ['earlier', 1],
    ]);
  });
  it('omits empty groups', () => {
    expect(groupByRecency([now - 20 * DAY], (t) => t, now).map((g) => g.key)).toEqual(['earlier']);
  });
});
