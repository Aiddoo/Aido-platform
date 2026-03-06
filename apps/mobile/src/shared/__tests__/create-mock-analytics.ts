import type { Analytics } from '@src/core/ports/analytics';

export const createMockAnalytics = (): jest.Mocked<Analytics> => ({
  trackEvent: jest.fn(),
  trackScreenView: jest.fn(),
  setUserId: jest.fn(),
  setUserProperties: jest.fn(),
  resetData: jest.fn(),
});
