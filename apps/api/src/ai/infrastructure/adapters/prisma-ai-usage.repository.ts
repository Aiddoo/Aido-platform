import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { Injectable } from "@nestjs/common";

import { now } from "@/shared/domain/date/utils/core";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import type {
	AiUsageRepositoryPort,
	AiUsageSnapshot,
} from "../../application/ports/ai-usage.repository.port";

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
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<DatabaseService>>,
	) {}

	async findUsage(userId: string): Promise<AiUsageSnapshot | null> {
		const row = await this.txHost.tx.user.findUnique({
			where: { id: userId },
			select: { aiUsageCount: true, aiUsageResetAt: true },
		});
		if (!row) {
			return null;
		}
		return { count: row.aiUsageCount, resetAt: row.aiUsageResetAt };
	}

	async increment(userId: string): Promise<void> {
		await this.txHost.tx.user.update({
			where: { id: userId },
			data: { aiUsageCount: { increment: 1 } },
		});
	}

	async resetAndIncrement(userId: string): Promise<void> {
		await this.txHost.tx.user.update({
			where: { id: userId },
			data: { aiUsageCount: 1, aiUsageResetAt: now() },
		});
	}

	async decrement(userId: string): Promise<void> {
		// 보상 감소는 활성 트랜잭션 밖에서 호출된다(CLS tx 없으면 베이스 클라이언트).
		// aiUsageCount > 0 조건으로 음수 방지, 중복 호출 시 matched row 0 no-op.
		await this.txHost.tx.user.updateMany({
			where: { id: userId, aiUsageCount: { gt: 0 } },
			data: { aiUsageCount: { decrement: 1 } },
		});
	}
}
