import { ErrorCode } from "@aido/api/errors";
import { PLAN_CATALOG, QUOTA_METERS } from "@aido/api/vocabulary";

import { FixedClock } from "#test/doubles/platform/fixed-clock";
import {
  ACCESS_FIXTURE_NOW,
  type AccessUserInput,
} from "#test/fixtures/access/access-user.fixture";
import { createQuotaLedgerFixture } from "#test/fixtures/access/quota-ledger.fixture";

import { QUOTA_METER_FEATURES } from "../../domain/quotas.constants.js";
import { CheckQuotaRemainingUseCase } from "./check-quota-remaining.use-case.js";
import { GetMeteredFeatureQuotaUseCase } from "./get-metered-feature-quota.use-case.js";

function setup(input: AccessUserInput = {}) {
  const clock = new FixedClock(ACCESS_FIXTURE_NOW);
  const fixture = createQuotaLedgerFixture(input, undefined, { clock });
  const useCase = new CheckQuotaRemainingUseCase({
    getMeteredFeatureQuota: new GetMeteredFeatureQuotaUseCase({ ...fixture, clock }),
  });
  return { ...fixture, useCase };
}

describe("CheckQuotaRemainingUseCase — 남은 횟수 선검사", () => {
  it.each(QUOTA_METERS)(
    "%s 계량기는 카탈로그에서 그 계량기를 쓰는 기능의 한도로 확인한다",
    (meter) => {
      // When
      const feature = QUOTA_METER_FEATURES[meter];

      // Then
      expect(PLAN_CATALOG[feature].meter).toBe(meter);
    },
  );

  it("남은 AI 횟수가 0이면 차감하지 않고 AI_1303과 현재 한도를 준다", async () => {
    // Given
    const fixture = setup({ aiUsageCount: PLAN_CATALOG.AI_PARSE.free });

    // When
    const execution = fixture.useCase.execute({ userId: fixture.userId, meter: "AI_PLAN" });

    // Then
    await expect(execution).rejects.toMatchObject({
      errorCode: ErrorCode.AI_1303,
      details: {
        charged: false,
        featureQuota: {
          feature: "AI_PARSE",
          used: PLAN_CATALOG.AI_PARSE.free,
          remaining: 0,
          resetsAt: "2026-04-30T15:00:00.000Z",
        },
      },
    });
    expect(fixture.users.get(fixture.userId)?.aiUsageCount).toBe(PLAN_CATALOG.AI_PARSE.free);
  });

  it("녹음 정리 횟수를 다 쓰면 AI_1313이다", async () => {
    // Given
    const fixture = setup();
    fixture.quotaUsageRepository.setUsage({
      userId: fixture.userId,
      meter: "VOICE_NOTE",
      periodKey: "2026-M04",
      used: PLAN_CATALOG.VOICE_NOTE.free,
    });

    // When
    const execution = fixture.useCase.execute({ userId: fixture.userId, meter: "VOICE_NOTE" });

    // Then
    await expect(execution).rejects.toMatchObject({ errorCode: ErrorCode.AI_1313 });
  });

  it.each([
    { label: "남은 횟수가 있는 무료", input: { aiUsageCount: PLAN_CATALOG.AI_PARSE.free - 1 } },
    {
      label: "무료 한도를 넘긴 프리미엄",
      input: { subscriptionStatus: "ACTIVE", aiUsageCount: 50 },
    },
    {
      label: "공정 사용 상한 아래의 ADMIN",
      input: { role: "ADMIN", aiUsageCount: PLAN_CATALOG.AI_PARSE.fairUse.premium - 1 },
    },
  ])("$label 사용자는 통과한다", async ({ input }) => {
    // Given
    const fixture = setup(input);

    // When
    const execution = fixture.useCase.execute({ userId: fixture.userId, meter: "AI_PLAN" });

    // Then
    await expect(execution).resolves.toBeUndefined();
  });

  it.each([
    { label: "프리미엄", input: { subscriptionStatus: "ACTIVE" } },
    { label: "ADMIN", input: { role: "ADMIN" } },
  ])("$label이 공정 사용 상한에 닿으면 같은 AI_1303과 공정 사용 한도를 준다", async ({ input }) => {
    // Given
    const fairUse = PLAN_CATALOG.AI_PARSE.fairUse.premium;
    const fixture = setup({ ...input, aiUsageCount: fairUse });

    // When
    const execution = fixture.useCase.execute({ userId: fixture.userId, meter: "AI_PLAN" });

    // Then
    await expect(execution).rejects.toMatchObject({
      errorCode: ErrorCode.AI_1303,
      details: {
        charged: false,
        featureQuota: { limit: fairUse, used: fairUse, remaining: 0, isFairUse: true },
      },
    });
  });
});
