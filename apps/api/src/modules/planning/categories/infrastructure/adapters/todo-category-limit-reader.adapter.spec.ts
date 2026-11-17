import type { EntitlementReaderPort } from "#api/modules/access/entitlements/access-entitlements.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoCategoryLimitReaderAdapter } from "./todo-category-limit-reader.adapter.js";

type QuotaReader = Pick<
  EntitlementReaderPort,
  "getFeatureLimit" | "getFeatureLimitInTransaction" | "getFeatureQuotaInTransaction"
>;

// 받은 기능 이름·사용량을 남기고 정한 값을 돌려준다
class RecordingEntitlementReader implements QuotaReader {
  readonly limitReads: Parameters<QuotaReader["getFeatureLimitInTransaction"]>[] = [];
  readonly quotaReads: Parameters<QuotaReader["getFeatureQuotaInTransaction"]>[] = [];

  async getFeatureLimit(): Promise<number | null> {
    return null;
  }

  async getFeatureLimitInTransaction(
    ...parameters: Parameters<QuotaReader["getFeatureLimitInTransaction"]>
  ): Promise<number | null> {
    this.limitReads.push(parameters);
    return 3;
  }

  async getFeatureQuotaInTransaction(
    ...parameters: Parameters<QuotaReader["getFeatureQuotaInTransaction"]>
  ): ReturnType<QuotaReader["getFeatureQuotaInTransaction"]> {
    this.quotaReads.push(parameters);
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
    const result = await adapter.readLimitInTransaction(UserId.reconstitute("user-123"));

    // Then
    expect(result).toBe(3);
    expect(entitlementReader.limitReads).toEqual([
      [UserId.reconstitute("user-123"), "TODO_CATEGORY"],
    ]);
  });

  it("한도 오류 featureQuota는 현재 개수를 resource 사용량으로 넘겨 계산한다", async () => {
    // Given
    const entitlementReader = new RecordingEntitlementReader();
    const adapter = new TodoCategoryLimitReaderAdapter(entitlementReader);

    // When
    await adapter.readFeatureQuotaInTransaction(UserId.reconstitute("user-123"), 3);

    // Then
    expect(entitlementReader.quotaReads).toEqual([
      [UserId.reconstitute("user-123"), "TODO_CATEGORY", { used: 3, resetsAt: null }],
    ]);
  });
});
