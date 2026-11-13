import { createConsentDto } from '../__tests__/consent.fixtures';
import { toConsent } from './consent.mapper';

describe('toConsent', () => {
  it('AI 데이터 제공 동의 상태와 동의 시각을 옮긴다', () => {
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

  it('서버가 답하지 않았다고 하면 동의 시각과 안내 버전은 비어 있다', () => {
    // Given
    const dto = createConsentDto();

    // When
    const result = toConsent(dto);

    // Then
    expect(result.aiDataSharingDecision).toBe('UNDECIDED');
    expect(result.aiDataSharingAgreedAt).toBeNull();
  });
});
