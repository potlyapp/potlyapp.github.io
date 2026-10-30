import { shouldNotify, type NotifyInput } from './notify';

const base: NotifyInput = {
  enabled: true,
  permission: 'granted',
  today: '2026-03-21',
  lastNotifiedDay: null,
  dueCount: 2,
};

describe('shouldNotify', () => {
  it('fires when opted in, permitted and tasks are due', () => {
    expect(shouldNotify(base)).toBe(true);
  });

  it('fires again on a new day', () => {
    expect(shouldNotify({ ...base, lastNotifiedDay: '2026-03-20' })).toBe(true);
  });

  it.each([
    ['disabled', { enabled: false }],
    ['permission denied', { permission: 'denied' as const }],
    ['permission not asked', { permission: 'default' as const }],
    ['unsupported', { permission: 'unsupported' as const }],
    ['nothing due', { dueCount: 0 }],
    ['already notified today', { lastNotifiedDay: '2026-03-21' }],
  ])('stays silent when %s', (_label, patch) => {
    expect(shouldNotify({ ...base, ...patch })).toBe(false);
  });
});
