import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { Injectable } from "@nestjs/common";

import { Prisma } from "@/generated/prisma/client";
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
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<DatabaseService>>,
	) {}

	async acquire(keys: readonly string[]): Promise<void> {
		if (!this.txHost.isTransactionActive()) {
			throw new Error("Mutation lock requires an active transaction");
		}

		const orderedKeys = [...new Set(keys)].sort();
		if (orderedKeys.length === 0) {
			return;
		}

		// key 수와 무관하게 한 번 왕복합니다. 내부 정렬 subquery가 모든 호출자에게 같은
		// 잠금 순서를 주므로 여러 댓글을 정리해도 교착 회피 규칙은 유지됩니다.
		await this.txHost.tx.$queryRaw(Prisma.sql`
			WITH ordered AS MATERIALIZED (
				SELECT requested."key"
				FROM unnest(ARRAY[${Prisma.join(orderedKeys)}]::TEXT[]) AS requested("key")
				ORDER BY requested."key"
			)
			SELECT pg_advisory_xact_lock(hashtextextended(ordered."key", 0))::TEXT
			FROM ordered
			ORDER BY ordered."key"
		`);
	}
}
