import {
  createAiAssistanceFixture,
  createAnalysisTodo,
  withAiAssistanceTime,
} from "#test/fixtures/ai-assistance.fixture";
import { weatherForecastFixture } from "#test/fixtures/weather.fixture";

// 고정 기록: "책 읽기 10분"을 2026-03-02·09·16(월) 세 번 완료
describe("AnalyzeAndCreateSuggestions — v2 후보 선택형", () => {
  it("모델은 후보 id·요일만 고르고 제목·근거·신뢰도는 서버가 실제 기록으로 정한다", () =>
    withAiAssistanceTime(async () => {
      // Given
      const f = createAiAssistanceFixture();
      f.aiProvider.setRawResponse({
        picks: [
          {
            candidateId: "a1",
            daysOfWeek: ["MON", "SUN"],
            useRecordedTime: true,
            reason: "월요일마다 책 읽기를 3번 모두 끝냈어요.",
          },
        ],
      });
      // When
      const count = await f.analyzeV2.execute(f.userId, "Asia/Seoul");
      // Then
      expect(count).toBe(1);
      expect(f.repository.saved[0]).toMatchObject({
        title: "책 읽기 10분",
        daysOfWeek: ["MON"],
        scheduledTime: null,
        confidence: 0.95,
        reason: "월요일마다 책 읽기를 3번 모두 끝냈어요.",
        matchedTodos: ["책 읽기 10분", "책 읽기 10분", "책 읽기 10분"],
        suggestedCategoryId: 7,
      });
      expect(f.aiProvider.getLastOptions()).toMatchObject({
        task: "suggestion",
        promptVersion: "suggestion@v2",
      });
    }));

  it("후보와 이력만 프롬프트에 넣고 원본 할 일 배열과 날씨는 넣지 않는다", () =>
    withAiAssistanceTime(async () => {
      // Given - 날씨를 조회할 수 있는 사용자
      const f = createAiAssistanceFixture();
      f.weatherForecastReader.forecasts.set("60:127", weatherForecastFixture());
      f.aiProvider.setRawResponse({ picks: [] });
      // When
      await f.analyzeV2.execute(f.userId, "Asia/Seoul", {
        gridX: 60,
        gridY: 127,
        lat: 37.5,
        lon: 127,
      });
      // Then
      const prompt = f.aiProvider.getLastPrompt() ?? "";
      expect(prompt).toContain('"candidates"');
      expect(prompt).not.toContain('"todos"');
      expect(prompt).not.toContain('"weather"');
    }));

  it("없는 후보 id와 근거 밖 수치의 사유는 버리거나 서버 문장으로 바꾼다", () =>
    withAiAssistanceTime(async () => {
      // Given
      const f = createAiAssistanceFixture();
      f.aiProvider.setRawResponse({
        picks: [
          { candidateId: "a9", daysOfWeek: ["MON"], useRecordedTime: false, reason: "없음" },
          {
            candidateId: "a1",
            daysOfWeek: ["MON"],
            useRecordedTime: false,
            reason: "10주 연속으로 읽었어요.",
          },
        ],
      });
      // When
      await f.analyzeV2.execute(f.userId, "Asia/Seoul");
      // Then
      expect(f.repository.saved).toHaveLength(1);
      expect(f.repository.saved[0]?.reason).toBe(
        "최근 '책 읽기 10분' 활동을 3번 기록하고 3번 완료했어요. 월요일에 반복으로 등록해두면 매번 다시 입력하지 않아도 돼요.",
      );
    }));

  it("최근 응답한 활동은 다시 제안하지 않는다", () =>
    withAiAssistanceTime(async () => {
      // Given
      const f = createAiAssistanceFixture();
      f.repository.history = [{ title: "책 읽기 10분", status: "DISMISSED" }];
      f.aiProvider.setRawResponse({
        picks: [{ candidateId: "a1", daysOfWeek: ["MON"], useRecordedTime: false, reason: "" }],
      });
      // When
      const count = await f.analyzeV2.execute(f.userId, "Asia/Seoul");
      // Then
      expect(count).toBe(0);
      expect(f.repository.saved).toEqual([]);
    }));

  it("기록이 3개 미만이면 시작 제안은 최대 2개이고 신뢰도는 0.55다", () =>
    withAiAssistanceTime(async () => {
      // Given
      const f = createAiAssistanceFixture();
      f.repository.todos = [
        createAnalysisTodo({ title: "산책", startDate: "2026-03-17" }),
        createAnalysisTodo({ title: "스트레칭", startDate: "2026-03-18" }),
      ];
      f.aiProvider.setRawResponse({
        picks: ["a1", "a2"].map((candidateId) => ({
          candidateId,
          daysOfWeek: ["TUE", "WED"],
          useRecordedTime: false,
          reason: "",
        })),
      });
      // When
      await f.analyzeV2.execute(f.userId, "Asia/Seoul");
      // Then
      expect(f.repository.saved.map((row) => row.confidence)).toEqual([0.55, 0.55]);
      expect(f.repository.saved.every((row) => row.matchedTodos.length === 0)).toBe(true);
    }));

  it("공급자를 쓸 수 없으면 기록을 읽거나 AI를 부르지 않는다", () =>
    withAiAssistanceTime(async () => {
      // Given
      const f = createAiAssistanceFixture();
      f.aiProvider.setAvailable(false);
      // When
      const count = await f.analyzeV2.execute(f.userId, "Asia/Seoul");
      // Then
      expect(count).toBe(0);
      expect(f.aiProvider.getCallCount()).toBe(0);
      expect(f.repository.writes).toEqual([]);
    }));
});
