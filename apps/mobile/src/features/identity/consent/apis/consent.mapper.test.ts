import { createConsentDto, createUpdateMarketingConsentDto } from '../__tests__/consent.fixtures';
import { toConsent, toUpdateMarketingConsentResult } from './consent.mapper';

describe('toConsent', () => {
  test('ISO 문자열 → Instant 변환', () => {
    // Given
    const dto = createConsentDto({
      termsAgreedAt: '2026-01-01T00:00:00.000Z',
      privacyAgreedAt: '2026-01-01T00:00:00.000Z',
      marketingAgreedAt: '2026-02-01T00:00:00.000Z',
    });

    // When
    const result = toConsent(dto);

    // Then
    expect(result.termsAgreedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(result.privacyAgreedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(result.marketingAgreedAt).toBe('2026-02-01T00:00:00.000Z');
  });

  test('null → null 유지', () => {
    // Given
    const dto = createConsentDto({
      termsAgreedAt: null,
      privacyAgreedAt: null,
      marketingAgreedAt: null,
    });

    // When
    const result = toConsent(dto);

    // Then
    expect(result.termsAgreedAt).toBeNull();
    expect(result.privacyAgreedAt).toBeNull();
    expect(result.marketingAgreedAt).toBeNull();
  });

  test('agreedTermsVersion 유지', () => {
    // Given
    const dto = createConsentDto({ agreedTermsVersion: '2.0.0' });

    // When
    const result = toConsent(dto);

    // Then
    expect(result.agreedTermsVersion).toBe('2.0.0');
  });

  test('AI 데이터 제공 동의 상태와 동의 시각을 옮긴다', () => {
    // Given
    const dto = createConsentDto({
      aiDataSharingDecision: 'AGREED',
      aiDataSharingAgreedAt: '2026-10-26T09:00:00.000Z',
    });

    // When
    const result = toConsent(dto);

    // Then
    expect(result.aiDataSharingDecision).toBe('AGREED');
    expect(result.aiDataSharingAgreedAt).toBe('2026-10-26T09:00:00.000Z');
  });

  test('AI 동의 필드가 없는 이전 서버 응답은 답하지 않은 것으로 본다', () => {
    // Given
    const dto = createConsentDto();

    // When
    const result = toConsent(dto);

    // Then
    expect(result.aiDataSharingDecision).toBe('UNDECIDED');
    expect(result.aiDataSharingAgreedAt).toBeNull();
  });
});

describe('toUpdateMarketingConsentResult', () => {
  test('ISO → Instant 변환', () => {
    // Given
    const dto = createUpdateMarketingConsentDto({
      marketingAgreedAt: '2026-02-01T00:00:00.000Z',
    });

    // When
    const result = toUpdateMarketingConsentResult(dto);

    // Then
    expect(result.marketingAgreedAt).toBe('2026-02-01T00:00:00.000Z');
  });

  test('null → null (마케팅 동의 철회)', () => {
    // Given
    const dto = createUpdateMarketingConsentDto({ marketingAgreedAt: null });

    // When
    const result = toUpdateMarketingConsentResult(dto);

    // Then
    expect(result.marketingAgreedAt).toBeNull();
  });
});
