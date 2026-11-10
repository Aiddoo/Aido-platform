import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import { InMemoryAiReportRepository } from "#test/doubles/ai-assistance/in-memory-ai-report.repository";
import {
  AI_REPORT_FIXTURE_OTHER_USER_ID,
  AI_REPORT_FIXTURE_USER_ID,
  createAiReportFixture,
} from "#test/fixtures/ai-assistance/ai-report.fixture";

import { GetReportByIdUseCase } from "./get-report-by-id.use-case.js";

function setup(options: { readonly entitled?: boolean } = {}) {
  const useCase = new GetReportByIdUseCase({
    aiReportRepository: new InMemoryAiReportRepository([createAiReportFixture({ id: 42 })]),
    entitlementReader: { can: async () => options.entitled ?? true },
  });
  return { useCase };
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
