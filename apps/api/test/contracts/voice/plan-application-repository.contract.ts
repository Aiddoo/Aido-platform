import { ErrorCode } from "@aido/api/errors";

import type { PlanApplicationRepositoryPort } from "#api/modules/voice/action-plans/application/ports/plan-application.repository.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  createPlanApplicationFixture,
  PLAN_APPLICATION_FIXTURE_NOW,
  PLAN_APPLICATION_FIXTURE_OTHER_USER_ID,
  PLAN_APPLICATION_FIXTURE_USER_ID,
} from "#test/fixtures/voice/plan-application.fixture";

const USER_ID = UserId.reconstitute(PLAN_APPLICATION_FIXTURE_USER_ID);
const OTHER_USER_ID = UserId.reconstitute(PLAN_APPLICATION_FIXTURE_OTHER_USER_ID);

export function describePlanApplicationRepositoryContract(
  createRepository: () => Promise<PlanApplicationRepositoryPort>,
): void {
  describe("계획 적용 기록 저장소 계약", () => {
    it("저장한 기록은 그 사용자의 같은 키로만 찾고 값을 그대로 돌려준다", async () => {
      // Given
      const repository = await createRepository();
      const application = createPlanApplicationFixture({ todoIds: [12, 3, 7], memoId: null });
      await repository.save(application);

      // When
      const found = await repository.findByIdempotencyKey(USER_ID, "apply-key-1");
      const otherKey = await repository.findByIdempotencyKey(USER_ID, "apply-key-2");
      const otherUser = await repository.findByIdempotencyKey(OTHER_USER_ID, "apply-key-1");

      // Then
      expect(found?.toPrimitives()).toEqual(application.toPrimitives());
      expect([otherKey, otherUser]).toEqual([null, null]);
    });

    it("같은 기록을 다시 저장해도 처음 기록을 그대로 둔다", async () => {
      // Given
      const repository = await createRepository();
      const application = createPlanApplicationFixture();
      await repository.save(application);

      // When
      await repository.save(application);

      // Then
      const found = await repository.findByIdempotencyKey(USER_ID, "apply-key-1");
      expect(found?.toPrimitives()).toEqual(application.toPrimitives());
    });

    it("같은 사용자·키로 다른 기록을 저장하면 처리 중(AI_1314)으로 거절하고 먼저 저장한 기록을 둔다", async () => {
      // Given
      const repository = await createRepository();
      const first = createPlanApplicationFixture();
      await repository.save(first);
      const second = createPlanApplicationFixture({
        id: "cplanapplication0000000002",
        requestHash: "b".repeat(64),
      });

      // When
      const result = repository.save(second);

      // Then
      await expect(result).rejects.toMatchObject({
        errorCode: ErrorCode.AI_1314,
        details: { charged: false },
      });
      const found = await repository.findByIdempotencyKey(USER_ID, "apply-key-1");
      expect(found?.id.value).toBe(first.id.value);
    });

    it("같은 키라도 사용자가 다르면 따로 저장한다", async () => {
      // Given
      const repository = await createRepository();
      await repository.save(createPlanApplicationFixture());
      const other = createPlanApplicationFixture({
        id: "cplanapplication0000000002",
        userId: PLAN_APPLICATION_FIXTURE_OTHER_USER_ID,
      });

      // When
      await repository.save(other);

      // Then
      const found = await repository.findByIdempotencyKey(OTHER_USER_ID, "apply-key-1");
      expect(found?.id.value).toBe(other.id.value);
    });

    it("기준 시각보다 먼저 만든 기록만 지우고 지운 수를 돌려준다", async () => {
      // Given
      const repository = await createRepository();
      const cutoff = PLAN_APPLICATION_FIXTURE_NOW;
      await repository.save(
        createPlanApplicationFixture({
          id: "cplanapplication0000000001",
          idempotencyKey: "older",
          createdAt: cutoff.subtract({ milliseconds: 1 }),
        }),
      );
      await repository.save(
        createPlanApplicationFixture({
          id: "cplanapplication0000000002",
          idempotencyKey: "at-cutoff",
          createdAt: cutoff,
        }),
      );
      await repository.save(
        createPlanApplicationFixture({
          id: "cplanapplication0000000003",
          idempotencyKey: "other-user-older",
          userId: PLAN_APPLICATION_FIXTURE_OTHER_USER_ID,
          createdAt: cutoff.subtract({ hours: 1 }),
        }),
      );

      // When
      const purgedCount = await repository.purgeCreatedBefore(cutoff);
      const purgedAgain = await repository.purgeCreatedBefore(cutoff);

      // Then
      expect([purgedCount, purgedAgain]).toEqual([2, 0]);
      expect(await repository.findByIdempotencyKey(USER_ID, "older")).toBeNull();
      expect(await repository.findByIdempotencyKey(USER_ID, "at-cutoff")).not.toBeNull();
    });
  });
}
