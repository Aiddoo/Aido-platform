import type { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { mock, mockDeep } from "jest-mock-extended";
import {
	EntitlementService,
	Resource,
} from "@/shared/application/entitlement/entitlement.service";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";
import type { TransactionClient } from "@/shared/infrastructure/database/prisma.types";
import { TodoCategoryLimitReaderAdapter } from "./todo-category-limit-reader.adapter";

describe("TodoCategoryLimitReaderAdapter", () => {
	it("txHost의 활성 트랜잭션 클라이언트로 CATEGORY 한도를 읽는다", async () => {
		// Given - base/cache 경로와 구별되는 활성 트랜잭션 클라이언트
		const txClient = mockDeep<TransactionClient>();
		const txHost =
			mock<TransactionHost<TransactionalAdapterPrisma<DatabaseService>>>();
		Object.defineProperty(txHost, "tx", { value: txClient });
		const entitlementService = mock<EntitlementService>();
		entitlementService.getResourceLimitInTx.mockResolvedValue({
			maxCount: 3,
			isAdmin: false,
			subscriptionStatus: "FREE",
		});
		const adapter = new TodoCategoryLimitReaderAdapter(
			txHost,
			entitlementService,
		);

		// When
		const result = await adapter.getMaxCountInTx("user-123");

		// Then - 어댑터가 정확히 txHost.tx를 전달하고 maxCount만 반환
		expect(result).toBe(3);
		expect(entitlementService.getResourceLimitInTx).toHaveBeenCalledTimes(1);
		expect(entitlementService.getResourceLimitInTx).toHaveBeenCalledWith(
			txClient,
			"user-123",
			Resource.CATEGORY,
		);
	});
});
