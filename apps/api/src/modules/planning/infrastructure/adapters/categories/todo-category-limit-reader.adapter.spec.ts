import { mock } from "vitest-mock-extended";

import type { EntitlementReaderPort } from "#api/modules/access/access-entitlement.public";

import { TodoCategoryLimitReaderAdapter } from "./todo-category-limit-reader.adapter.js";

describe("TodoCategoryLimitReaderAdapter", () => {
  it("잠금 안의 최신 권한으로 카테고리 한도를 읽는다", async () => {
    // Given
    const entitlementReader = mock<EntitlementReaderPort>();
    entitlementReader.getLimitInTx.mockResolvedValue(3);
    const adapter = new TodoCategoryLimitReaderAdapter(entitlementReader);

    // When
    const result = await adapter.getMaxCountInTx("user-123");

    // Then
    expect(result).toBe(3);
    expect(entitlementReader.getLimitInTx).toHaveBeenCalledWith("user-123", "TODO_CATEGORY");
  });

  it("한도 오류 featureQuota는 현재 개수를 resource 사용량으로 넘겨 계산한다", async () => {
    // Given
    const entitlementReader = mock<EntitlementReaderPort>();
    const adapter = new TodoCategoryLimitReaderAdapter(entitlementReader);

    // When
    await adapter.readQuotaInTx("user-123", 3);

    // Then
    expect(entitlementReader.readFeatureQuotaInTx).toHaveBeenCalledWith(
      "user-123",
      "TODO_CATEGORY",
      {
        used: 3,
        resetsAt: null,
      },
    );
  });
});
