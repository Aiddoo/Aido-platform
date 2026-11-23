import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  AI_ASSISTANCE_TODAY,
  createAiAssistanceFixture,
} from "#test/fixtures/ai-assistance/ai-assistance-scenario.fixture";
import { createSuggestionAnalysisRunFixture } from "#test/fixtures/ai-assistance/suggestion-analysis-run.fixture";

import { SuggestionLockKeys } from "../suggestions.lock-keys.js";

const REQUESTED_TODAY = UserId.reconstitute("requested-today");
const ANALYZED_YESTERDAY = UserId.reconstitute("analyzed-yesterday");
const FIRST_TIME = UserId.reconstitute("first-time");

describe("DispatchSuggestionAnalysesUseCase", () => {
  it("오늘 이미 요청받은 사람은 빼고 나머지만 실행 기록을 남기고 한 번에 큐에 넣는다", async () => {
    // Given
    const f = createAiAssistanceFixture();
    await f.runs.saveMany([
      createSuggestionAnalysisRunFixture({
        userId: REQUESTED_TODAY.value,
        localDate: AI_ASSISTANCE_TODAY,
        trigger: "ON_DEMAND",
        status: "FINISHED",
        outcome: "SUGGESTIONS_CREATED",
      }),
      createSuggestionAnalysisRunFixture({
        userId: ANALYZED_YESTERDAY.value,
        localDate: AI_ASSISTANCE_TODAY.subtract({ days: 1 }),
        status: "FINISHED",
        outcome: "NO_PATTERN_FOUND",
      }),
    ]);
    const targets = [REQUESTED_TODAY, ANALYZED_YESTERDAY, FIRST_TIME].map((userId) => ({
      userId,
      timezone: "Asia/Seoul",
    }));

    // When
    const enqueuedCount = await f.dispatch.execute({ targets });

    // Then
    expect(enqueuedCount).toBe(2);
    expect(f.unitOfWork.runs).toBe(1);
    expect(f.mutationLock.acquiredKeys).toEqual([
      targets.map(({ userId }) => SuggestionLockKeys.analysisRun(userId)),
    ]);
    expect(f.enqueuer.batchSizes).toEqual([2]);
    expect(f.enqueuer.jobs).toEqual([
      expect.objectContaining({ userId: ANALYZED_YESTERDAY, localDate: AI_ASSISTANCE_TODAY }),
      expect.objectContaining({ userId: FIRST_TIME, localDate: AI_ASSISTANCE_TODAY }),
    ]);
    const runs = await f.runs.listByUserIds(targets.map(({ userId }) => userId));
    expect(runs.map((run) => run.toPrimitives())).toEqual([
      expect.objectContaining({ userId: REQUESTED_TODAY.value, trigger: "ON_DEMAND" }),
      expect.objectContaining({
        userId: ANALYZED_YESTERDAY.value,
        status: "QUEUED",
        trigger: "SCHEDULED",
        localDate: AI_ASSISTANCE_TODAY,
      }),
      expect.objectContaining({ userId: FIRST_TIME.value, status: "QUEUED" }),
    ]);
  });
});
