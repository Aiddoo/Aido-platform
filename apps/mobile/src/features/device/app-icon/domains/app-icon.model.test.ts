import { AppIconPolicy } from './app-icon.model';

describe('resolveAppIconKey', () => {
  it('네이티브가 모르는 이름이면 기본 아이콘으로 본다', () => {
    // Given
    const unknownNativeKey = 'future_icon';

    // When
    const unknown = AppIconPolicy.resolveAppIconKey(unknownNativeKey);
    const missing = AppIconPolicy.resolveAppIconKey(null);
    const known = AppIconPolicy.resolveAppIconKey('tuxedo_cat');

    // Then
    expect(unknown).toBe('default');
    expect(missing).toBe('default');
    expect(known).toBe('tuxedo_cat');
  });
});

describe('isPremiumIcon', () => {
  it('기본 아이콘만 누구나 쓰고 나머지는 구독 기능이다', () => {
    // When
    const defaultIcon = AppIconPolicy.isPremiumIcon('default');
    const creamCat = AppIconPolicy.isPremiumIcon('cream_cat');

    // Then
    expect(defaultIcon).toBe(false);
    expect(creamCat).toBe(true);
  });
});

describe('getNativeAppIconName', () => {
  it('기본 아이콘은 네이티브에 이름 없이 전달한다', () => {
    // When
    const defaultName = AppIconPolicy.getNativeAppIconName('default');
    const creamCatName = AppIconPolicy.getNativeAppIconName('cream_cat');

    // Then
    expect(defaultName).toBeNull();
    expect(creamCatName).toBe('cream_cat');
  });
});
