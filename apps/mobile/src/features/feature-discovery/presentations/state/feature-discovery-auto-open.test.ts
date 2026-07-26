import {
  claimAndOpenFeatureDiscovery,
  isStableFeedForeground,
} from './feature-discovery-auto-open';

const stableInput = {
  isAuthenticated: true,
  isFocused: true,
  appState: 'active' as const,
  isKeyboardVisible: false,
  hasActiveOverlay: false,
  hasPendingDeepLink: false,
  hasActiveForm: false,
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
    [{ appState: 'background' as const }, '백그라운드'],
    [{ isKeyboardVisible: true }, '키보드'],
    [{ hasActiveOverlay: true }, '다른 오버레이'],
    [{ hasPendingDeepLink: true }, '딥 링크'],
    [{ hasActiveForm: true }, '활성 폼'],
  ])('%s 상태에서는 false를 반환한다', (overrides, _label) => {
    // When
    const result = isStableFeedForeground({ ...stableInput, ...overrides });

    // Then
    expect(result).toBe(false);
  });
});

describe('claimAndOpenFeatureDiscovery', () => {
  it('안정된 자격 사용자는 본 상태를 먼저 claim한 뒤 허브를 연다', () => {
    // Given
    const order: string[] = [];

    // When
    const result = claimAndOpenFeatureDiscovery({
      canAutoOpen: true,
      isStable: true,
      claim: () => {
        order.push('claim');
        return true;
      },
      open: () => order.push('open'),
    });

    // Then
    expect(result).toBe(true);
    expect(order).toEqual(['claim', 'open']);
  });

  it('claim 경쟁에서 지면 허브를 열지 않는다', () => {
    // Given
    const open = jest.fn();

    // When
    const result = claimAndOpenFeatureDiscovery({
      canAutoOpen: true,
      isStable: true,
      claim: () => false,
      open,
    });

    // Then
    expect(result).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it.each([
    [{ canAutoOpen: false, isStable: true }, '자격 없음'],
    [{ canAutoOpen: true, isStable: false }, '피드 불안정'],
  ])('%s이면 claim도 시도하지 않는다', (conditions, _label) => {
    // Given
    const claim = jest.fn(() => true);
    const open = jest.fn();

    // When
    const result = claimAndOpenFeatureDiscovery({
      ...conditions,
      claim,
      open,
    });

    // Then
    expect(result).toBe(false);
    expect(claim).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });
});
