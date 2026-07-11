import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { UserRepository } from "../../../auth/infrastructure/persistence/user.repository";
import type {
	AiUsageRepositoryPort,
	AiUsageSnapshot,
} from "../../application/ports/ai-usage.repository.port";

/**
 * AiUsageRepositoryPort의 Prisma 어댑터.
 *
 * 사용량은 User 테이블 컬럼(aiUsageCount·aiUsageResetAt)에 저장되므로, auth의
 * UserRepository에 위임한다(미이관 의존 → 위임 어댑터 패턴). 트랜잭션은 CLS로
 * 전파되어 TransactionHost.tx가 활성 트랜잭션(없으면 베이스)을 반환한다.
 */
@Injectable()
export class PrismaAiUsageRepository implements AiUsageRepositoryPort {
	constructor(
		private readonly txHost: TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>,
		private readonly userRepository: UserRepository,
	) {}

	async findUsage(userId: string): Promise<AiUsageSnapshot | null> {
		const row = await this.userRepository.findAiUsage(userId, this.txHost.tx);
		if (!row) {
			return null;
		}
		return { count: row.aiUsageCount, resetAt: row.aiUsageResetAt };
	}

	async increment(userId: string): Promise<void> {
		await this.userRepository.incrementAiUsage(userId, this.txHost.tx);
	}

	async resetAndIncrement(userId: string): Promise<void> {
		await this.userRepository.resetAndIncrementAiUsage(userId, this.txHost.tx);
	}

	async decrement(userId: string): Promise<void> {
		// 보상 감소는 트랜잭션 밖에서 실행되어야 하므로 tx를 전달하지 않는다.
		await this.userRepository.decrementAiUsage(userId);
	}
}
