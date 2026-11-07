import { parseThemeMode, THEME_MODE_STORAGE_KEY } from './theme-mode.preference';

describe('parseThemeMode', () => {
  it('저장된 값이 없으면 system을 반환한다', () => {
    // When
    const result = parseThemeMode(undefined);

    // Then
    expect(result).toBe('system');
  });

  it.each(['light', 'dark', 'system'] as const)('%s가 저장되어 있으면 그대로 반환한다', (saved) => {
    // When
    const result = parseThemeMode(saved);

    // Then
    expect(result).toBe(saved);
  });

  it('유효하지 않은 값이 저장되어 있으면 system을 반환한다', () => {
    // When
    const result = parseThemeMode('invalid');

    // Then
    expect(result).toBe('system');
  });
});

describe('저장 키', () => {
  it('이미 설치된 앱의 저장 값을 읽도록 키를 바꾸지 않는다', () => {
    // Then
    expect(THEME_MODE_STORAGE_KEY).toBe('aido_theme_mode');
  });
});
