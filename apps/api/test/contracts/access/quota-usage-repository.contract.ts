import type { QuotaMeter } from "@aido/api/vocabulary";

import type { QuotaUsageRepositoryPort } from "#api/modules/access/quotas/application/ports/quota-usage.repository.port";
import { QuotaWindow } from "#api/modules/access/shared/domain/quota-window.vo";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  ACCESS_FIXTURE_NOW,
  ACCESS_FIXTURE_OTHER_USER_ID,
  ACCESS_FIXTURE_USER_ID,
} from "#test/fixtures/access/access-user.fixture";

const NOW = ACCESS_FIXTURE_NOW;
const USER_ID = UserId.reconstitute(ACCESS_FIXTURE_USER_ID);
const OTHER_USER_ID = UserId.reconstitute(ACCESS_FIXTURE_OTHER_USER_ID);
const APRIL = QuotaWindow.create(NOW);
// KST 5월 1일 00:00
const MAY_START = Temporal.Instant.from("2026-04-30T15:00:00Z");
const MAY = QuotaWindow.create(MAY_START);

interface SeedQuotaUserInput {
  readonly id: string;
  /** User.aiUsageCount·aiUsageResetAt(AI_PLAN 카운터) */
  readonly aiUsageCount: number;
  readonly aiUsageResetAt: Temporal.Instant;
}

export interface QuotaUsageRepositoryHarness {
  readonly repository: QuotaUsageRepositoryPort;
  seedUser(input: SeedQuotaUserInput): Promise<void>;
}

export function describeQuotaUsageRepositoryContract(
  createHarness: () => Promise<QuotaUsageRepositoryHarness>,
): void {
  describe("계량기 사용량 저장소 계약", () => {
    async function given(
      aiUsage: { count: number; resetAt: Temporal.Instant } = { count: 0, resetAt: NOW },
    ) {
      const harness = await createHarness();
      await harness.seedUser({
        id: ACCESS_FIXTURE_USER_ID,
        aiUsageCount: aiUsage.count,
        aiUsageResetAt: aiUsage.resetAt,
      });
      await harness.seedUser({
        id: ACCESS_FIXTURE_OTHER_USER_ID,
        aiUsageCount: 0,
        aiUsageResetAt: NOW,
      });
      return harness.repository;
    }

    it("녹음 정리는 기간·사용자마다 한도 안에서만 더하고 기록이 없으면 0이다", async () => {
      // Given
      const repository = await given();
      const add = (userId: UserId, window: QuotaWindow) =>
        repository.addUsageWithinLimit({
          userId,
          meter: "VOICE_NOTE",
          window,
          amount: 1,
          limit: 2,
          now: NOW,
        });

      // When
      const results = [
        await add(USER_ID, APRIL),
        await add(USER_ID, APRIL),
        await add(USER_ID, APRIL),
        await add(OTHER_USER_ID, APRIL),
        await add(USER_ID, MAY),
      ];

      // Then
      expect(results).toEqual([true, true, false, true, true]);
      expect(
        await repository.countUsage({ userId: USER_ID, meter: "VOICE_NOTE", window: APRIL }),
      ).toBe(2);
      expect(
        await repository.countUsage({ userId: USER_ID, meter: "VOICE_NOTE", window: MAY }),
      ).toBe(1);
      expect(
        await repository.countUsage({ userId: OTHER_USER_ID, meter: "AI_PLAN", window: APRIL }),
      ).toBe(0);
    });

    it("limit null은 무제한이고 한 번에 한도보다 큰 양은 더하지 않는다", async () => {
      // Given
      const repository = await given();

      // When
      const unlimited = await repository.addUsageWithinLimit({
        userId: USER_ID,
        meter: "VOICE_NOTE",
        window: APRIL,
        amount: 50,
        limit: null,
        now: NOW,
      });
      const tooLarge = await repository.addUsageWithinLimit({
        userId: OTHER_USER_ID,
        meter: "VOICE_NOTE",
        window: APRIL,
        amount: 3,
        limit: 2,
        now: NOW,
      });

      // Then
      expect([unlimited, tooLarge]).toEqual([true, false]);
      expect(
        await repository.countUsage({ userId: USER_ID, meter: "VOICE_NOTE", window: APRIL }),
      ).toBe(50);
    });

    it("AI_PLAN은 사용자 카운터를 세고 지난 기간에 기록됐으면 0으로 보고 새 기간 첫 사용 시각을 남긴다", async () => {
      // Given
      const repository = await given({ count: 7, resetAt: NOW });

      // When
      const april = await repository.countUsage({
        userId: USER_ID,
        meter: "AI_PLAN",
        window: APRIL,
      });
      const may = await repository.countUsage({ userId: USER_ID, meter: "AI_PLAN", window: MAY });
      const added = await repository.addUsageWithinLimit({
        userId: USER_ID,
        meter: "AI_PLAN",
        window: MAY,
        amount: 1,
        limit: 1,
        now: MAY_START,
      });
      const full = await repository.addUsageWithinLimit({
        userId: USER_ID,
        meter: "AI_PLAN",
        window: MAY,
        amount: 1,
        limit: 1,
        now: MAY_START,
      });

      // Then
      expect([april, may, added, full]).toEqual([7, 0, true, false]);
      expect(await repository.countUsage({ userId: USER_ID, meter: "AI_PLAN", window: MAY })).toBe(
        1,
      );
      expect(
        await repository.countUsage({ userId: USER_ID, meter: "AI_PLAN", window: APRIL }),
      ).toBe(0);
    });

    it("빼기는 같은 기간이고 남은 양이 있을 때만 적용한다", async () => {
      // Given
      const repository = await given({ count: 1, resetAt: NOW });
      await repository.addUsageWithinLimit({
        userId: USER_ID,
        meter: "VOICE_NOTE",
        window: APRIL,
        amount: 1,
        limit: null,
        now: NOW,
      });
      const subtract = (meter: QuotaMeter, periodKey: string, amount: number) =>
        repository.subtractUsage({ userId: USER_ID, meter, periodKey, amount, now: NOW });

      // When
      const results = [
        await subtract("AI_PLAN", MAY.periodKey, 1),
        await subtract("AI_PLAN", APRIL.periodKey, 2),
        await subtract("AI_PLAN", APRIL.periodKey, 1),
        await subtract("VOICE_NOTE", MAY.periodKey, 1),
        await subtract("VOICE_NOTE", APRIL.periodKey, 1),
        await subtract("VOICE_NOTE", APRIL.periodKey, 1),
      ];

      // Then
      expect(results).toEqual([false, false, true, false, true, false]);
      expect(
        await repository.countUsage({ userId: USER_ID, meter: "AI_PLAN", window: APRIL }),
      ).toBe(0);
      expect(
        await repository.countUsage({ userId: USER_ID, meter: "VOICE_NOTE", window: APRIL }),
      ).toBe(0);
    });
  });
}
