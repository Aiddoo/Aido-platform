import type { TokenStore } from '@src/core/ports/token-store';

export const createMockTokenStore = (): jest.Mocked<TokenStore> => ({
  readAccessToken: jest.fn().mockResolvedValue(null),
  readRefreshToken: jest.fn().mockResolvedValue(null),
  save: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
});
