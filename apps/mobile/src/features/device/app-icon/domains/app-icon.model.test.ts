import { AppIconPolicy } from './app-icon.model';

describe('AppIconPolicy', () => {
  it('네이티브가 모르는 이름이면 기본 아이콘으로 본다', () => {
    // Given
    const unknownNativeKey = 'future_icon';

    // When / Then
    expect(AppIconPolicy.resolveAppIconKey(unknownNativeKey)).toBe('default');
    expect(AppIconPolicy.resolveAppIconKey(null)).toBe('default');
    expect(AppIconPolicy.resolveAppIconKey('tuxedo_cat')).toBe('tuxedo_cat');
  });

  it('기본 아이콘만 누구나 쓰고 네이티브에는 이름 없이 전달한다', () => {
    // Given / When / Then
    expect(AppIconPolicy.isPremiumIcon('default')).toBe(false);
    expect(AppIconPolicy.isPremiumIcon('cream_cat')).toBe(true);
    expect(AppIconPolicy.getNativeAppIconName('default')).toBeNull();
    expect(AppIconPolicy.getNativeAppIconName('cream_cat')).toBe('cream_cat');
  });
});
