import { ApplicationException } from "#api/shared/application/application.exception";
import { InMemoryAiReportRepository } from "#test/doubles/ai-assistance/in-memory-ai-report.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { createAiReportFixture } from "#test/fixtures/ai-assistance/ai-report.fixture";
import { StubUserLocalePreferenceReader } from "#test/mocks/ports/ai-parsing.stub";

import { GetReportStatusUseCase } from "./get-report-status.use-case.js";

const USER_ID = "clz7x5p8k0001qz0z8z8z8z8z";

function setup(at: string, options: { readonly entitled?: boolean } = {}) {
  const aiReportRepository = new InMemoryAiReportRepository([
    createAiReportFixture({ userId: USER_ID, type: "WEEKLY" }),
  ]);
  const localePreferenceReader = new StubUserLocalePreferenceReader();
  const useCase = new GetReportStatusUseCase({
    aiReportRepository,
    entitlementReader: { can: async () => options.entitled ?? true },
    localePreferenceReader,
    clock: new FixedClock(Temporal.Instant.from(at)),
  });
  return { useCase, localePreferenceReader };
}

describe("GetReportStatusUseCase", () => {
  it("프리미엄이 아니면 리포트를 읽지 않고 거절한다", async () => {
    // Given
    const { useCase } = setup("2026-03-08T14:00:00Z", { entitled: false });

    // When
    const status = useCase.execute({ userId: USER_ID, timezone: "Asia/Seoul" });

    // Then
    await expect(status).rejects.toBeInstanceOf(ApplicationException);
  });

  it("남은 날은 시간이 아니라 사용자 달력 날짜로 센다", async () => {
    // Given - 일요일 23:00 KST
    const { useCase } = setup("2026-03-08T14:00:00Z");

    // When
    const status = await useCase.execute({ userId: USER_ID, timezone: "Asia/Seoul" });

    // Then
    expect(status.daysUntilWeekly).toBe(1);
    expect(status.latestWeekly?.id.value).toBe(1);
    expect(status.latestMonthly).toBeNull();
  });

  it("LA 일요일 저녁에는 LA 월요일 08:00을 다음 주간 리포트로 안내한다", async () => {
    // Given - LA 2026-10-25(일) 18:00, 서울은 이미 월요일 10:00
    const { useCase } = setup("2026-10-26T01:00:00Z");

    // When
    const status = await useCase.execute({ userId: USER_ID, timezone: "America/Los_Angeles" });

    // Then
    expect(status.nextWeeklyAt.toString()).toBe("2026-10-26T15:00:00Z");
    expect(status.daysUntilWeekly).toBe(1);
    expect(status.nextMonthlyAt.toString()).toBe("2026-11-01T16:00:00Z");
    expect(status.daysUntilMonthly).toBe(7);
  });

  it("서머타임이 끝난 뒤의 월요일 08:00은 PST 오프셋으로 계산한다", async () => {
    // Given - LA 2026-11-01(일) 12:00 PST
    const { useCase } = setup("2026-11-01T20:00:00Z");

    // When
    const status = await useCase.execute({ userId: USER_ID, timezone: "America/Los_Angeles" });

    // Then
    expect(status.nextWeeklyAt.toString()).toBe("2026-11-02T16:00:00Z");
    expect(status.nextMonthlyAt.toString()).toBe("2026-12-01T16:00:00Z");
  });

  it("X-Timezone이 없으면 저장된 사용자 시간대를 쓴다", async () => {
    // Given - 서울 2026-10-26(월) 07:00
    const { useCase, localePreferenceReader } = setup("2026-10-25T22:00:00Z");
    localePreferenceReader.preferences.set(USER_ID, { timezone: "Asia/Seoul", locale: "ko" });

    // When
    const status = await useCase.execute({ userId: USER_ID, timezone: undefined });

    // Then
    expect(status.nextWeeklyAt.toString()).toBe("2026-10-25T23:00:00Z");
    expect(status.daysUntilWeekly).toBe(0);
  });
});
