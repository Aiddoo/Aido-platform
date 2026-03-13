import type { SyncStorage } from '@src/core/ports/sync-storage';

export const createMockSyncStorage = (): jest.Mocked<SyncStorage> => ({
  getString: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
});
