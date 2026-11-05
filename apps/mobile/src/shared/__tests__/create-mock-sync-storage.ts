import type { SyncStorage } from '@src/core/ports/sync-storage';

export const createMockSyncStorage = (): jest.Mocked<SyncStorage> => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
});
