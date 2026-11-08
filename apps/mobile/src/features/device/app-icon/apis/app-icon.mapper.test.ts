import { toAppIconKey, toNativeAppIconName } from './app-icon.mapper';

describe('toAppIconKey', () => {
  it.each([
    ['네이티브가 모르는 이름', 'future_icon', 'default'],
    ['이름이 없는 기본 아이콘', null, 'default'],
    ['아는 이름', 'tuxedo_cat', 'tuxedo_cat'],
  ] as const)('%s이면 %p를 %s로 읽는다', (_label, nativeKey, expected) => {
    // When
    const result = toAppIconKey(nativeKey);

    // Then
    expect(result).toBe(expected);
  });
});

describe('toNativeAppIconName', () => {
  it('기본 아이콘은 네이티브에 이름 없이 전달한다', () => {
    // When
    const defaultName = toNativeAppIconName('default');
    const creamCatName = toNativeAppIconName('cream_cat');

    // Then
    expect(defaultName).toBeNull();
    expect(creamCatName).toBe('cream_cat');
  });
});
