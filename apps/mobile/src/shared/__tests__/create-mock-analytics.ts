import type { Analytics } from '@src/core/ports/analytics';

export const createMockAnalytics = (): jest.Mocked<Analytics> => ({
  trackEvent: jest.fn(),
  trackScreenView: jest.fn(),
  setUserId: jest.fn(),
  setUserProperties: jest.fn(),
  clearUser: jest.fn(),
  resetData: jest.fn(),
  getAnalyticsId: jest.fn().mockResolvedValue(null),
});
