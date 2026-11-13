import { i18n, t } from '../index';

afterEach(async () => {
  await i18n.changeLanguage('ko');
});

describe('i18n init', () => {
  it('fallback 언어는 en이다', () => {
    // When
    const fallbackLanguages = i18n.options.fallbackLng;

    // Then
    expect(fallbackLanguages).toEqual(['en']);
  });

  it('ko 카탈로그의 키를 번역한다', () => {
    // When
    const result = t('common:actions.confirm');

    // Then
    // 초기 언어는 mock 기기 언어(ko) 기준 ko
    expect(result).toBe('확인');
  });

  it('언어 변경 시 en 카탈로그로 번역한다', async () => {
    // Given
    await i18n.changeLanguage('en');

    // When
    const result = t('common:actions.confirm');

    // Then
    expect(result).toBe('OK');
  });
});
