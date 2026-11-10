import type { EntitlementReaderPort } from "#api/modules/access/access-entitlement.public";

import { TodoCategoryLimitReaderAdapter } from "./todo-category-limit-reader.adapter.js";

type QuotaReader = Pick<
  EntitlementReaderPort,
  "getLimit" | "getLimitInTx" | "readFeatureQuotaInTx"
>;

// 받은 기능 이름·사용량을 남기고 정한 값을 돌려준다
class RecordingEntitlementReader implements QuotaReader {
  readonly limitReads: Parameters<QuotaReader["getLimitInTx"]>[] = [];
  readonly quotaReads: Parameters<QuotaReader["readFeatureQuotaInTx"]>[] = [];

  async getLimit(): Promise<number | null> {
    return null;
  }

  async getLimitInTx(...args: Parameters<QuotaReader["getLimitInTx"]>): Promise<number | null> {
    this.limitReads.push(args);
    return 3;
  }

  async readFeatureQuotaInTx(
    ...args: Parameters<QuotaReader["readFeatureQuotaInTx"]>
  ): ReturnType<QuotaReader["readFeatureQuotaInTx"]> {
    this.quotaReads.push(args);
    return {
      feature: "TODO_CATEGORY",
      allowed: true,
      limit: 3,
      used: 3,
      remaining: 0,
      period: null,
      resetsAt: null,
      isFairUse: false,
      perUse: null,
    };
  }
}

describe("TodoCategoryLimitReaderAdapter", () => {
  it("잠금 안의 최신 권한으로 카테고리 한도를 읽는다", async () => {
    // Given
    const entitlementReader = new RecordingEntitlementReader();
    const adapter = new TodoCategoryLimitReaderAdapter(entitlementReader);

    // When
    const result = await adapter.getMaxCountInTx("user-123");

    // Then
    expect(result).toBe(3);
    expect(entitlementReader.limitReads).toEqual([["user-123", "TODO_CATEGORY"]]);
  });

  it("한도 오류 featureQuota는 현재 개수를 resource 사용량으로 넘겨 계산한다", async () => {
    // Given
    const entitlementReader = new RecordingEntitlementReader();
    const adapter = new TodoCategoryLimitReaderAdapter(entitlementReader);

    // When
    await adapter.readQuotaInTx("user-123", 3);

    // Then
    expect(entitlementReader.quotaReads).toEqual([
      ["user-123", "TODO_CATEGORY", { used: 3, resetsAt: null }],
    ]);
  });
});
