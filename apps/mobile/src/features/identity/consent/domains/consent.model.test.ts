import { AI_DATA_SHARING_CONSENT } from '@aido/api/vocabulary';
import { toInstant } from '@src/shared/date/instant';

import { createConsent } from '../__tests__/consent.fixtures';
import { ConsentPolicy, getConsentResult } from './consent.model';

describe('hasAgreedToAiDataSharing', () => {
  it.each([
    ['AGREED', true],
    ['DECLINED', false],
    ['UNDECIDED', false],
  ] as const)('결정이 %s면 %s를 반환한다', (aiDataSharingDecision, expected) => {
    // When
    const result = ConsentPolicy.hasAgreedToAiDataSharing(createConsent({ aiDataSharingDecision }));

    // Then
    expect(result).toBe(expected);
  });
});

describe('shouldShowAiConsentRenewal', () => {
  it('이전 안내 버전에 동의했으면 바뀐 안내를 보여 준다', () => {
    // Given
    const consent = createConsent({
      aiDataSharingDecision: 'AGREED',
      aiDataSharingConsentVersion: '2026-10-26',
    });

    // When
    const result = ConsentPolicy.shouldShowAiConsentRenewal(consent);

    // Then
    expect(result).toBe(true);
  });

  it.each([
    ['현재 안내 버전에 동의했으면', 'AGREED', AI_DATA_SHARING_CONSENT.VERSION],
    ['동의한 버전을 모르면', 'AGREED', null],
    ['거부했으면', 'DECLINED', '2026-10-26'],
    ['아직 답하지 않았으면', 'UNDECIDED', null],
  ] as const)(
    '%s 다시 묻지 않는다',
    (_label, aiDataSharingDecision, aiDataSharingConsentVersion) => {
      // When
      const result = ConsentPolicy.shouldShowAiConsentRenewal(
        createConsent({ aiDataSharingDecision, aiDataSharingConsentVersion }),
      );

      // Then
      expect(result).toBe(false);
    },
  );
});

describe('getConsentResult', () => {
  const AT = toInstant('2026-11-09T03:00:00.000Z');

  it.each([
    ['동의 시각이 있으면 동의', { agreedAt: AT, withdrawnAt: null }, { type: 'agreed', at: AT }],
    ['철회 시각만 있으면 철회', { agreedAt: null, withdrawnAt: AT }, { type: 'withdrawn', at: AT }],
    ['둘 다 없으면(구 서버) 알리지 않음', { agreedAt: null, withdrawnAt: null }, null],
  ] as const)('%s 결과다', (_case, times, expected) => {
    // When
    const result = getConsentResult(times);

    // Then
    expect(result).toEqual(expected);
  });
});
