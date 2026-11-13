import type { Analytics } from '@src/core/ports/analytics';

import { mockMethod } from '../mock-method';

/** 아무것도 기록하지 않는 분석. 아직 사용자 id가 없는 기기라 분석 id도 없다 */
export function createAnalyticsStub(): jest.Mocked<Analytics> {
  return {
    trackEvent: mockMethod<Analytics['trackEvent']>(),
    trackScreenView: mockMethod<Analytics['trackScreenView']>(),
    setUserId: mockMethod<Analytics['setUserId']>(),
    setUserProperties: mockMethod<Analytics['setUserProperties']>(),
    clearUser: mockMethod<Analytics['clearUser']>(),
    resetData: mockMethod<Analytics['resetData']>(),
    getAnalyticsId: mockMethod<Analytics['getAnalyticsId']>(async () => null),
  };
}
