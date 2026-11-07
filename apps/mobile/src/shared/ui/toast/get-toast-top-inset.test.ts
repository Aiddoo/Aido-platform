import { getToastTopInset, TOAST_MIN_TOP_GAP } from './get-toast-top-inset';

describe('getToastTopInset', () => {
  it('iOS에서 위쪽 safe area가 있으면 HeroUI 기본값을 쓴다', () => {
    // When
    const inset = getToastTopInset(59, 'ios');

    // Then
    expect(inset).toBeUndefined();
  });

  it('접은 iPhone Duo처럼 iOS 위쪽 safe area가 0이면 최소 간격을 둔다', () => {
    // When
    const inset = getToastTopInset(0, 'ios');

    // Then
    expect(inset).toBe(TOAST_MIN_TOP_GAP);
  });

  it('Android는 HeroUI 기본값(safe area + 12)을 쓴다', () => {
    // When
    const insetWithoutSafeArea = getToastTopInset(0, 'android');
    const insetWithSafeArea = getToastTopInset(24, 'android');

    // Then
    expect(insetWithoutSafeArea).toBeUndefined();
    expect(insetWithSafeArea).toBeUndefined();
  });
});
