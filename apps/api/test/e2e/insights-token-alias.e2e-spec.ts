import {
  WEEKLY_ACHIEVEMENT_WRITER,
  WeeklyAchievementWriterPort,
} from "#api/modules/insights/weekly-achievements/insights-weekly-achievements.public";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

describe("insights 옛 Symbol 토큰 별칭 (e2e)", () => {
  let ctx: E2eTestContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  }, 60_000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  it("주간 기록 writer의 옛 토큰과 클래스 토큰은 같은 인스턴스다", () => {
    // Given
    const app = ctx.module;

    // When
    const legacy = app.get(WEEKLY_ACHIEVEMENT_WRITER, { strict: false });
    const current = app.get(WeeklyAchievementWriterPort, { strict: false });

    // Then
    expect(legacy).toBe(current);
  });
});
