import { AI_DATA_SHARING_CONSENT } from '@aido/api/vocabulary';

import { ConsentPolicy } from './consent.model';

describe('hasAgreedToAiDataSharing', () => {
  it.each([
    ['AGREED', true],
    ['DECLINED', false],
    ['UNDECIDED', false],
  ] as const)('결정이 %s면 %s를 반환한다', (aiDataSharingDecision, expected) => {
    // When
    const result = ConsentPolicy.hasAgreedToAiDataSharing({ aiDataSharingDecision });

    // Then
    expect(result).toBe(expected);
  });
});

describe('shouldShowAiConsentRenewal', () => {
  it('이전 안내 버전에 동의했으면 바뀐 안내를 보여 준다', () => {
    // Given
    const consent = {
      aiDataSharingDecision: 'AGREED',
      aiDataSharingConsentVersion: '2026-10-26',
    } as const;

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
      const result = ConsentPolicy.shouldShowAiConsentRenewal({
        aiDataSharingDecision,
        aiDataSharingConsentVersion,
      });

      // Then
      expect(result).toBe(false);
    },
  );
});
