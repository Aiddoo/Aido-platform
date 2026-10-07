import { AsyncLocalStorage } from "node:async_hooks";

import type { TransactionHost } from "@nestjs-cls/transactional";
import postgres from "@prisma/orm-postgres/runtime";
import { Pool, type PoolConfig } from "pg";
import { mock } from "vitest-mock-extended";

import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import type { DatabaseService } from "#api/shared/infrastructure/database/database.service";
import {
	Prisma8TransactionalAdapter,
	bindDatabaseTransaction,
	type Prisma8Transaction,
} from "#api/shared/infrastructure/database/prisma8-transactional.adapter";

import type { Contract } from "../../src/generated/prisma8/contract.d.js";
import contractJson from "../../src/generated/prisma8/contract.json" with { type: "json" };
import type { TestDatabaseClient } from "./test-database.js";

/** Tests own their pool, including single-connection sessions used in lock tests. */
export function createTestClient(
	connectionString: string,
	options: PoolConfig = {},
): TestDatabaseClient {
	const pool = new Pool({ ...options, connectionString });
	const client = postgres<Contract>({ contractJson, pg: pool });
	let closed = false;
	return {
		...client,
		async close() {
			if (closed) return;
			closed = true;
			await client.close();
			await pool.end();
		},
	};
}

/** TestDatabase owns teardown; Nest fixture shutdown must not dispose that client. */
export function createTestDatabaseService(client: TestDatabaseClient): DatabaseService {
	return { db: client, async onModuleDestroy() {} };
}

export function createDatabaseContext(client: TestDatabaseClient): Prisma8Transaction {
	return new Prisma8TransactionalAdapter()
		.optionsFactory(createTestDatabaseService(client))
		.getFallbackInstance();
}

export function withDatabaseTransaction<T>(
	client: TestDatabaseClient,
	work: (tx: Prisma8Transaction) => Promise<T>,
): Promise<T> {
	return client.transaction((tx) => work(bindDatabaseTransaction(tx, client.raw)));
}

/** Repository integration fixtures share native transactions and Required propagation. */
export function createDatabaseTransactionFixture(client: TestDatabaseClient | Prisma8Transaction) {
	const active = new AsyncLocalStorage<Prisma8Transaction>();
	const host = mock<TransactionHost<Prisma8TransactionalAdapter>>();
	const fallback = "runtime" in client ? createDatabaseContext(client) : client;
	Object.defineProperty(host, "tx", { get: () => active.getStore() ?? fallback });
	const uow: UnitOfWorkPort = {
		async run(work) {
			if (active.getStore() !== undefined || !("runtime" in client)) return work();
			return withDatabaseTransaction(client, (tx) => active.run(tx, work));
		},
	};
	return { txHost: host, uow };
}
