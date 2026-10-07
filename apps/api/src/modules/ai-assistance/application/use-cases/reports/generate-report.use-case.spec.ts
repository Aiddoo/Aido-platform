import {
  createAiAssistanceFixture,
  pauseAiResponse,
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
    "$locale $type 리포트는 실제 기간·AI 콘텐츠·통계·locale을 저장한다",
    ({ type, locale, period, start }) =>
      withAiAssistanceTime(async () => {
        // Given - locale별 실제 schema를 통과하는 완전 응답, 활동 없는 집계
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
          hasActivity: false,
          aiSummary: createReportAiResponse(locale).summary,
          aiTips: createReportAiResponse(locale).tips,
          stats: { totalTodos: 0, completedTodos: 0 },
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
        const f = createAiAssistanceFixture();
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
        expect(f.aiProvider.getCallCount()).toBe(1);
      }),
  );

  it("provider 불가용 시 호출 없이 fallback을 저장한다", () =>
    withAiAssistanceTime(async () => {
      // Given - 유료 사용자, provider 불가용
      const f = createAiAssistanceFixture();
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
});
