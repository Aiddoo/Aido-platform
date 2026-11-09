import { AppIconPolicy } from './app-icon.model';

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
