import { assert } from "vitest";

import {
  createAiAssistanceFixture,
  createAnalysisTodo,
  createSuggestionPick,
  pauseAiResponse,
  seedPendingSuggestion,
  usePickResponse,
  withAiAssistanceTime,
} from "#test/fixtures/ai-assistance.fixture";
import { weatherForecastFixture } from "#test/fixtures/weather.fixture";
import { createAiGenerationError } from "#test/mocks/fake-ai.generator";

import { Suggestion } from "../../domain/suggestion.aggregate.js";

const SEOUL_GRID = { gridX: 60, gridY: 127, lat: 37.5, lon: 127 };

// 고정 기록: "책 읽기 10분"(독서, 카테고리 7)을 2026-03-02·09·16(월) 세 번 완료
describe("AnalyzeAndCreateSuggestionsUseCase", () => {
  it.each(["USER", "ADMIN"])(
    "활성 %s의 실제 근거 제안은 pending을 교체하고 응답 이력을 유지한다",
    (role) =>
      withAiAssistanceTime(async () => {
        // Given
        const f = usePickResponse(createAiAssistanceFixture());
        f.access.role = role;
        if (role === "ADMIN") {
          f.access.subscriptionStatus = "FREE";
        }
        seedPendingSuggestion(f);
        seedPendingSuggestion(f, 2);
        seedPendingSuggestion(f, 3);
        const respondedSuggestion = f.repository.primitivesOf(2);
        const expiredSuggestion = f.repository.primitivesOf(3);
        assert.exists(respondedSuggestion);
        assert.exists(expiredSuggestion);
        f.repository.seed(Suggestion.reconstitute({ ...respondedSuggestion, status: "ACCEPTED" }));
        f.repository.seed(
          Suggestion.reconstitute({
            ...expiredSuggestion,
            expiresAt: Temporal.Instant.from("2026-03-01T00:00:00Z"),
          }),
        );
        // When
        const count = await f.analyze.execute({ userId: f.userId, timezone: "Asia/Seoul" });
        // Then
        expect(count).toBe(1);
        expect(f.repository.created[0]).toMatchObject({
          title: "책 읽기 10분",
          suggestedCategoryId: 7,
          scheduledTime: null,
          expiresAt: Temporal.Instant.from("2026-04-05T12:00:00Z"),
        });
        expect(f.repository.primitivesOf(1) != null).toBe(false);
        expect(f.repository.primitivesOf(2)?.status).toBe("ACCEPTED");
        expect(f.repository.primitivesOf(3) != null).toBe(false);
        expect(f.generator.getCallCount()).toBe(1);
        expect(f.access.reads).toEqual([
          { inUnitOfWork: false, eligible: true },
          { inUnitOfWork: true, eligible: true },
        ]);
        expect(f.access.locks).toEqual([true]);
      }),
  );

  it("모델은 후보 id·요일만 고르고 제목·근거·신뢰도는 서버가 실제 기록으로 정한다", () =>
    withAiAssistanceTime(async () => {
      // Given
      const f = usePickResponse(createAiAssistanceFixture(), [
        createSuggestionPick({
          daysOfWeek: ["MON", "SUN"],
          useRecordedTime: true,
          reason: "월요일마다 책 읽기를 3번 모두 끝냈어요.",
        }),
      ]);
      // When
      const count = await f.analyze.execute({ userId: f.userId, timezone: "Asia/Seoul" });
      // Then
      expect(count).toBe(1);
      expect(f.repository.created[0]).toMatchObject({
        title: "책 읽기 10분",
        daysOfWeek: ["MON"],
        scheduledTime: null,
        confidence: 0.95,
        reason: "월요일마다 책 읽기를 3번 모두 끝냈어요.",
        matchedTodos: ["책 읽기 10분", "책 읽기 10분", "책 읽기 10분"],
        suggestedCategoryId: 7,
      });
      expect(f.generator.getLastRequest()).toMatchObject({
        task: "suggestion",
        taskClass: "background",
        userId: f.userId,
        promptVersion: "suggestion@3",
      });
    }));

  it("AI 데이터 처리를 거부한 사용자는 기록을 AI로 보내지 않고 기존 제안도 바꾸지 않는다", () =>
    withAiAssistanceTime(async () => {
      // Given
      const f = usePickResponse(createAiAssistanceFixture());
      f.aiDataSharingConsent.decision = "DECLINED";
      seedPendingSuggestion(f);
      // When
      const count = await f.analyze.execute({ userId: f.userId, timezone: "Asia/Seoul" });
      // Then
      expect(count).toBe(0);
      expect(f.generator.getCallCount()).toBe(0);
      expect(f.repository.writes).toEqual([]);
      expect(f.repository.primitivesOf(1)?.status).toBe("PENDING");
    }));

  it("1.13.0 이상 앱을 쓰는 사용자는 동의해야 반복 제안을 분석한다", () =>
    withAiAssistanceTime(async () => {
      // Given
      const undecided = usePickResponse(createAiAssistanceFixture());
      undecided.clientAppVersion.latestAppVersion = "1.13.0";
      const agreed = usePickResponse(createAiAssistanceFixture());
      agreed.clientAppVersion.latestAppVersion = "1.13.0";
      agreed.aiDataSharingConsent.decision = "AGREED";
      // When
      const skipped = await undecided.analyze.execute({
        userId: undecided.userId,
        timezone: "Asia/Seoul",
      });
      await agreed.analyze.execute({ userId: agreed.userId, timezone: "Asia/Seoul" });
      // Then
      expect(skipped).toBe(0);
      expect(undecided.generator.getCallCount()).toBe(0);
      expect(agreed.generator.getCallCount()).toBe(1);
    }));

  it("기록이 없으면 기존 pending을 보존하고 AI와 쓰기를 모두 생략한다", () =>
    withAiAssistanceTime(async () => {
      // Given
      const f = createAiAssistanceFixture();
      f.activityReader.todos = [];
      seedPendingSuggestion(f);
      // When
      const count = await f.analyze.execute({ userId: f.userId, timezone: "Asia/Seoul" });
      // Then
      expect(count).toBe(0);
      expect(f.generator.getCallCount()).toBe(0);
      expect(f.repository.writes).toEqual([]);
      expect(f.repository.primitivesOf(1)?.status).toBe("PENDING");
    }));

  it.each(["FREE", "EXPIRED", "deleted"])(
    "실행 직전 %s 계정은 AI와 기존 제안 변경을 생략한다",
    (state) =>
      withAiAssistanceTime(async () => {
        // Given
        const f = usePickResponse(createAiAssistanceFixture());
        seedPendingSuggestion(f);
        if (state === "deleted") {
          f.access.deletedAt = new Date();
          f.access.status = "SUSPENDED";
        } else {
          f.access.subscriptionStatus = state;
        }
        // When
        const count = await f.analyze.execute({ userId: f.userId, timezone: "Asia/Seoul" });
        // Then
        expect(count).toBe(0);
        expect(f.generator.getCallCount()).toBe(0);
        expect(f.repository.writes).toEqual([]);
        expect(f.repository.primitivesOf(1) != null).toBe(true);
      }),
  );

  it.each(["FREE", "deleted", "missing"])(
    "AI 응답 대기 중 %s로 바뀌면 저장 gate가 기존 pending을 지킨다",
    (state) =>
      withAiAssistanceTime(async () => {
        // Given
        const f = usePickResponse(createAiAssistanceFixture());
        seedPendingSuggestion(f);
        const gate = pauseAiResponse(f.generator);
        const pending = f.analyze.execute({ userId: f.userId, timezone: "Asia/Seoul" });
        // When
        try {
          await gate.entered;
          if (state === "FREE") {
            f.access.subscriptionStatus = "FREE";
          } else if (state === "missing") {
            f.access.exists = false;
          } else {
            f.access.deletedAt = new Date();
            f.access.status = "SUSPENDED";
          }
        } finally {
          gate.release();
        }
        // Then
        expect(await pending).toBe(0);
        expect(f.generator.getCallCount()).toBe(1);
        expect(f.repository.writes).toEqual([]);
        expect(f.repository.primitivesOf(1) != null).toBe(true);
        expect(f.access.locks).toEqual([true]);
      }),
  );

  it.each([
    { name: "picks 누락", raw: {} },
    {
      name: "모르는 요일",
      raw: { picks: [{ ...createSuggestionPick(), daysOfWeek: ["MONDAY"] }] },
    },
  ])("$name처럼 schema에 맞지 않는 모델 출력은 거절하고 기존 제안을 바꾸지 않는다", ({ raw }) =>
    withAiAssistanceTime(async () => {
      // Given
      const f = createAiAssistanceFixture();
      seedPendingSuggestion(f);
      f.generator.setRawResponse(raw);
      // When
      const result = f.analyze.execute({ userId: f.userId, timezone: "Asia/Seoul" });
      // Then
      await expect(result).rejects.toThrow();
      expect(f.repository.writes).toEqual([]);
      expect(f.repository.primitivesOf(1) != null).toBe(true);
    }),
  );

  it.each(["INVALID_OUTPUT", "TRUNCATED", "BLOCKED", "BAD_REQUEST"] as const)(
    "다시 불러도 같게 실패하는 %s는 잡 재시도로 던지지 않고 이번 분석을 건너뛴다",
    (kind) =>
      withAiAssistanceTime(async () => {
        // Given
        const f = createAiAssistanceFixture();
        seedPendingSuggestion(f);
        f.generator.setInvalidResponse(createAiGenerationError(kind));
        // When
        const count = await f.analyze.execute({ userId: f.userId, timezone: "Asia/Seoul" });
        // Then
        expect(count).toBe(0);
        expect(f.repository.writes).toEqual([]);
        expect(f.repository.primitivesOf(1)?.status).toBe("PENDING");
      }),
  );

  it.each(["HALTED", "USER_SPEND_LIMITED", "UNAVAILABLE"] as const)(
    "%s로 업체를 부르지 않았으면 잡 재시도 없이 건너뛴다",
    (kind) =>
      withAiAssistanceTime(async () => {
        // Given
        const f = createAiAssistanceFixture();
        f.generator.setInvalidResponse(createAiGenerationError(kind));
        // When
        const count = await f.analyze.execute({ userId: f.userId, timezone: "Asia/Seoul" });
        // Then
        expect(count).toBe(0);
        expect(f.repository.writes).toEqual([]);
      }),
  );

  it.each(["RATE_LIMITED", "OVERLOADED", "UPSTREAM", "TIMEOUT", "CIRCUIT_OPEN"] as const)(
    "일시 장애 %s는 잡이 다시 시도하도록 던진다",
    (kind) =>
      withAiAssistanceTime(async () => {
        // Given
        const f = createAiAssistanceFixture();
        f.generator.setInvalidResponse(createAiGenerationError(kind));
        // When
        const result = f.analyze.execute({ userId: f.userId, timezone: "Asia/Seoul" });
        // Then
        await expect(result).rejects.toMatchObject({ kind });
        expect(f.repository.writes).toEqual([]);
      }),
  );

  it("실제 기록 후보에 없는 id만 고르면 아무것도 저장하지 않고 기존 pending을 지킨다", () =>
    withAiAssistanceTime(async () => {
      // Given
      const f = usePickResponse(createAiAssistanceFixture(), [
        createSuggestionPick({ candidateId: "a9" }),
        createSuggestionPick({ candidateId: "달리기 5km" }),
      ]);
      seedPendingSuggestion(f);
      // When
      const count = await f.analyze.execute({ userId: f.userId, timezone: "Asia/Seoul" });
      // Then
      expect(count).toBe(0);
      expect(f.repository.created).toEqual([]);
      expect(f.repository.writes).toEqual([]);
      expect(f.repository.primitivesOf(1)?.status).toBe("PENDING");
    }));

  it("없는 후보 id는 버리고 근거 밖 수치의 사유는 서버 문장으로 바꾼다", () =>
    withAiAssistanceTime(async () => {
      // Given
      const f = usePickResponse(createAiAssistanceFixture(), [
        createSuggestionPick({ candidateId: "a9", reason: "없음" }),
        createSuggestionPick({ reason: "10주 연속으로 읽었어요." }),
      ]);
      // When
      await f.analyze.execute({ userId: f.userId, timezone: "Asia/Seoul" });
      // Then
      expect(f.repository.created).toHaveLength(1);
      expect(f.repository.created[0]?.reason).toBe(
        "최근 '책 읽기 10분' 활동을 3번 기록하고 3번 완료했어요. 월요일에 반복으로 등록해두면 매번 다시 입력하지 않아도 돼요.",
      );
    }));

  it.each([false, true])(
    "날씨 예보 조회 가능(%s)과 관계없이 날씨를 근거로 든 사유는 서버 문장으로 바꾼다",
    (available) =>
      withAiAssistanceTime(async () => {
        // Given
        const f = usePickResponse(createAiAssistanceFixture(), [
          createSuggestionPick({ reason: "비 오는 날씨에는 실내에서 책을 읽어요." }),
        ]);
        if (available) {
          f.weatherForecastReader.forecasts.set("60:127", weatherForecastFixture());
        }
        // When
        const count = await f.analyze.execute({
          userId: f.userId,
          timezone: "Asia/Seoul",
          weatherGrid: SEOUL_GRID,
        });
        // Then
        expect(count).toBe(1);
        expect(f.repository.created[0]?.reason).not.toContain("비");
        expect(f.repository.created[0]?.reason).toContain("3번 기록");
      }),
  );

  it("후보와 이력만 프롬프트에 넣고 원본 할 일 배열과 날씨는 넣지 않는다", () =>
    withAiAssistanceTime(async () => {
      // Given
      const f = usePickResponse(createAiAssistanceFixture(), []);
      f.weatherForecastReader.forecasts.set("60:127", weatherForecastFixture());
      // When
      await f.analyze.execute({
        userId: f.userId,
        timezone: "Asia/Seoul",
        weatherGrid: SEOUL_GRID,
      });
      // Then
      const prompt = f.generator.getLastPrompt() ?? "";
      expect(prompt).toContain('"candidates"');
      expect(prompt).not.toContain('"todos"');
      expect(prompt).not.toContain('"weather"');
    }));

  it.each(["ko", "en"] as const)(
    "%s 월요일 실제 세 기록은 모델의 일요일·시각 주장을 서버 근거로 교정한다",
    (locale) =>
      withAiAssistanceTime(async () => {
        // Given
        const f = usePickResponse(createAiAssistanceFixture(), [
          createSuggestionPick({
            daysOfWeek: ["SUN"],
            useRecordedTime: true,
            reason: "3 Sundays at 08:00",
          }),
        ]);
        // When
        const count = await f.analyze.execute({
          userId: f.userId,
          timezone: "America/Los_Angeles",
          weatherGrid: null,
          locale: locale,
        });
        // Then
        expect(count).toBe(1);
        expect(f.repository.created[0]).toMatchObject({
          title: "책 읽기 10분",
          daysOfWeek: ["MON"],
          scheduledTime: null,
        });
        expect(f.repository.created[0]?.reason).not.toContain("Sunday");
        expect(f.repository.created[0]?.reason).not.toContain("08:00");
        expect(f.repository.created[0]?.reason).toContain("3");
      }),
  );

  it("반복 기록에 같은 시각이 두 번 이상 있을 때만 그 시각을 제안에 쓴다", () =>
    withAiAssistanceTime(async () => {
      // Given
      const timed = usePickResponse(createAiAssistanceFixture(), [
        createSuggestionPick({ useRecordedTime: true }),
      ]);
      timed.activityReader.todos = timed.activityReader.todos.map((todo) => ({
        ...todo,
        scheduledTime: "19:30",
      }));
      const declined = usePickResponse(createAiAssistanceFixture(), [
        createSuggestionPick({ useRecordedTime: false }),
      ]);
      declined.activityReader.todos = timed.activityReader.todos;
      // When
      await timed.analyze.execute({ userId: timed.userId, timezone: "Asia/Seoul" });
      await declined.analyze.execute({ userId: declined.userId, timezone: "Asia/Seoul" });
      // Then
      expect(timed.repository.created[0]?.scheduledTime).toBe("19:30");
      expect(declined.repository.created[0]?.scheduledTime).toBeNull();
    }));

  it("실제 반복 행동 여섯 개와 중복 선택 중 서로 다른 다섯 개만 저장한다", () =>
    withAiAssistanceTime(async () => {
      // Given
      const f = createAiAssistanceFixture();
      f.activityReader.todos = Array.from({ length: 6 }, (_, n) =>
        ["2026-03-02", "2026-03-09", "2026-03-16"].map((startDate) =>
          createAnalysisTodo({ title: `행동${n} 읽기`, startDate }),
        ),
      ).flat();
      usePickResponse(
        f,
        ["a1", "a1", "a2", "a3", "a4", "a5", "a6"].map((candidateId) =>
          createSuggestionPick({ candidateId }),
        ),
      );
      // When
      const count = await f.analyze.execute({ userId: f.userId, timezone: "Asia/Seoul" });
      // Then
      expect(count).toBe(5);
      expect(f.repository.created.map((row) => row.title)).toEqual(
        Array.from({ length: 5 }, (_, n) => `행동${n} 읽기`),
      );
      expect(f.generator.getCallCount()).toBe(1);
    }));

  it("두 번 반복한 활동은 신뢰도 0.65로 저장하고 한 번뿐인 활동은 반복 제안에서 뺀다", () =>
    withAiAssistanceTime(async () => {
      // Given
      const f = createAiAssistanceFixture();
      f.activityReader.todos = [
        createAnalysisTodo({ title: "책 읽기", startDate: "2026-03-09" }),
        createAnalysisTodo({ title: "책 읽기", startDate: "2026-03-16" }),
        createAnalysisTodo({ title: "스트레칭", startDate: "2026-03-16" }),
      ];
      usePickResponse(f, [
        createSuggestionPick({ candidateId: "a1" }),
        createSuggestionPick({ candidateId: "a2" }),
      ]);
      // When
      const count = await f.analyze.execute({ userId: f.userId, timezone: "Asia/Seoul" });
      // Then
      expect(count).toBe(1);
      expect(f.repository.created[0]).toMatchObject({
        title: "책 읽기",
        confidence: 0.65,
        suggestedCategoryId: 7,
      });
    }));

  it.each(["DISMISSED", "ACCEPTED"] as const)(
    "최근 %s 응답한 활동은 다시 제안하지 않고 기존 pending을 교체하지 않는다",
    (status) =>
      withAiAssistanceTime(async () => {
        // Given
        const f = usePickResponse(createAiAssistanceFixture());
        f.activityReader.history = [{ title: "책 읽기 10분", status }];
        seedPendingSuggestion(f);
        // When
        const count = await f.analyze.execute({ userId: f.userId, timezone: "Asia/Seoul" });
        // Then
        expect(count).toBe(0);
        expect(f.repository.created).toEqual([]);
        expect(f.repository.writes).toEqual([]);
        expect(f.repository.primitivesOf(1)?.status).toBe("PENDING");
      }),
  );

  it.each([
    { title: "러닝", locale: "ko" as const, starter: "기록이 아직 1개", day: "수요일" },
    { title: "러닝 30분", locale: "ko" as const, starter: "기록이 아직 1개", day: "수요일" },
    { title: "Running", locale: "en" as const, starter: "only 1 recent record", day: "Wednesday" },
  ])(
    "$locale 1회 '$title' 기록의 시작 제안은 원본 제목·실제 요일만 쓰고 시각을 만들지 않는다",
    ({ title, locale, starter, day }) =>
      withAiAssistanceTime(async () => {
        // Given
        const f = usePickResponse(createAiAssistanceFixture(), [
          createSuggestionPick({ daysOfWeek: ["MON", "FRI"], useRecordedTime: true }),
        ]);
        f.activityReader.todos = [createAnalysisTodo({ title, startDate: "2026-03-18" })];
        // When
        const count = await f.analyze.execute({
          userId: f.userId,
          timezone: "Asia/Seoul",
          weatherGrid: null,
          locale: locale,
        });
        // Then
        expect(count).toBe(1);
        expect(f.repository.created[0]).toMatchObject({
          title,
          daysOfWeek: ["WED"],
          scheduledTime: null,
          confidence: 0.55,
          matchedTodos: [],
        });
        expect(f.repository.created[0]?.reason).toContain(starter);
        expect(f.repository.created[0]?.reason).toContain(title);
        expect(f.repository.created[0]?.reason).toContain(day);
        expect(f.generator.getCallCount()).toBe(1);
      }),
  );

  it("기록이 3개 미만이면 시작 제안은 최대 2개이고 신뢰도는 0.55다", () =>
    withAiAssistanceTime(async () => {
      // Given
      const f = createAiAssistanceFixture();
      f.activityReader.todos = [
        createAnalysisTodo({ title: "산책", startDate: "2026-03-17" }),
        createAnalysisTodo({ title: "스트레칭", startDate: "2026-03-18" }),
      ];
      usePickResponse(
        f,
        ["a1", "a2"].map((candidateId) =>
          createSuggestionPick({ candidateId, daysOfWeek: ["TUE", "WED"] }),
        ),
      );
      // When
      await f.analyze.execute({ userId: f.userId, timezone: "Asia/Seoul" });
      // Then
      expect(f.repository.created.map((row) => row.confidence)).toEqual([0.55, 0.55]);
      expect(f.repository.created.every((row) => row.matchedTodos.length === 0)).toBe(true);
    }));

  it("다른 활동의 기록 시각을 시작 제안에 붙이지 않는다", () =>
    withAiAssistanceTime(async () => {
      // Given
      const f = createAiAssistanceFixture();
      f.activityReader.todos = [
        createAnalysisTodo({ title: "러닝", startDate: "2026-03-18" }),
        createAnalysisTodo({ title: "독서", scheduledTime: "19:30" }),
      ];
      usePickResponse(f, [createSuggestionPick({ candidateId: "a2", useRecordedTime: true })]);
      // When
      await f.analyze.execute({ userId: f.userId, timezone: "Asia/Seoul" });
      // Then
      expect(f.repository.created[0]).toMatchObject({ title: "러닝", scheduledTime: null });
    }));

  it("보낼 수 있는 AI 업체가 없으면 제안을 저장하지 않고 건너뛴다", () =>
    withAiAssistanceTime(async () => {
      // Given
      const f = createAiAssistanceFixture();
      f.generator.setAvailable(false);
      // When
      const count = await f.analyze.execute({ userId: f.userId, timezone: "Asia/Seoul" });
      // Then
      expect(count).toBe(0);
      expect(f.repository.writes).toEqual([]);
    }));
});
