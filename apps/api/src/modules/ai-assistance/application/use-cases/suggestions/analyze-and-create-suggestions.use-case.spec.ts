import {
  createAiAssistanceFixture,
  createAnalysisTodo,
  pauseAiResponse,
  seedPendingSuggestion,
  usePatternResponse,
  withAiAssistanceTime,
} from "#test/fixtures/ai-assistance.fixture";
import { createDetectedPattern } from "#test/fixtures/ai-response.fixture";
import { weatherForecastFixture } from "#test/fixtures/weather.fixture";

describe("AnalyzeAndCreateSuggestions", () => {
  it.each(["USER", "ADMIN"])(
    "활성 %s의 실제 근거 제안은 pending을 교체하고 응답 이력을 유지한다",
    (role) =>
      withAiAssistanceTime(async () => {
        // Given - 실제 독서 기록과 이전 pending, 응답 완료, 만료 이력
        const f = usePatternResponse(createAiAssistanceFixture());
        f.access.role = role;
        if (role === "ADMIN") f.access.subscriptionStatus = "FREE";
        seedPendingSuggestion(f);
        seedPendingSuggestion(f, 2);
        seedPendingSuggestion(f, 3);
        f.repository.rows.set(2, { ...f.repository.rows.get(2)!, status: "ACCEPTED" });
        f.repository.rows.set(3, {
          ...f.repository.rows.get(3)!,
          expiresAt: new Date("2026-03-01"),
        });
        // When - 실제 컨텍스트 수집과 schema 검증을 거쳐 분석
        const count = await f.analyze.execute(f.userId, "Asia/Seoul");
        // Then - 근거·카테고리·만료기간 저장, 두 fresh gate와 UOW lock 확인
        expect(count).toBe(1);
        expect(f.repository.saved[0]).toMatchObject({
          title: "책 읽기 10분",
          suggestedCategoryId: 7,
          scheduledTime: null,
          expiresAt: new Date("2026-04-05T12:00:00Z"),
        });
        expect(f.repository.rows.has(1)).toBe(false);
        expect(f.repository.rows.get(2)?.status).toBe("ACCEPTED");
        expect(f.repository.rows.has(3)).toBe(false);
        expect(f.aiProvider.getCallCount()).toBe(1);
        expect(f.access.reads).toEqual([
          { inUnitOfWork: false, eligible: true },
          { inUnitOfWork: true, eligible: true },
        ]);
        expect(f.access.locks).toEqual([true]);
      }),
  );

  it("기록이 없으면 기존 pending을 보존하고 AI와 쓰기를 모두 생략한다", () =>
    withAiAssistanceTime(async () => {
      // Given - 기록 없는 사용자에게 기존 pending이 있음
      const f = createAiAssistanceFixture();
      f.repository.todos = [];
      seedPendingSuggestion(f);
      // When - 분석
      expect(await f.analyze.execute(f.userId, "Asia/Seoul")).toBe(0);
      // Then - 비용과 상태 그대로
      expect(f.aiProvider.getCallCount()).toBe(0);
      expect(f.repository.writes).toEqual([]);
      expect(f.repository.rows.get(1)?.status).toBe("PENDING");
    }));

  it.each(["FREE", "EXPIRED", "deleted"])(
    "실행 직전 %s 계정은 AI와 기존 제안 변경을 생략한다",
    (state) =>
      withAiAssistanceTime(async () => {
        // Given - dispatch 후 유료 상태 변경 또는 유료 상태를 유지한 탈퇴
        const f = usePatternResponse(createAiAssistanceFixture());
        seedPendingSuggestion(f);
        if (state === "deleted") {
          f.access.deletedAt = new Date();
          f.access.status = "SUSPENDED";
        } else f.access.subscriptionStatus = state;
        // When - 실행 순간 최신 capability 조회
        expect(await f.analyze.execute(f.userId, "Asia/Seoul")).toBe(0);
        // Then - 호출·쓰기 0, 이전 pending 유지
        expect(f.aiProvider.getCallCount()).toBe(0);
        expect(f.repository.writes).toEqual([]);
        expect(f.repository.rows.has(1)).toBe(true);
      }),
  );

  it.each(["FREE", "deleted", "missing"])(
    "AI 응답 대기 중 %s로 바뀌면 저장 gate가 기존 pending을 지킨다",
    (state) =>
      withAiAssistanceTime(async () => {
        // Given - 유료 상태에서 AI 응답이 대기 중
        const f = usePatternResponse(createAiAssistanceFixture());
        seedPendingSuggestion(f);
        const gate = pauseAiResponse(f.aiProvider);
        const pending = f.analyze.execute(f.userId, "Asia/Seoul");
        try {
          await gate.entered;
          // When - 실제 응답 반환 전에 최신 계정 상태 변경
          if (state === "FREE") f.access.subscriptionStatus = "FREE";
          else if (state === "missing") f.access.exists = false;
          else {
            f.access.deletedAt = new Date();
            f.access.status = "SUSPENDED";
          }
        } finally {
          gate.release();
        }
        // Then - 이미 시작한 AI는 1회, 교체·삭제·저장 모두 0
        expect(await pending).toBe(0);
        expect(f.aiProvider.getCallCount()).toBe(1);
        expect(f.repository.writes).toEqual([]);
        expect(f.repository.rows.has(1)).toBe(true);
        expect(f.access.locks).toEqual([true]);
      }),
  );

  it.each([{}, { patterns: [createDetectedPattern({ confidence: 1.1 })] }])(
    "실제 schema가 잘못된 원본을 거절하면 기존 제안을 변경하지 않는다",
    (raw) =>
      withAiAssistanceTime(async () => {
        // Given - 필수 patterns 누락 또는 범위 밖 confidence
        const f = createAiAssistanceFixture();
        seedPendingSuggestion(f);
        f.aiProvider.setRawResponse(raw);
        // When - 원본 그대로 생산 schema 검증
        await expect(f.analyze.execute(f.userId, "Asia/Seoul")).rejects.toThrow();
        // Then - 저장 전 실패, 기존 pending 유지
        expect(f.repository.writes).toEqual([]);
        expect(f.repository.rows.has(1)).toBe(true);
      }),
  );

  it("실제 기록에 없는 제목이나 기록 수를 초과한 근거는 저장하지 않는다", () =>
    withAiAssistanceTime(async () => {
      // Given - 같은 독서가 실제 세 번만 있었음
      const f = usePatternResponse(createAiAssistanceFixture(), [
        createDetectedPattern({ matchedTitles: Array(3).fill("없는 기록") }),
        createDetectedPattern({
          title: "책 읽기 20분",
          matchedTitles: Array(5).fill("책 읽기 10분"),
        }),
      ]);
      // When - 분석
      expect(await f.analyze.execute(f.userId, "Asia/Seoul")).toBe(0);
      // Then - 실제 multiplicity를 넘는 주장도 제외
      expect(f.repository.saved).toEqual([]);
    }));

  it("독서 근거를 복사한 달리기 제안은 제외하고 실제 독서는 남긴다", () =>
    withAiAssistanceTime(async () => {
      // Given - 독서 근거를 다른 행동에 재사용한 정상 shape
      const f = usePatternResponse(createAiAssistanceFixture(), [
        createDetectedPattern({ title: "달리기 5km" }),
        createDetectedPattern(),
      ]);
      // When - 실제 분석
      expect(await f.analyze.execute(f.userId, "Asia/Seoul")).toBe(1);
      // Then - 근거 있는 독서 제안만 저장
      expect(f.repository.saved.map((row) => row.title)).toEqual(["책 읽기 10분"]);
    }));

  it.each([false, true])(
    "날씨 근거 유무(%s)에 따라 빈 matchedTitles 날씨 제안을 구분한다",
    (available) =>
      withAiAssistanceTime(async () => {
        // Given - matchedTitles가 비어 있어도 날씨 의존 제안
        const f = usePatternResponse(createAiAssistanceFixture(), [
          createDetectedPattern({
            title: "실내 스트레칭",
            reason: "비 오는 날씨에는 실내 활동을 해요",
            matchedTitles: [],
          }),
        ]);
        if (available) f.weatherForecastReader.forecasts.set("60:127", weatherForecastFixture());
        // When - 실제 weather reader와 ContextBuilder를 통해 분석
        const count = await f.analyze.execute(f.userId, "Asia/Seoul", {
          gridX: 60,
          gridY: 127,
          lat: 37.5,
          lon: 127,
        });
        // Then - weather null이면 저장 0, 실제 weather가 있으면 유지
        expect(count).toBe(available ? 1 : 0);
        expect(f.repository.saved).toHaveLength(available ? 1 : 0);
      }),
  );

  it.each(["ko", "en"] as const)(
    "시간 없는 1회 기록의 %s 시작 제안은 시각을 만들지 않는다",
    (locale) =>
      withAiAssistanceTime(async () => {
        // Given - 시각 없는 희소 기록, AI는 08:00과 과도한 자신감 반환
        const f = usePatternResponse(createAiAssistanceFixture(), [
          createDetectedPattern({ scheduledTime: "08:00", confidence: 0.95 }),
        ]);
        f.repository.todos = [createAnalysisTodo()];
        // When - 해당 locale의 실제 시작 제안 생성
        expect(await f.analyze.execute(f.userId, "Asia/Seoul", null, locale)).toBe(1);
        // Then - 근거 없는 시각 null·낮춘 confidence·locale 이유 저장, 재시도 없음
        expect(f.repository.saved[0]).toMatchObject({
          scheduledTime: null,
          confidence: 0.6,
          matchedTodos: [],
        });
        expect(f.repository.saved[0]?.reason).toContain(
          locale === "ko" ? "최근 기록이 1개" : "1 recent record",
        );
        expect(f.aiProvider.getCallCount()).toBe(1);
      }),
  );

  it("희소 기록에 실제 예정 시각이 있으면 시작 제안에서 그 시각을 유지한다", () =>
    withAiAssistanceTime(async () => {
      // Given - 기록에 실제 08:00 근거가 있음
      const f = usePatternResponse(createAiAssistanceFixture(), [
        createDetectedPattern({ scheduledTime: "08:00" }),
      ]);
      f.repository.todos = [createAnalysisTodo({ scheduledTime: "08:00" })];
      // When - 실제 시작 제안 생성
      await f.analyze.execute(f.userId, "Asia/Seoul");
      // Then - 무조건 시각을 삭제하는 구현을 방지
      expect(f.repository.saved[0]?.scheduledTime).toBe("08:00");
    }));

  it("실제 근거의 중복을 제거하고 신뢰도 순서로 최대 다섯 개만 저장한다", () =>
    withAiAssistanceTime(async () => {
      // Given - 제목별 실제 세 번 기록과 같은 제목/요일의 중복
      const f = createAiAssistanceFixture();
      f.repository.todos = Array.from({ length: 6 }, (_, n) =>
        ["2026-03-02", "2026-03-09", "2026-03-16"].map((startDate) =>
          createAnalysisTodo({ title: `행동${n} 읽기`, startDate }),
        ),
      ).flat();
      const patterns = Array.from({ length: 6 }, (_, n) =>
        createDetectedPattern({
          title: `행동${n} 읽기`,
          matchedTitles: Array(3).fill(`행동${n} 읽기`),
          confidence: 0.9 - n * 0.01,
        }),
      );
      f.aiProvider.setRawResponse({ patterns: [...patterns, patterns[0]] });
      // When - 분석 결과 정렬·중복 제거·상한 적용
      expect(await f.analyze.execute(f.userId, "Asia/Seoul")).toBe(5);
      // Then - 가장 강한 실제 행동 다섯 개
      expect(f.repository.saved.map((row) => row.title)).toEqual(
        patterns.slice(0, 5).map((row) => row.title),
      );
      expect(f.aiProvider.getCallCount()).toBe(1);
    }));

  it("시즌·밸런스 제안은 두 개로 제한하고 카테고리명에 맞는 제안을 분류한다", () =>
    withAiAssistanceTime(async () => {
      // Given - 근거 없는 유형 세 개 중 실제 카테고리 이름을 사용한 제안
      const f = usePatternResponse(createAiAssistanceFixture(), [
        createDetectedPattern({ title: "독서 20분", matchedTitles: [], confidence: 0.8 }),
        createDetectedPattern({ title: "봄 산책", matchedTitles: [], confidence: 0.7 }),
        createDetectedPattern({ title: "봄 정리", matchedTitles: [], confidence: 0.6 }),
      ]);
      // When - 유형 cap 적용
      expect(await f.analyze.execute(f.userId, "Asia/Seoul")).toBe(2);
      // Then - 높은 신뢰도 두 개, 소유 카테고리 연결과 null fallback
      expect(f.repository.saved.map((row) => [row.title, row.suggestedCategoryId])).toEqual([
        ["독서 20분", 7],
        ["봄 산책", null],
      ]);
    }));

  it("두 번의 실제 반복은 confidence gate를 적용하고 카테고리를 저장한다", () =>
    withAiAssistanceTime(async () => {
      // Given - 두 행동이 각각 실제 두 번, 전체 기록은 희소 아님
      const f = createAiAssistanceFixture();
      f.repository.todos = ["책 읽기", "스트레칭"].flatMap((title) =>
        ["2026-03-09", "2026-03-16"].map((startDate) => createAnalysisTodo({ title, startDate })),
      );
      f.aiProvider.setRawResponse({
        patterns: [
          createDetectedPattern({
            title: "책 읽기",
            matchedTitles: ["책 읽기", "책 읽기"],
            confidence: 0.8,
          }),
          createDetectedPattern({
            title: "스트레칭",
            matchedTitles: ["스트레칭", "스트레칭"],
            confidence: 0.6,
          }),
        ],
      });
      // When - 실제 occurrences와 confidence 적용
      expect(await f.analyze.execute(f.userId, "Asia/Seoul")).toBe(1);
      // Then - 충분한 confidence 제안 하나만 저장
      expect(f.repository.saved[0]).toMatchObject({ title: "책 읽기", suggestedCategoryId: 7 });
    }));
  it.each(["ko", "en"] as const)(
    "%s 월요일 실제 세 기록은 모델의 일요일/증량/시각 주장을 서버 근거로 교정한다",
    (locale) =>
      withAiAssistanceTime(async () => {
        const f = usePatternResponse(createAiAssistanceFixture(), [
          createDetectedPattern({
            title: "책 읽기 15분",
            daysOfWeek: ["SUN"],
            scheduledTime: "08:00",
            matchedTitles: ["책 읽기 10분"],
            reason: "3 Sundays at 08:00",
            confidence: 0.95,
          }),
        ]);
        expect(await f.analyze.execute(f.userId, "America/Los_Angeles", null, locale)).toBe(1);
        expect(f.repository.saved[0]).toMatchObject({
          title: "책 읽기 10분",
          daysOfWeek: ["MON"],
          scheduledTime: null,
        });
        expect(f.repository.saved[0]?.reason).not.toContain("Sunday");
        expect(f.repository.saved[0]?.reason).not.toContain("08:00");
        expect(f.repository.saved[0]?.reason).toContain("3");
      }),
  );

  it("거절한 원본 활동의 증량 변형은 기존 pending을 교체하지 않는다", () =>
    withAiAssistanceTime(async () => {
      const f = usePatternResponse(createAiAssistanceFixture(), [
        createDetectedPattern({
          title: "책 읽기 15분",
          matchedTitles: ["책 읽기 10분"],
          confidence: 0.95,
        }),
      ]);
      f.repository.history = [{ title: "책 읽기 10분", status: "DISMISSED" }];
      seedPendingSuggestion(f);
      expect(await f.analyze.execute(f.userId, "Asia/Seoul")).toBe(0);
      expect(f.repository.saved).toEqual([]);
      expect(f.repository.writes).toEqual([]);
      expect(f.repository.rows.get(1)?.status).toBe("PENDING");
    }));

  it("반복 기록의 실제 동일 시각만 유지한다", () =>
    withAiAssistanceTime(async () => {
      const f = usePatternResponse(createAiAssistanceFixture(), [
        createDetectedPattern({
          scheduledTime: "19:30",
          matchedTitles: ["책 읽기 10분"],
          confidence: 0.95,
        }),
      ]);
      f.repository.todos = f.repository.todos.map((todo) => ({ ...todo, scheduledTime: "19:30" }));
      expect(await f.analyze.execute(f.userId, "Asia/Seoul")).toBe(1);
      expect(f.repository.saved[0]?.scheduledTime).toBe("19:30");
    }));
  it("최근 수락한 원본 활동은 반복 설정을 다시 제안하지 않는다", () =>
    withAiAssistanceTime(async () => {
      const f = usePatternResponse(createAiAssistanceFixture(), [
        createDetectedPattern({
          title: "책 읽기 15분",
          matchedTitles: ["책 읽기 10분"],
          confidence: 0.95,
        }),
      ]);
      f.repository.history = [{ title: "책 읽기 10분", status: "ACCEPTED" }];
      seedPendingSuggestion(f);
      expect(await f.analyze.execute(f.userId, "Asia/Seoul")).toBe(0);
      expect(f.repository.saved).toEqual([]);
      expect(f.repository.writes).toEqual([]);
      expect(f.repository.rows.get(1)?.status).toBe("PENDING");
    }));
  it.each([
    { title: "러닝", generated: "러닝 30분", locale: "ko" as const },
    { title: "러닝 30분", generated: "러닝 15분", locale: "ko" as const },
    { title: "Running", generated: "Running for 30 minutes", locale: "en" as const },
    { title: "Running for 30 minutes", generated: "Running for 15 minutes", locale: "en" as const },
  ])(
    "1회 $title 기록은 모델의 분량 대신 원본·실제 요일만 저장한다",
    ({ title, generated, locale }) =>
      withAiAssistanceTime(async () => {
        const f = usePatternResponse(createAiAssistanceFixture(), [
          createDetectedPattern({
            title: generated,
            daysOfWeek: ["MON", "FRI"],
            scheduledTime: "08:00",
            confidence: 0.95,
          }),
        ]);
        f.repository.todos = [createAnalysisTodo({ title, startDate: "2026-03-18" })];
        expect(await f.analyze.execute(f.userId, "Asia/Seoul", null, locale)).toBe(1);
        expect(f.repository.saved[0]).toMatchObject({
          title,
          daysOfWeek: ["WED"],
          scheduledTime: null,
          confidence: 0.6,
          matchedTodos: [],
        });
        expect(f.repository.saved[0]?.reason).toContain(title);
        expect(f.repository.saved[0]?.reason).toContain(locale === "ko" ? "수요일" : "Wednesday");
      }),
  );

  it("시작 제안의 같은 활동 두 분량은 원본 한 개로 합치고 무관한 활동은 제외한다", () =>
    withAiAssistanceTime(async () => {
      const f = usePatternResponse(createAiAssistanceFixture(), [
        createDetectedPattern({ title: "러닝 30분" }),
        createDetectedPattern({ title: "러닝 15분" }),
        createDetectedPattern({ title: "스트레칭 10분" }),
      ]);
      f.repository.todos = [createAnalysisTodo({ title: "러닝", startDate: "2026-03-18" })];
      expect(await f.analyze.execute(f.userId, "Asia/Seoul")).toBe(1);
      expect(f.repository.saved.map((row) => row.title)).toEqual(["러닝"]);
    }));

  it("다른 활동의 실제 시각을 시작 제안에 붙이지 않는다", () =>
    withAiAssistanceTime(async () => {
      const f = usePatternResponse(createAiAssistanceFixture(), [
        createDetectedPattern({
          title: "러닝 30분",
          scheduledTime: "19:30",
        }),
      ]);
      f.repository.todos = [
        createAnalysisTodo({ title: "러닝", startDate: "2026-03-18" }),
        createAnalysisTodo({ title: "독서", scheduledTime: "19:30" }),
      ];
      expect(await f.analyze.execute(f.userId, "Asia/Seoul")).toBe(1);
      expect(f.repository.saved[0]?.scheduledTime).toBeNull();
    }));

  it("여러 러닝 제목을 근거로 새 분량을 만들지 않고 대응되는 실제 원본을 저장한다", () =>
    withAiAssistanceTime(async () => {
      const f = usePatternResponse(createAiAssistanceFixture(), [
        createDetectedPattern({
          title: "러닝 30분",
          matchedTitles: ["아침 러닝", "저녁 러닝"],
          confidence: 0.9,
        }),
      ]);
      f.repository.todos = [
        createAnalysisTodo({ title: "아침 러닝", startDate: "2026-03-09" }),
        createAnalysisTodo({ title: "아침 러닝", startDate: "2026-03-16" }),
        createAnalysisTodo({ title: "저녁 러닝", startDate: "2026-03-17", completed: false }),
      ];
      expect(await f.analyze.execute(f.userId, "Asia/Seoul")).toBe(1);
      expect(f.repository.saved[0]).toMatchObject({ title: "아침 러닝", daysOfWeek: ["MON"] });
    }));

  it("빈 matchedTitles로 실제 러닝의 새 분량을 우회하면 안전하게 제외한다", () =>
    withAiAssistanceTime(async () => {
      const f = usePatternResponse(createAiAssistanceFixture(), [
        createDetectedPattern({
          title: "러닝 30분",
          matchedTitles: [],
        }),
      ]);
      f.repository.todos = ["2026-03-02", "2026-03-09", "2026-03-16"].map((startDate) =>
        createAnalysisTodo({ title: "러닝", startDate }),
      );
      expect(await f.analyze.execute(f.userId, "Asia/Seoul")).toBe(0);
      expect(f.repository.saved).toEqual([]);
    }));
});
