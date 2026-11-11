import type { AiReportRepositoryPort } from "#api/modules/ai-assistance/reports/application/ports/ai-report.repository.port";
import { DuplicateAiReportError } from "#api/modules/ai-assistance/reports/application/reports.errors";
import type {
  AiReport,
  AiReportPrimitives,
} from "#api/modules/ai-assistance/reports/domain/ai-report.aggregate";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  AI_REPORT_FIXTURE_NOW,
  AI_REPORT_FIXTURE_OTHER_USER_ID,
  AI_REPORT_FIXTURE_USER_ID,
  createAiReportFixture,
} from "#test/fixtures/ai-assistance/ai-report.fixture";

const USER_ID = UserId.reconstitute(AI_REPORT_FIXTURE_USER_ID);
const OTHER_USER_ID = UserId.reconstitute(AI_REPORT_FIXTURE_OTHER_USER_ID);

async function saveReport(
  repository: AiReportRepositoryPort,
  overrides: Partial<AiReportPrimitives> = {},
): Promise<AiReport> {
  const report = createAiReportFixture({ id: (await repository.nextId()).value, ...overrides });
  await repository.save(report);
  return report;
}

export function describeAiReportRepositoryContract(
  createRepository: () => Promise<AiReportRepositoryPort>,
): void {
  describe("AI 리포트 저장소 계약", () => {
    it("저장한 리포트는 주인에게만 보이고 모든 값을 그대로 돌려준다", async () => {
      // Given
      const repository = await createRepository();
      const report = await saveReport(repository);

      // When
      const found = await repository.findByIdAndUserId(report.id, USER_ID);
      const foreign = await repository.findByIdAndUserId(report.id, OTHER_USER_ID);

      // Then
      expect(found?.toPrimitives()).toEqual(report.toPrimitives());
      expect(foreign).toBeNull();
    });

    it("같은 사용자·종류·주기의 다른 리포트를 저장하면 중복 오류이고 처음 리포트가 남는다", async () => {
      // Given
      const repository = await createRepository();
      const first = await saveReport(repository, { period: 11 });

      // When
      const duplicate = saveReport(repository, { period: 11, aiSummary: "나중 요약" });

      // Then
      await expect(duplicate).rejects.toBeInstanceOf(DuplicateAiReportError);
      expect(
        await repository.existsForPeriod({
          userId: USER_ID,
          type: "WEEKLY",
          year: 2026,
          period: 11,
        }),
      ).toBe(true);
      expect((await repository.findLatest(USER_ID, "WEEKLY"))?.id.value).toBe(first.id.value);
    });

    it("최신 리포트와 목록은 분석 시각이 늦은 순서이고 같은 시각이면 id가 큰 쪽이 먼저다", async () => {
      // Given
      const repository = await createRepository();
      const older = await saveReport(repository, { period: 8 });
      const tiedLow = await saveReport(repository, {
        period: 9,
        generatedAt: AI_REPORT_FIXTURE_NOW.add({ hours: 1 }),
      });
      const tiedHigh = await saveReport(repository, {
        period: 10,
        generatedAt: AI_REPORT_FIXTURE_NOW.add({ hours: 1 }),
      });
      const monthly = await saveReport(repository, {
        type: "MONTHLY",
        period: 3,
        generatedAt: AI_REPORT_FIXTURE_NOW.add({ hours: 2 }),
      });
      await saveReport(repository, { userId: AI_REPORT_FIXTURE_OTHER_USER_ID, period: 12 });

      // When
      const latestWeekly = await repository.findLatest(USER_ID, "WEEKLY");
      const weekly = await repository.listByUserId({ userId: USER_ID, type: "WEEKLY", limit: 10 });
      const all = await repository.listByUserId({ userId: USER_ID, type: null, limit: 3 });

      // Then
      expect(latestWeekly?.id.value).toBe(tiedHigh.id.value);
      expect(weekly.map((report) => report.id.value)).toEqual([
        tiedHigh.id.value,
        tiedLow.id.value,
        older.id.value,
      ]);
      expect(all.map((report) => report.id.value)).toEqual([
        monthly.id.value,
        tiedHigh.id.value,
        tiedLow.id.value,
      ]);
    });

    it("다른 주기·종류·사용자의 리포트는 그 주기 존재로 세지 않는다", async () => {
      // Given
      const repository = await createRepository();
      await saveReport(repository, { period: 10 });
      await saveReport(repository, { type: "MONTHLY", period: 11 });
      await saveReport(repository, { userId: AI_REPORT_FIXTURE_OTHER_USER_ID, period: 11 });

      // When
      const exists = await repository.existsForPeriod({
        userId: USER_ID,
        type: "WEEKLY",
        year: 2026,
        period: 11,
      });

      // Then
      expect(exists).toBe(false);
    });
  });
}
