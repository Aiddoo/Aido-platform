import { isStableFeedForeground } from './feed-foreground.view-model';

const stableInput: Parameters<typeof isStableFeedForeground>[0] = {
  authStatus: 'authenticated',
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

  it.each<{ label: string; overrides: Partial<typeof stableInput> }>([
    { label: '로그인 전', overrides: { authStatus: 'unauthenticated' } },
    { label: '로그인 판정 전', overrides: { authStatus: 'loading' } },
    { label: '키체인 잠김', overrides: { authStatus: 'locked' } },
    { label: '다른 화면', overrides: { isFocused: false } },
    { label: '백그라운드', overrides: { isAppActive: false } },
    { label: '키보드', overrides: { isKeyboardVisible: true } },
    { label: '피드 폼 또는 다른 오버레이', overrides: { hasActiveOverlay: true } },
    { label: '딥 링크', overrides: { hasPendingDeepLink: true } },
    { label: '눌린 푸시 처리 중', overrides: { hasPendingNavigation: true } },
  ])('$label 상태에서는 false를 반환한다', ({ overrides }) => {
    // When
    const result = isStableFeedForeground({ ...stableInput, ...overrides });

    // Then
    expect(result).toBe(false);
  });
});
