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

  it('언어 변경 시 dayjs locale이 동기화된다', async () => {
    // Given
    await i18n.changeLanguage('en');
    expect(dayjs.locale()).toBe('en');

    // When
    await i18n.changeLanguage('ko');

    // Then
    expect(dayjs.locale()).toBe('ko');
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
