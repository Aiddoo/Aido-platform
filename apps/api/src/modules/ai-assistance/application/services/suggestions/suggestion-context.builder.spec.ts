import {
  createAiAssistanceFixture,
  createAnalysisTodo,
  withAiAssistanceTime,
} from "#test/fixtures/ai-assistance.fixture";
import { weatherForecastFixture } from "#test/fixtures/weather.fixture";

const grid = { gridX: 60, gridY: 127, lat: 37.5, lon: 127 };

describe("SuggestionContextBuilder", () => {
  it("실제 기록·통계·날씨·보고서·응답 이력을 컨텍스트에 전달한다", () =>
    withAiAssistanceTime(async () => {
      // Given - 상태 Stub에 실제 읽기 프로젝션이 있음
      const f = createAiAssistanceFixture();
      f.repository.history = [{ title: "이전 제안", status: "DISMISSED" }];
      f.weatherForecastReader.forecasts.set(
        "60:127",
        weatherForecastFixture({ temperatureMin: 5, temperatureMax: 15 }),
      );
      f.reportReader.report = {
        stats: {
          totalTodos: 5,
          completedTodos: 4,
          completionRate: 80,
          prevCompletionRate: null,
          streakDays: 3,
        },
      };
      // When - 실제 builder 수집
      const result = await f.contextBuilder.build(f.userId, "Asia/Seoul", grid);
      // Then - 통계 수치·언어·근거 기록을 보존
      expect(result.todos).toEqual(f.repository.todos);
      expect(result.recordedActivities).toEqual([
        {
          title: "책 읽기 10분",
          occurrences: 3,
          completedOccurrences: 3,
          days: [{ day: "MON", total: 3, completed: 3 }],
          recordedTimes: [],
        },
      ]);
      expect(result.dayCompletionRates).toContain("월:80%");
      expect(result.categoryRates).toContain("독서:80%");
      expect(result.streak).toContain("3일");
      expect(result.weather).toBe("맑음, 5~15°C");
      expect(result.weeklyReportInsight).toContain("80%");
      expect(result.suggestionHistory).toEqual(f.repository.history);
      expect(result.currentDate).toContain("2026-03-22");
    }));

  it.each(["missing", "failed"])("weather reader %s이면 실제 weather=null로 폴백한다", (state) =>
    withAiAssistanceTime(async () => {
      // Given - 읽기 결과 누락 또는 provider 실패
      const f = createAiAssistanceFixture();
      if (state === "failed") f.weatherForecastReader.failure = new Error("날씨 실패");
      // When - 위치는 있지만 조회 결과가 없음
      const result = await f.contextBuilder.build(f.userId, "Asia/Seoul", grid);
      // Then - 통계는 보존하고 날씨만 null
      expect(result.weather).toBeNull();
      expect(result.todos).toEqual(f.repository.todos);
      expect(f.weatherForecastReader.calls).toBe(1);
    }),
  );

  it("위치·스트릭·유효한 보고서가 없으면 해당 컨텍스트만 폴백한다", () =>
    withAiAssistanceTime(async () => {
      // Given - 위치 없음, streak 없음, 무효 report stats
      const f = createAiAssistanceFixture();
      f.repository.streak = null;
      f.reportReader.report = { stats: {} };
      // When - 실제 수집
      const result = await f.contextBuilder.build(f.userId, "Asia/Seoul", null);
      // Then - 불필요한 weather 조회 없음
      expect(result.weather).toBeNull();
      expect(f.weatherForecastReader.calls).toBe(0);
      expect(result.streak).toBe("정보 없음");
      expect(result.weeklyReportInsight).toBeNull();
    }));

  it.each(["Asia/Seoul", "UTC", "America/Los_Angeles"])(
    "%s 일요일에 같은 ISO 주 월요일 기록을 놓친 루틴으로 표시하지 않는다",
    (timezone) =>
      withAiAssistanceTime(async () => {
        // Given - 두 과거 월요일과 이번 주 월요일에 실제 같은 행동
        const f = createAiAssistanceFixture();
        // When - 일요일의 실제 ContextBuilder
        const context = await f.contextBuilder.build(f.userId, timezone, null);
        // Then - 이번 ISO 주에서 이미 완료한 행동
        expect(context.missingRoutines).toEqual([]);
      }),
  );

  it.each(["ko", "en"] as const)(
    "%s에서 과거 두 주에 반복했지만 이번 주 누락한 행동만 감지한다",
    (locale) =>
      withAiAssistanceTime(async () => {
        // Given - 이번 ISO 주 기록 없이 지난 두 월요일만 존재
        const f = createAiAssistanceFixture();
        f.repository.todos = ["2026-03-02", "2026-03-09"].map((startDate) =>
          createAnalysisTodo({ startDate }),
        );
        // When - 실제 누락 계산
        const context = await f.contextBuilder.build(f.userId, "Asia/Seoul", null, locale);
        // Then - 해당 locale 누락 문구, 한 번만 등장한 행동은 없음
        expect(context.missingRoutines).toHaveLength(1);
        expect(context.missingRoutines[0]).toContain("책 읽기 10분");
        f.repository.todos = [createAnalysisTodo({ startDate: "2026-03-09" })];
        expect(
          (await f.contextBuilder.build(f.userId, "Asia/Seoul", null, locale)).missingRoutines,
        ).toEqual([]);
      }),
  );
});
