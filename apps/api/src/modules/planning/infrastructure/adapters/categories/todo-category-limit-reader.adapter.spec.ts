import { mock } from "vitest-mock-extended";

import type { EntitlementReaderPort } from "#api/modules/access/access-entitlement.public";

import { TodoCategoryLimitReaderAdapter } from "./todo-category-limit-reader.adapter.js";

describe("TodoCategoryLimitReaderAdapter", () => {
  it("잠금 안의 최신 권한으로 카테고리 한도를 읽는다", async () => {
    // Given
    const entitlementReader = mock<EntitlementReaderPort>();
    entitlementReader.limitOfInTx.mockResolvedValue(3);
    const adapter = new TodoCategoryLimitReaderAdapter(entitlementReader);

    // When
    const result = await adapter.getMaxCountInTx("user-123");

    // Then
    expect(result).toBe(3);
    expect(entitlementReader.limitOfInTx).toHaveBeenCalledWith("user-123", "TODO_CATEGORY");
  });
});
