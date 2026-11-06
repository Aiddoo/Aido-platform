import type { SyncStorage } from '@src/core/ports/sync-storage';

export const createSyncStorageStub = (): jest.Mocked<SyncStorage> => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
});
