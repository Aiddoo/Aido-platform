import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";

import type { MutationLockPort } from "@/shared/application/ports";
import type { DatabaseService } from "./database.service";

/**
 * PostgreSQL transaction advisory lock 어댑터.
 *
 * 논리 키는 중복 제거 후 사전순으로 정렬해 교착을 방지한다. 각 키는 활성
 * TransactionHost.tx 연결에서 PostgreSQL이 직접 64-bit 해시하고, 트랜잭션
 * 종료 시 자동 해제되는 pg_advisory_xact_lock으로 획득한다.
 */
@Injectable()
export class PostgresMutationLockAdapter implements MutationLockPort {
	constructor(
		private readonly txHost: TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>,
	) {}

	async acquire(keys: readonly string[]): Promise<void> {
		const orderedKeys = [...new Set(keys)].sort();
		for (const key of orderedKeys) {
			await this.txHost.tx
				.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
		}
	}
}
