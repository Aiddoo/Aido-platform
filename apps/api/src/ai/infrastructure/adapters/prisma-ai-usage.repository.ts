import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import { now } from "#api/shared/domain/date/utils/core";
import { decodeRecord, encodePatch } from "#api/shared/infrastructure/database/database-records";
import { databaseTimestamp } from "#api/shared/infrastructure/database/database-values";
import { requireRecord } from "#api/shared/infrastructure/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/shared/infrastructure/database/prisma8-transactional.adapter";

import type {
	AiUsageRepositoryPort,
	AiUsageSnapshot,
} from "../../application/ports/ai-usage.repository.port.js";

/**
 * AiUsageRepositoryPort의 Prisma 어댑터.
 *
 * 사용량은 User 테이블 컬럼(aiUsageCount·aiUsageResetAt)에 저장되지만, AI 사용량
 * 추적은 ai 모듈의 바운디드 컨텍스트 관심사이므로 물리적 위치와 무관하게 ai가 직접
 * 소유한다. 트랜잭션은 CLS로 전파되어 TransactionHost.tx가 활성 트랜잭션(없으면
 * 베이스 클라이언트)을 반환한다.
 */
@Injectable()
export class PrismaAiUsageRepository implements AiUsageRepositoryPort {
	constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

	async findUsage(userId: string): Promise<AiUsageSnapshot | null> {
		const row = decodeRecord(
			"User",
			await this.txHost.tx.orm.public.User.where((row) => row.id.eq(userId))
				.select("aiUsageCount", "aiUsageResetAt")
				.first(),
		);
		if (!row) {
			return null;
		}
		return { count: row.aiUsageCount, resetAt: row.aiUsageResetAt };
	}

	async increment(userId: string): Promise<void> {
		decodeRecord(
			"User",
			requireRecord(
				await this.txHost.tx
					.query(
						this.txHost.tx.sql.public.User.update((fields) => ({
							aiUsageCount: this.txHost.tx.raw.sql`${fields.aiUsageCount} + ${1}`.returns(
								"pg/int4@1",
							),
							updatedAt: this.txHost.tx.raw.sql`${databaseTimestamp(new Date())}`.returns(
								"pg/timestamp-string@1",
							),
						}))
							.where((fields, functions) => functions.eq(fields.id, userId))
							.returning("id")
							.build(),
					)
					.then((rows) => rows[0] ?? null),
			),
		);
	}

	async resetAndIncrement(userId: string): Promise<void> {
		decodeRecord(
			"User",
			requireRecord(
				await this.txHost.tx.orm.public.User.where((row) => row.id.eq(userId)).update(
					encodePatch("User", { aiUsageCount: 1, aiUsageResetAt: now() }),
				),
			),
		);
	}

	async decrement(userId: string): Promise<void> {
		// 보상 감소는 활성 트랜잭션 밖에서 호출된다(CLS tx 없으면 베이스 클라이언트).
		// aiUsageCount > 0 조건으로 음수 방지, 중복 호출 시 matched row 0 no-op.
		await this.txHost.tx
			.execute(
				this.txHost.tx.sql.public.User.update((fields) => ({
					aiUsageCount: this.txHost.tx.raw.sql`${fields.aiUsageCount} - ${1}`.returns("pg/int4@1"),
					updatedAt: this.txHost.tx.raw.sql`${databaseTimestamp(new Date())}`.returns(
						"pg/timestamp-string@1",
					),
				}))
					.where((fields, functions) =>
						functions.and(functions.eq(fields.id, userId), functions.gt(fields.aiUsageCount, 0)),
					)
					.build(),
			)
			.then((result) => result.affectedRows);
	}
}
