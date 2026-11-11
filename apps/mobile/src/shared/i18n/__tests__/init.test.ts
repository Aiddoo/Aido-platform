import dayjs from 'dayjs';

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

  it('언어를 바꿔도 날짜 계산용 dayjs locale은 바뀌지 않는다', async () => {
    // Given
    await i18n.changeLanguage('en');

    // When
    await i18n.changeLanguage('ko');

    // Then
    // 주 시작·요일 계산이 표시 언어를 따라가지 않는다
    expect(dayjs.locale()).toBe('en');
  });
});
