import { createFeatureQuotaDto } from '../__tests__/entitlement.fixtures';
import { toFeatureQuota } from '../apis/entitlement.mapper';
import { LimitedFeaturePolicy } from './limited-feature.model';

describe('LimitedFeaturePolicy', () => {
  describe('getBlockedDecision', () => {
    it.each([
      ['서버가 한도를 열어 두고 줬으면', 'AI_PARSE', true, 'limit-reached'],
      ['서버가 등급에서 닫았다고 줬으면', 'AI_PARSE', false, 'locked'],
      ['한도 정보가 없는 횟수 기능이면', 'AI_PARSE', null, 'limit-reached'],
      ['한도 정보가 없는 켜고 끄는 기능이면', 'APP_ICON', null, 'locked'],
    ] as const)('%s %s는 %s다', (_label, feature, allowed, expected) => {
      // Given
      const featureQuota =
        allowed == null ? null : { ...toFeatureQuota(createFeatureQuotaDto(feature)), allowed };
      const limited = { feature, featureQuota };

      // When
      const decision = LimitedFeaturePolicy.getBlockedDecision(limited);

      // Then
      expect(decision).toBe(expected);
    });
  });
});
