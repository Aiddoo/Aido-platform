import type { Prisma8Transaction } from "#api/platform/database/prisma8-transactional.adapter";

import {
  createMockDatabaseContext,
  resetMockDatabaseContext,
  type MockDatabaseContext,
} from "./database.mock.js";

export type MockTransactionClient = MockDatabaseContext;

export function createMockTxClient(): MockTransactionClient {
  return createMockDatabaseContext();
}

export function asTxClient(mock: MockTransactionClient): Prisma8Transaction {
  return mock;
}

export function resetTxClientMocks(client: MockTransactionClient): void {
  resetMockDatabaseContext(client);
}
