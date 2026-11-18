import { ErrorCode } from "@aido/api/errors";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  AI_ASSISTANCE_TODAY,
  createAiAssistanceFixture,
  withAiAssistanceTime,
} from "#test/fixtures/ai-assistance/ai-assistance-scenario.fixture";
import { createSuggestionAnalysisRunFixture } from "#test/fixtures/ai-assistance/suggestion-analysis-run.fixture";

import { SuggestionLockKeys } from "../suggestions.lock-keys.js";

type Fixture = ReturnType<typeof createAiAssistanceFixture>;

async function findRun(f: Fixture) {
  return (await f.runs.findByUserId(UserId.reconstitute(f.userId)))?.toPrimitives();
}

describe("RequestSuggestionAnalysisUseCase", () => {
  it.each([
    {
      name: "무료 사용자",
      arrange: (f: Fixture) => {
        f.access.subscriptionStatus = "FREE";
      },
    },
    {
      name: "구독이 끝난 사용자",
      arrange: (f: Fixture) => {
        f.access.subscriptionStatus = "EXPIRED";
      },
    },
  ])("$name는 AI_1309로 거절하고 실행 기록·job을 만들지 않는다", ({ arrange }) =>
    withAiAssistanceTime(async () => {
      // Given
      const f = createAiAssistanceFixture();
      arrange(f);

      // When
      const result = f.request.execute({ userId: f.userId });

      // Then
      await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.AI_1309 });
      expect(f.enqueuer.jobs).toEqual([]);
      expect(await findRun(f)).toBeUndefined();
    }),
  );

  it.each([
    {
      name: "기능이 꺼져 있으면",
      arrange: async (f: Fixture) => {
        f.onDemandConfig.isEnabled = false;
      },
      state: "WAITING_FOR_NEXT_RUN",
    },
    {
      name: "최근 단건 할 일이 없으면",
      arrange: async (f: Fixture) => {
        f.todoCountReader.count = 0;
      },
      state: "NEEDS_MORE_TODOS",
    },
    {
      name: "오늘 이미 아침 배치로 분석했으면",
      arrange: async (f: Fixture) => {
        await f.runs.save(
          createSuggestionAnalysisRunFixture({
            userId: f.userId,
            localDate: AI_ASSISTANCE_TODAY,
            status: "FINISHED",
            outcome: "NO_PATTERN_FOUND",
            queuedAt: Temporal.Instant.from("2026-03-22T00:00:00Z"),
          }),
        );
      },
      state: "NO_PATTERN_FOUND",
    },
  ])("$name job 없이 지금 상태($state)를 준다", ({ arrange, state }) =>
    withAiAssistanceTime(async () => {
      // Given
      const f = createAiAssistanceFixture();
      await arrange(f);
      const before = await findRun(f);

      // When
      const analysis = await f.request.execute({ userId: f.userId });

      // Then
      expect(analysis).toMatchObject({ state, canRequestNow: false });
      expect(f.enqueuer.jobs).toEqual([]);
      expect(await findRun(f)).toEqual(before);
    }),
  );

  it("어제 분석한 사용자는 잠금 뒤 오늘 실행 기록을 QUEUED로 바꾸고 같은 하루 key의 job 1개를 넣는다", () =>
    withAiAssistanceTime(async () => {
      // Given
      const f = createAiAssistanceFixture();
      await f.runs.save(
        createSuggestionAnalysisRunFixture({
          userId: f.userId,
          localDate: AI_ASSISTANCE_TODAY.subtract({ days: 1 }),
          status: "FINISHED",
          outcome: "SUGGESTIONS_CREATED",
        }),
      );

      // When
      const analysis = await f.request.execute({ userId: f.userId });

      // Then
      expect(analysis).toMatchObject({ state: "ANALYZING", canRequestNow: false });
      expect(f.unitOfWork.runs).toBe(1);
      expect(f.mutationLock.acquiredKeys).toEqual([
        [SuggestionLockKeys.analysisRun(UserId.reconstitute(f.userId))],
      ]);
      expect(f.enqueuer.jobs).toEqual([
        {
          userId: UserId.reconstitute(f.userId),
          localDate: AI_ASSISTANCE_TODAY,
          trigger: "ON_DEMAND",
          timeZone: "Asia/Seoul",
        },
      ]);
      expect(await findRun(f)).toMatchObject({
        status: "QUEUED",
        localDate: AI_ASSISTANCE_TODAY,
        trigger: "ON_DEMAND",
        outcome: null,
      });
    }));

  it("실행 기록이 없는 사용자도 처음 요청하면 기록을 만들고 job 1개를 넣는다", () =>
    withAiAssistanceTime(async () => {
      // Given
      const f = createAiAssistanceFixture();

      // When
      await f.request.execute({ userId: f.userId });
      const again = await f.request.execute({ userId: f.userId });

      // Then
      expect(again).toMatchObject({ state: "ANALYZING" });
      expect(f.enqueuer.jobs).toHaveLength(1);
      expect(await findRun(f)).toMatchObject({ status: "QUEUED", trigger: "ON_DEMAND" });
    }));
});
