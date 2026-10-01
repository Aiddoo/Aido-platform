import { type DeepMockProxy, mockDeep, mockReset } from "vitest-mock-extended";

import type { Prisma } from "#api/generated/prisma/client";

export type MockTransactionClient = DeepMockProxy<Prisma.TransactionClient>;

export function createMockTxClient(): MockTransactionClient {
	return mockDeep<Prisma.TransactionClient>();
}

export function asTxClient(mock: MockTransactionClient): Prisma.TransactionClient {
	return mock;
}

export function resetTxClientMocks(client: MockTransactionClient): void {
	mockReset(client);
}
