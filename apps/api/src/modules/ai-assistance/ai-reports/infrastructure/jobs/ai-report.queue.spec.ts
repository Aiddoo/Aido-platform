import { AiReportJobName, AiReportRuntimeJobSchema } from "./ai-report.queue.js";

describe("AiReportRuntimeJobSchema", () => {
  it("리포트 종류와 사용자 생성 payload를 런타임에 검증한다", () => {
    // When
    const generateResult = AiReportRuntimeJobSchema.safeParse({
      name: AiReportJobName.GENERATE,
      data: {
        userId: "user-1",
        timezone: "Asia/Seoul",
        reportType: "WEEKLY",
      },
    });
    const dispatchResult = AiReportRuntimeJobSchema.safeParse({
      name: AiReportJobName.DISPATCH,
      data: { reportType: "YEARLY" },
    });

    // Then
    expect(generateResult.success).toBe(true);
    expect(dispatchResult.success).toBe(false);
  });
});
