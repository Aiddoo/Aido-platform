import { mock } from "vitest-mock-extended";

import {
  EntitlementService,
  Resource,
} from "#api/modules/access/application/services/entitlement/entitlement.service";

import { TodoCategoryLimitReaderAdapter } from "./todo-category-limit-reader.adapter.js";

describe("TodoCategoryLimitReaderAdapter", () => {
  it("txHost의 활성 트랜잭션 클라이언트로 CATEGORY 한도를 읽는다", async () => {
    // Given - base/cache 경로와 구별되는 활성 트랜잭션 클라이언트

    const entitlementService = mock<EntitlementService>();
    entitlementService.getResourceLimitInTx.mockResolvedValue({
      maxCount: 3,
      isAdmin: false,
      subscriptionStatus: "FREE",
    });
    const adapter = new TodoCategoryLimitReaderAdapter(entitlementService);

    // When
    const result = await adapter.getMaxCountInTx("user-123");

    // Then - 어댑터가 정확히 txHost.tx를 전달하고 maxCount만 반환
    expect(result).toBe(3);
    expect(entitlementService.getResourceLimitInTx).toHaveBeenCalledTimes(1);
    expect(entitlementService.getResourceLimitInTx).toHaveBeenCalledWith(
      "user-123",
      Resource.CATEGORY,
    );
  });
});
