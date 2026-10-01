import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { Injectable } from "@nestjs/common";

import {
	EntitlementService,
	Resource,
} from "#api/shared/application/entitlement/entitlement.service";
import type { DatabaseService } from "#api/shared/infrastructure/database/database.service";

import type { TodoCategoryLimitReaderPort } from "../../application/ports/todo-category-limit-reader.port.js";

/**
 * 활성 카테고리 생성 트랜잭션에서 실시간 entitlement를 읽는 어댑터.
 */
@Injectable()
export class TodoCategoryLimitReaderAdapter implements TodoCategoryLimitReaderPort {
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<DatabaseService>>,
		private readonly entitlementService: EntitlementService,
	) {}

	async getMaxCountInTx(userId: string): Promise<number | null> {
		const { maxCount } = await this.entitlementService.getResourceLimitInTx(
			this.txHost.tx,
			userId,
			Resource.CATEGORY,
		);
		return maxCount;
	}
}
