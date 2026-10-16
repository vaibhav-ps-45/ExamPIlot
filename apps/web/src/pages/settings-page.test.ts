import { describe, expect, it } from 'vitest';
import { describeDevice } from './settings-page';

describe('describeDevice', () => {
  it('names browser and system without showing the raw user agent', () => {
    expect(
      describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Edg/126.0'),
    ).toEqual({ label: 'Edge on Windows', mobile: false });
    expect(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1')).toEqual({
      label: 'Safari on iOS',
      mobile: true,
    });
  });

  it('copes with a missing user agent', () => {
    expect(describeDevice(null)).toEqual({ label: 'Unknown device', mobile: false });
  });
});
