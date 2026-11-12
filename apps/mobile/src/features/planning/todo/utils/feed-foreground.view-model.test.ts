import { isStableFeedForeground } from './feed-foreground.view-model';

const stableInput = {
  isAuthenticated: true,
  isFocused: true,
  isAppActive: true,
  isKeyboardVisible: false,
  hasActiveOverlay: false,
  hasPendingDeepLink: false,
  hasPendingNavigation: false,
};

describe('isStableFeedForeground', () => {
  it('인증된 피드가 포그라운드에서 방해 요소 없이 포커스되면 true를 반환한다', () => {
    // When
    const result = isStableFeedForeground(stableInput);

    // Then
    expect(result).toBe(true);
  });

  it.each([
    [{ isAuthenticated: false }, '미인증'],
    [{ isFocused: false }, '다른 화면'],
    [{ isAppActive: false }, '백그라운드'],
    [{ isKeyboardVisible: true }, '키보드'],
    [{ hasActiveOverlay: true }, '피드 폼 또는 다른 오버레이'],
    [{ hasPendingDeepLink: true }, '딥 링크'],
    [{ hasPendingNavigation: true }, '눌린 푸시 처리 중'],
  ])('%s 상태에서는 false를 반환한다', (overrides, _label) => {
    // When
    const result = isStableFeedForeground({ ...stableInput, ...overrides });

    // Then
    expect(result).toBe(false);
  });
});
