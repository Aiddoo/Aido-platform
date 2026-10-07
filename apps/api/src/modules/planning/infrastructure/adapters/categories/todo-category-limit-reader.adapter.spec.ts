import { mock } from "vitest-mock-extended";

import {
  type EntitlementReaderPort,
  Resource,
} from "#api/modules/access/access-entitlement.public";

import { TodoCategoryLimitReaderAdapter } from "./todo-category-limit-reader.adapter.js";

describe("TodoCategoryLimitReaderAdapter", () => {
  it("txHost의 활성 트랜잭션 클라이언트로 CATEGORY 한도를 읽는다", async () => {
    // Given - base/cache 경로와 구별되는 활성 트랜잭션 클라이언트

    const entitlementReader = mock<EntitlementReaderPort>();
    entitlementReader.getResourceLimitInTx.mockResolvedValue({
      maxCount: 3,
      isAdmin: false,
      subscriptionStatus: "FREE",
    });
    const adapter = new TodoCategoryLimitReaderAdapter(entitlementReader);

    // When
    const result = await adapter.getMaxCountInTx("user-123");

    // Then - 어댑터가 정확히 txHost.tx를 전달하고 maxCount만 반환
    expect(result).toBe(3);
    expect(entitlementReader.getResourceLimitInTx).toHaveBeenCalledTimes(1);
    expect(entitlementReader.getResourceLimitInTx).toHaveBeenCalledWith(
      "user-123",
      Resource.CATEGORY,
    );
  });
});
