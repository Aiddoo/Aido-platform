import { AiReportJobName, AiReportRuntimeJobSchema } from "./ai-report-queue";

describe("AiReportRuntimeJobSchema", () => {
	it("리포트 종류와 사용자 생성 payload를 런타임에 검증한다", () => {
		expect(
			AiReportRuntimeJobSchema.safeParse({
				name: AiReportJobName.GENERATE,
				data: {
					userId: "user-1",
					timezone: "Asia/Seoul",
					reportType: "WEEKLY",
				},
			}).success,
		).toBe(true);
		expect(
			AiReportRuntimeJobSchema.safeParse({
				name: AiReportJobName.DISPATCH,
				data: { reportType: "YEARLY" },
			}).success,
		).toBe(false);
	});
});
