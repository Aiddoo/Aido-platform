import { AppVersionPolicy, type AppVersionPolicyInput } from './app-version.model';

const input = (currentVersion: string, latestVersion: string): AppVersionPolicyInput => ({
  platform: 'ios',
  currentVersion,
  config: {
    enabled: true,
    latestByPlatform: { ios: latestVersion, android: latestVersion },
  },
});

describe('AppVersionPolicy', () => {
  it.each([
    ['1.9.0', '1.9.1', true, false],
    ['1.9.1', '1.9.1', false, true],
    ['1.10.0', '1.9.9', false, true],
  ])('현재 %s / 최신 %s를 올바르게 판정한다', (current, latest, open, dialog) => {
    const value = input(current, latest);
    expect(AppVersionPolicy.canDecide(value)).toBe(true);
    expect(AppVersionPolicy.shouldOpenStore(value)).toBe(open);
    expect(AppVersionPolicy.shouldShowLatestDialog(value)).toBe(dialog);
  });

  it.each([
    { ...input('1.9.0', '1.9.1'), platform: 'web' },
    { ...input('1.9', '1.9.1') },
    { ...input('1.9.0', '1.9.1'), config: { enabled: false } as const },
  ])('판정할 수 없는 입력은 모든 액션을 fail-closed 한다', (value) => {
    expect(AppVersionPolicy.canDecide(value)).toBe(false);
    expect(AppVersionPolicy.shouldOpenStore(value)).toBe(false);
    expect(AppVersionPolicy.shouldShowLatestDialog(value)).toBe(false);
  });
});
