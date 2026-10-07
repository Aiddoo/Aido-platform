import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { EntitlementService } from "#api/modules/access/application/services/entitlement/entitlement.service";

import { type AiUsageRepositoryPort } from "../../ports/parsing/ai-usage.repository.port.js";
import { GetAiUsage } from "./get-ai-usage.use-case.js";

describe("GetAiUsage — AI 사용량 조회 use-case", () => {
  let useCase: GetAiUsage;
  let repository: Mocked<AiUsageRepositoryPort>;
  let entitlement: Mocked<EntitlementService>;

  beforeEach(async () => {
    const getAiUsageDependencies = mockDeep<ConstructorParameters<typeof GetAiUsage>[0]>({});
    const unit = new GetAiUsage(getAiUsageDependencies);
    useCase = unit;
    repository = getAiUsageDependencies.repository;
    entitlement = getAiUsageDependencies.entitlementService;

    entitlement.getFeatureLimit.mockResolvedValue({
      dailyLimit: 5,
      isAdmin: false,
      subscriptionStatus: "",
    });
  });

  it("같은 달이면 실제 카운트와 한도를 반환한다", async () => {
    repository.findUsage.mockResolvedValue({ count: 3, resetAt: new Date() });

    const usage = await useCase.execute({ userId: "user-1" });

    expect(usage.used).toBe(3);
    expect(usage.limit).toBe(5);
    expect(usage.resetsAt).toEqual(expect.any(String));
  });

  it("새로운 달이면 used=0으로 표시한다", async () => {
    repository.findUsage.mockResolvedValue({
      count: 5,
      resetAt: new Date("2020-01-01T00:00:00.000Z"),
    });

    const usage = await useCase.execute({ userId: "user-1" });

    expect(usage.used).toBe(0);
  });

  it("사용자가 없으면 USER_0601을 던진다", async () => {
    repository.findUsage.mockResolvedValue(null);

    await expect(useCase.execute({ userId: "user-1" })).rejects.toMatchObject({
      errorCode: "USER_0601",
    });
  });
});
