import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { InMemoryPlanApplicationRepository } from "#test/doubles/voice/in-memory-plan-application.repository";
import {
  createPlanApplicationFixture,
  PLAN_APPLICATION_FIXTURE_NOW,
} from "#test/fixtures/voice/plan-application.fixture";

import { PurgePlanApplicationsUseCase } from "./purge-plan-applications.use-case.js";

const NOW = PLAN_APPLICATION_FIXTURE_NOW;

describe("PurgePlanApplicationsUseCase — 적용 멱등 기록 정리", () => {
  it("만든 지 7일이 넘은 기록만 지우고 지운 수를 돌려준다", async () => {
    // Given
    const repository = new InMemoryPlanApplicationRepository();
    const created = [
      { key: "recent", createdAt: NOW.subtract({ hours: 24 }) },
      { key: "just-seven-days", createdAt: NOW.subtract({ hours: 7 * 24 }) },
      { key: "old", createdAt: NOW.subtract({ hours: 7 * 24, milliseconds: 1 }) },
    ];
    for (const [index, { key, createdAt }] of created.entries()) {
      await repository.save(
        createPlanApplicationFixture({
          id: `cplanapplication000000000${index}`,
          idempotencyKey: key,
          createdAt,
        }),
      );
    }
    const useCase = new PurgePlanApplicationsUseCase({
      planApplicationRepository: repository,
      clock: new FixedClock(NOW),
      logger: new SilentLogger(),
    });

    // When
    const purgedCount = await useCase.execute();

    // Then
    expect(purgedCount).toBe(1);
    expect(
      repository.saved.map((application) => application.toPrimitives().idempotencyKey),
    ).toEqual(["recent", "just-seven-days"]);
  });
});
