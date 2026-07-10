import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";

import {
	EntitlementService,
	Feature,
} from "@/shared/application/entitlement/entitlement.service";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import type { NudgeLimitReaderPort } from "../../application/ports/nudge-limit-reader.port";

/**
 * NudgeLimitReaderPort의 어댑터.
 *
 * 활성 트랜잭션 클라이언트(TransactionHost.tx)로 EntitlementService의 실시간(비캐시) 한도 조회를
 * 수행한다. 트랜잭션 클라이언트 접근이라는 인프라 관심사를 여기서 캡슐화한다(TOCTOU 방지).
 */
@Injectable()
export class NudgeLimitReaderAdapter implements NudgeLimitReaderPort {
	constructor(
		private readonly txHost: TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>,
		private readonly entitlementService: EntitlementService,
	) {}

	async getDailyLimitInTx(userId: string): Promise<number | null> {
		const { dailyLimit } = await this.entitlementService.getFeatureLimitInTx(
			this.txHost.tx,
			userId,
			Feature.NUDGE,
		);
		return dailyLimit;
	}
}
