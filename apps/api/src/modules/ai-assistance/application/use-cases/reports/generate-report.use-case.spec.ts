import { AiProviderError } from "#api/modules/ai-assistance/ai-assistance-parsing.public";
import {
  createAiAssistanceFixture,
  pauseAiResponse,
  useReportActivity,
  useReportResponse,
  withAiAssistanceTime,
} from "#test/fixtures/ai-assistance.fixture";
import { createReportAiResponse } from "#test/fixtures/ai-response.fixture";

describe("GenerateReport", () => {
  it.each([
    {
      type: "MONTHLY" as const,
      now: "2026-04-02T12:00:00Z",
      start: "2026-03-01T05:00:00.000Z",
      end: "2026-04-01T04:00:00.000Z",
      previous: "2026-02-01T05:00:00.000Z",
      previousEnd: "2026-03-01T05:00:00.000Z",
    },
    {
      type: "WEEKLY" as const,
      now: "2026-03-16T12:00:00Z",
      start: "2026-03-09T04:00:00.000Z",
      end: "2026-03-16T04:00:00.000Z",
      previous: "2026-03-02T05:00:00.000Z",
      previousEnd: "2026-03-09T04:00:00.000Z",
    },
  ])(
    "New York $type 집계의 각 calendar 경계는 해당 날짜 DST offset으로 변환한다",
    ({ type, now, start, end, previous, previousEnd }) =>
      withAiAssistanceTime(async () => {
        // Given - 3월 DST 전환을 걸치는 실제 리포트 기간
        const f = useReportResponse(createAiAssistanceFixture());
        // When - 실제 GenerateReport가 StatsReader에 범위를 전달
        await f.generateReport.execute({ userId: f.userId, timezone: "America/New_York", type });
        // Then - UTC timestamp와 배타적 종료를 모두 보존
        expect(f.todoStatsReader.calls[0]).toMatchObject({
          startDate: new Date(start),
          endDate: new Date(end),
          prevStartDate: new Date(previous),
          prevEndDate: new Date(previousEnd),
        });
      }, new Date(now)),
  );
  it.each([
    {
      name: "서울 2027-01-04(월) 00:10은 53주차(12-28~01-03)를 집계한다",
      type: "WEEKLY" as const,
      timezone: "Asia/Seoul",
      now: "2027-01-03T15:10:00Z",
      year: 2026,
      period: 53,
      start: "2026-12-27T15:00:00.000Z",
      end: "2027-01-03T15:00:00.000Z",
      previous: "2026-12-20T15:00:00.000Z",
    },
    {
      name: "같은 순간 LA는 아직 일요일이라 52주차를 집계한다",
      type: "WEEKLY" as const,
      timezone: "America/Los_Angeles",
      now: "2027-01-03T15:10:00Z",
      year: 2026,
      period: 52,
      start: "2026-12-21T08:00:00.000Z",
      end: "2026-12-28T08:00:00.000Z",
      previous: "2026-12-14T08:00:00.000Z",
    },
    {
      name: "LA 2027-01-04(월) 00:10은 53주차를 집계한다",
      type: "WEEKLY" as const,
      timezone: "America/Los_Angeles",
      now: "2027-01-04T08:10:00Z",
      year: 2026,
      period: 53,
      start: "2026-12-28T08:00:00.000Z",
      end: "2027-01-04T08:00:00.000Z",
      previous: "2026-12-21T08:00:00.000Z",
    },
    {
      name: "서울 일요일 23:59:59는 아직 직전 주(52주차)가 마지막 완료 주이다",
      type: "WEEKLY" as const,
      timezone: "Asia/Seoul",
      now: "2027-01-03T14:59:59Z",
      year: 2026,
      period: 52,
      start: "2026-12-20T15:00:00.000Z",
      end: "2026-12-27T15:00:00.000Z",
      previous: "2026-12-13T15:00:00.000Z",
    },
    {
      name: "서울 월요일 00:00:00 정각부터 53주차가 완료 주이다",
      type: "WEEKLY" as const,
      timezone: "Asia/Seoul",
      now: "2027-01-03T15:00:00Z",
      year: 2026,
      period: 53,
      start: "2026-12-27T15:00:00.000Z",
      end: "2027-01-03T15:00:00.000Z",
      previous: "2026-12-20T15:00:00.000Z",
    },
    {
      name: "LA 봄 전환 다음 월요일의 지난 주는 167시간이다",
      type: "WEEKLY" as const,
      timezone: "America/Los_Angeles",
      now: "2028-03-13T07:10:00Z",
      year: 2028,
      period: 10,
      start: "2028-03-06T08:00:00.000Z",
      end: "2028-03-13T07:00:00.000Z",
      previous: "2028-02-28T08:00:00.000Z",
    },
    {
      name: "LA 가을 전환 다음 월요일의 지난 주는 169시간이다",
      type: "WEEKLY" as const,
      timezone: "America/Los_Angeles",
      now: "2028-11-06T08:10:00Z",
      year: 2028,
      period: 44,
      start: "2028-10-30T07:00:00.000Z",
      end: "2028-11-06T08:00:00.000Z",
      previous: "2028-10-23T07:00:00.000Z",
    },
    {
      name: "서울 2028-03-01 00:10은 윤년 2월 전체(29일)를 집계한다",
      type: "MONTHLY" as const,
      timezone: "Asia/Seoul",
      now: "2028-02-29T15:10:00Z",
      year: 2028,
      period: 2,
      start: "2028-01-31T15:00:00.000Z",
      end: "2028-02-29T15:00:00.000Z",
      previous: "2027-12-31T15:00:00.000Z",
    },
    {
      name: "서울 2027-03-01 00:10은 평년 2월(28일)을 집계한다",
      type: "MONTHLY" as const,
      timezone: "Asia/Seoul",
      now: "2027-02-28T15:10:00Z",
      year: 2027,
      period: 2,
      start: "2027-01-31T15:00:00.000Z",
      end: "2027-02-28T15:00:00.000Z",
      previous: "2026-12-31T15:00:00.000Z",
    },
    {
      name: "서울 2027-01-01 00:10은 직전 해 12월을 집계한다",
      type: "MONTHLY" as const,
      timezone: "Asia/Seoul",
      now: "2026-12-31T15:10:00Z",
      year: 2026,
      period: 12,
      start: "2026-11-30T15:00:00.000Z",
      end: "2026-12-31T15:00:00.000Z",
      previous: "2026-10-31T15:00:00.000Z",
    },
    {
      name: "같은 순간 LA는 아직 12월 31일이라 11월을 집계한다",
      type: "MONTHLY" as const,
      timezone: "America/Los_Angeles",
      now: "2026-12-31T15:10:00Z",
      year: 2026,
      period: 11,
      start: "2026-11-01T07:00:00.000Z",
      end: "2026-12-01T08:00:00.000Z",
      previous: "2026-10-01T07:00:00.000Z",
    },
    {
      name: "LA 4월 1일(서머타임 중)은 전환이 낀 3월을 23시간 짧은 경계로 집계한다",
      type: "MONTHLY" as const,
      timezone: "America/Los_Angeles",
      now: "2028-04-01T07:10:00Z",
      year: 2028,
      period: 3,
      start: "2028-03-01T08:00:00.000Z",
      end: "2028-04-01T07:00:00.000Z",
      previous: "2028-02-01T08:00:00.000Z",
    },
    {
      name: "LA 12월 1일은 서머타임이 끝난 11월을 25시간 긴 경계로 집계한다",
      type: "MONTHLY" as const,
      timezone: "America/Los_Angeles",
      now: "2028-12-01T08:10:00Z",
      year: 2028,
      period: 11,
      start: "2028-11-01T07:00:00.000Z",
      end: "2028-12-01T08:00:00.000Z",
      previous: "2028-10-01T07:00:00.000Z",
    },
  ])("$name", ({ type, timezone, now, year, period, start, end, previous }) =>
    withAiAssistanceTime(async () => {
      // Given - 고정된 현재 순간과 사용자 시간대
      const f = useReportResponse(createAiAssistanceFixture());
      // When
      await f.generateReport.execute({ userId: f.userId, timezone, type });
      // Then - 사용자 로컬 달력 기준 마지막으로 완료된 주기와 배타적 종료
      expect(f.reportRepository.saved[0]).toMatchObject({ type, year, period });
      expect(f.todoStatsReader.calls[0]).toMatchObject({
        startDate: new Date(start),
        endDate: new Date(end),
        prevStartDate: new Date(previous),
        prevEndDate: new Date(start),
      });
    }, new Date(now)),
  );

  it.each(["WEEKLY", "MONTHLY"] as const)("기존 %s 리포트가 있으면 AI와 저장을 생략한다", (type) =>
    withAiAssistanceTime(async () => {
      // Given - 같은 기간의 기존 리포트
      const f = createAiAssistanceFixture();
      f.reportRepository.duplicate = true;
      // When - 실제 생성 요청
      expect(
        await f.generateReport.execute({ userId: f.userId, timezone: "Asia/Seoul", type }),
      ).toBeNull();
      // Then - 집계·AI·저장 모두 생략
      expect(f.todoStatsReader.calls).toEqual([]);
      expect(f.aiProvider.getCallCount()).toBe(0);
      expect(f.reportRepository.saved).toEqual([]);
    }),
  );

  it.each([
    {
      type: "WEEKLY" as const,
      locale: "ko" as const,
      period: 11,
      start: "2026-03-08T15:00:00.000Z",
    },
    {
      type: "MONTHLY" as const,
      locale: "en" as const,
      period: 2,
      start: "2026-01-31T15:00:00.000Z",
    },
  ])(
    "$locale $type 리포트는 실제 기간·AI 콘텐츠·통계·locale·출처를 저장한다",
    ({ type, locale, period, start }) =>
      withAiAssistanceTime(async () => {
        // Given - locale별 실제 schema를 통과하는 완전 응답, 활동 있는 집계
        const f = useReportResponse(createAiAssistanceFixture(), locale);
        // When - 주간 또는 월간 생성
        const result = await f.generateReport.execute({
          userId: f.userId,
          timezone: "Asia/Seoul",
          type,
          locale,
        });
        // Then - 이전 기간과 저장 결과 확인
        expect(result?.id).toBe(1);
        expect(f.reportRepository.saved[0]).toMatchObject({
          type,
          year: 2026,
          period,
          locale,
          hasActivity: true,
          aiSummary: createReportAiResponse(locale).summary,
          aiTips: createReportAiResponse(locale).tips,
          stats: { totalTodos: 4, completedTodos: 3 },
          contentSource: "AI",
          promptVersion: "report@v2",
        });
        expect(f.todoStatsReader.calls[0]?.startDate.toISOString()).toBe(start);
        expect(f.aiProvider.getCallCount()).toBe(1);
        expect(f.access.locks).toEqual([true]);
        expect(f.access.reads.map((row) => row.inUnitOfWork)).toEqual([false, true]);
      }),
  );

  it("ADMIN은 FREE 상태에서도 생성할 수 있다", () =>
    withAiAssistanceTime(async () => {
      // Given - 활성 ADMIN, FREE 구독
      const f = useReportResponse(createAiAssistanceFixture());
      f.access.role = "ADMIN";
      f.access.subscriptionStatus = "FREE";
      // When - 실제 생성
      const report = await f.generateReport.execute({
        userId: f.userId,
        timezone: "Asia/Seoul",
        type: "WEEKLY",
      });
      // Then - 유료 역할 예외 유지
      expect(report?.id).toBe(1);
      expect(f.reportRepository.saved).toHaveLength(1);
    }));

  it.each(["FREE", "EXPIRED", "deleted"])("실행 전 %s 계정은 fallback도 저장하지 않는다", (state) =>
    withAiAssistanceTime(async () => {
      // Given - 유료 상태 변경 또는 retained ACTIVE soft deletion, provider 불가용
      const f = createAiAssistanceFixture();
      f.aiProvider.setAvailable(false);
      if (state === "deleted") {
        f.access.deletedAt = new Date();
        f.access.status = "SUSPENDED";
      } else f.access.subscriptionStatus = state;
      // When - 실제 생성
      expect(
        await f.generateReport.execute({
          userId: f.userId,
          timezone: "Asia/Seoul",
          type: "WEEKLY",
        }),
      ).toBeNull();
      // Then - AI·fallback·쓰기 모두 0
      expect(f.aiProvider.getCallCount()).toBe(0);
      expect(f.reportRepository.saved).toEqual([]);
      expect(f.todoStatsReader.calls).toEqual([]);
    }),
  );

  it.each(["FREE", "deleted", "duplicate"])(
    "AI 응답 중 %s가 되면 final gate에서 저장을 생략한다",
    (state) =>
      withAiAssistanceTime(async () => {
        // Given - 정상 유료 사용자, AI 응답 대기
        const f = useReportResponse(createAiAssistanceFixture());
        const gate = pauseAiResponse(f.aiProvider);
        const pending = f.generateReport.execute({
          userId: f.userId,
          timezone: "Asia/Seoul",
          type: "WEEKLY",
        });
        try {
          await gate.entered;
          // When - 저장 직전 최신 상태 또는 동일 기간 report 변경
          if (state === "FREE") f.access.subscriptionStatus = "FREE";
          else if (state === "deleted") {
            f.access.status = "SUSPENDED";
            f.access.deletedAt = new Date();
          } else f.reportRepository.duplicate = true;
        } finally {
          gate.release();
        }
        // Then - 이미 시작한 AI 1회, 실제 저장 0
        expect(await pending).toBeNull();
        expect(f.aiProvider.getCallCount()).toBe(1);
        expect(f.reportRepository.saved).toEqual([]);
        expect(f.access.locks).toEqual([true]);
      }),
  );

  it.each(["ko", "en"] as const)(
    "%s에서 실제 schema가 거절한 출력은 locale fallback으로 저장한다",
    (locale) =>
      withAiAssistanceTime(async () => {
        // Given - summary/tips 필수 필드가 없는 실제 원본
        const f = useReportActivity(createAiAssistanceFixture());
        f.aiProvider.setRawResponse({});
        // When - 실제 report schema를 사용하는 생성
        const result = await f.generateReport.execute({
          userId: f.userId,
          timezone: "Asia/Seoul",
          type: "WEEKLY",
          locale,
        });
        // Then - 정상 fixture와 구분되는 비어 있지 않은 fallback
        expect(result).not.toBeNull();
        expect(f.reportRepository.saved[0]?.locale).toBe(locale);
        expect(f.reportRepository.saved[0]?.aiSummary).toBeTruthy();
        expect(f.reportRepository.saved[0]?.aiSummary).not.toBe(
          createReportAiResponse(locale).summary,
        );
        expect(f.reportRepository.saved[0]?.contentSource).toBe("FALLBACK");
        expect(f.aiProvider.getCallCount()).toBe(1);
      }),
  );

  it("provider 불가용 시 호출 없이 fallback을 저장한다", () =>
    withAiAssistanceTime(async () => {
      // Given - 유료 사용자, provider 불가용
      const f = useReportActivity(createAiAssistanceFixture());
      f.aiProvider.setAvailable(false);
      // When - 실제 생성
      expect(
        await f.generateReport.execute({
          userId: f.userId,
          timezone: "Asia/Seoul",
          type: "WEEKLY",
        }),
      ).not.toBeNull();
      // Then - AI 없이 로컬 fallback 저장
      expect(f.aiProvider.getCallCount()).toBe(0);
      expect(f.reportRepository.saved[0]?.aiSummary).toBeTruthy();
    }));

  it("활동이 없는 기간은 LLM을 부르지 않고 템플릿을 저장한다", () =>
    withAiAssistanceTime(async () => {
      // Given - 기록 없는 집계
      const f = createAiAssistanceFixture();
      // When
      await f.generateReport.execute({ userId: f.userId, timezone: "Asia/Seoul", type: "WEEKLY" });
      // Then
      expect(f.aiProvider.getCallCount()).toBe(0);
      expect(f.reportRepository.saved[0]).toMatchObject({
        hasActivity: false,
        contentSource: "TEMPLATE",
        promptVersion: null,
        aiTips: ["다음 주에 해보고 싶은 작은 일 하나를 등록해보세요."],
      });
    }));

  it.each(["RATE_LIMITED", "UPSTREAM", "TIMEOUT"] as const)(
    "마지막 시도 전 %s는 폴백을 저장하지 않고 잡 재시도를 위해 다시 던진다",
    (kind) =>
      withAiAssistanceTime(async () => {
        // Given
        const f = useReportActivity(createAiAssistanceFixture());
        const failure = new AiProviderError(kind, undefined);
        f.aiProvider.setInvalidResponse(failure);
        // When
        const execution = f.generateReport.execute({
          userId: f.userId,
          timezone: "Asia/Seoul",
          type: "WEEKLY",
          isFinalAttempt: false,
        });
        // Then
        await expect(execution).rejects.toBe(failure);
        expect(f.reportRepository.saved).toEqual([]);
        expect(f.unitOfWork.runs).toBe(0);
      }),
  );

  it("마지막 시도의 일시 오류는 통계 기반 폴백을 FALLBACK 출처로 저장한다", () =>
    withAiAssistanceTime(async () => {
      // Given
      const f = useReportActivity(createAiAssistanceFixture());
      f.aiProvider.setInvalidResponse(new AiProviderError("RATE_LIMITED", 429));
      // When
      await f.generateReport.execute({
        userId: f.userId,
        timezone: "Asia/Seoul",
        type: "WEEKLY",
        isFinalAttempt: true,
      });
      // Then
      expect(f.reportRepository.saved[0]).toMatchObject({
        contentSource: "FALLBACK",
        promptVersion: null,
        aiSummary: "2026년 11주차에는 할 일 4개 중 3개를 완료해 달성률 75%였어요.",
      });
      expect(f.logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "ai.generation.failed",
          task: "report",
          outcome: "FALLBACK",
          errorKind: "RATE_LIMITED",
          quotaCharged: false,
        }),
      );
    }));

  it("재시도로 회복되지 않는 출력 오류는 첫 시도에서도 폴백을 저장한다", () =>
    withAiAssistanceTime(async () => {
      // Given
      const f = useReportActivity(createAiAssistanceFixture());
      f.aiProvider.setInvalidResponse(new AiProviderError("TRUNCATED", undefined));
      // When
      const result = await f.generateReport.execute({
        userId: f.userId,
        timezone: "Asia/Seoul",
        type: "WEEKLY",
        isFinalAttempt: false,
      });
      // Then
      expect(result).not.toBeNull();
      expect(f.reportRepository.saved[0]?.contentSource).toBe("FALLBACK");
    }));

  it("요약·팁이 비어 있는 출력은 저장하지 않고 폴백으로 바꾼다", () =>
    withAiAssistanceTime(async () => {
      // Given
      const f = useReportActivity(createAiAssistanceFixture());
      f.aiProvider.setRawResponse({ summary: " ", tips: [] });
      // When
      await f.generateReport.execute({ userId: f.userId, timezone: "Asia/Seoul", type: "WEEKLY" });
      // Then
      expect(f.reportRepository.saved[0]?.contentSource).toBe("FALLBACK");
    }));

  it("다른 언어로 저장된 지난 팁은 프롬프트에 넣지 않는다", () =>
    withAiAssistanceTime(async () => {
      // Given - 지난 리포트는 ko, 이번 생성은 en
      const f = useReportResponse(createAiAssistanceFixture(), "en");
      await f.reportRepository.create({
        userId: f.userId,
        type: "WEEKLY",
        year: 2026,
        period: 1,
        stats: {
          totalTodos: 1,
          completedTodos: 1,
          completionRate: 100,
          prevCompletionRate: null,
          streakDays: 1,
        },
        categoryBreakdown: [],
        dayPatterns: [],
        timePatterns: [],
        aiSummary: "요약",
        aiTips: ["지난 한국어 팁"],
        locale: "ko",
        hasActivity: true,
        generatedAt: new Date("2026-01-05T00:00:00Z"),
        contentSource: "AI",
        promptVersion: "report@v2",
      });
      // When
      await f.generateReport.execute({
        userId: f.userId,
        timezone: "Asia/Seoul",
        type: "WEEKLY",
        locale: "en",
      });
      // Then
      expect(f.aiProvider.getLastPrompt()).not.toContain("지난 한국어 팁");
      expect(f.aiProvider.getLastPrompt()).toContain('"start": "2026-03-09"');
      expect(f.aiProvider.getLastPrompt()).toContain('"end": "2026-03-15"');
    }));
});
