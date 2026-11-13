import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import { InMemoryAiReportRepository } from "#test/doubles/ai-assistance/in-memory-ai-report.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import {
  AI_REPORT_FIXTURE_OTHER_USER_ID,
  AI_REPORT_FIXTURE_USER_ID,
  createAiReportFixture,
} from "#test/fixtures/ai-assistance/ai-report.fixture";
import { StubUserLocalePreferenceReader } from "#test/mocks/ports/ai-parsing.stub";

import { GetReportByIdUseCase } from "./get-report-by-id.use-case.js";

function setup(options: { readonly entitled?: boolean; readonly at?: string } = {}) {
  const localePreferenceReader = new StubUserLocalePreferenceReader();
  const useCase = new GetReportByIdUseCase({
    aiReportRepository: new InMemoryAiReportRepository([createAiReportFixture({ id: 42 })]),
    entitlementReader: { can: async () => options.entitled ?? true },
    localePreferenceReader,
    clock: new FixedClock(Temporal.Instant.from(options.at ?? "2026-11-12T00:00:00Z")),
  });
  return { useCase, localePreferenceReader };
}

describe("GetReportByIdUseCase", () => {
  it("프리미엄이 아니면 리포트를 읽지 않고 거절한다", async () => {
    // Given
    const { useCase } = setup({ entitled: false });

    // When
    const report = useCase.execute({ userId: AI_REPORT_FIXTURE_USER_ID, reportId: 42 });

    // Then
    await expect(report).rejects.toBeInstanceOf(ApplicationException);
  });

  it("기간 라벨의 올해는 서버 시각을 사용자 저장 시간대의 달력 날짜로 읽은 것이다", async () => {
    // Given
    // UTC로는 아직 2026-12-31이지만 서울은 2027-01-01 00:30이다
    const { useCase, localePreferenceReader } = setup({ at: "2026-12-31T15:30:00Z" });
    localePreferenceReader.preferences.set(AI_REPORT_FIXTURE_USER_ID, {
      timezone: "Asia/Seoul",
      locale: "ko",
    });

    // When
    const { localToday } = await useCase.execute({
      userId: AI_REPORT_FIXTURE_USER_ID,
      reportId: 42,
    });

    // Then
    expect(localToday.toString()).toBe("2027-01-01");
  });

  it("남의 리포트는 없는 리포트와 같은 AI_1304다", async () => {
    // Given
    const { useCase } = setup();

    // When
    const report = useCase.execute({ userId: AI_REPORT_FIXTURE_OTHER_USER_ID, reportId: 42 });

    // Then
    await expect(report).rejects.toMatchObject({
      errorCode: ErrorCode.AI_1304,
      details: { reportId: 42 },
    });
  });
});
