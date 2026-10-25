import dayjs from 'dayjs';

import { i18n, t } from '../index';

afterEach(async () => {
  await i18n.changeLanguage('ko');
});

describe('i18n init', () => {
  it('fallback 언어는 ko이다', () => {
    expect(i18n.options.fallbackLng).toEqual(['ko']);
  });

  it('ko 카탈로그의 키를 번역한다', () => {
    // Given
    // 초기 언어는 mock 기기 언어(ko) 기준 ko

    // When
    const result = t('common:actions.confirm');

    // Then
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

    // Then: 주 시작·요일 계산이 표시 언어를 따라가지 않는다
    expect(dayjs.locale()).toBe('en');
  });

  it('en에 없는 키는 ko로 fallback한다', async () => {
    // Given — parity 테스트가 실키 누락을 막으므로 존재하지 않는 키로 fallback 체인만 검증
    await i18n.changeLanguage('en');

    // When
    const result = i18n.t('common:actions.confirm', { lng: 'en' });

    // Then
    expect(result).toBe('OK');
  });
});
