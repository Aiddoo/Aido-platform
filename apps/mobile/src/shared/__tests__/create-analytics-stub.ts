import type { Analytics } from '@src/core/ports/analytics';

/** 아무것도 기록하지 않는 분석. 아직 사용자 id가 없는 기기라 분석 id도 없다 */
export function createAnalyticsStub(): jest.Mocked<Analytics> {
  return {
    trackEvent: jest.fn(),
    trackScreenView: jest.fn(),
    setUserId: jest.fn(),
    setUserProperties: jest.fn(),
    clearUser: jest.fn(),
    resetData: jest.fn(),
    getAnalyticsId: jest.fn(async () => null),
  };
}
