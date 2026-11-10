import { ReportGenerationProcessor } from "./report-generation.processor.js";

class RecordingGenerateReport {
  readonly inputs: Array<{ readonly isFinalAttempt?: boolean }> = [];
  async execute(input: { readonly isFinalAttempt?: boolean }) {
    this.inputs.push(input);
    return null;
  }
}

const generateJob = {
  name: "generate-report",
  data: { userId: "user-1", timezone: "Asia/Seoul", locale: "ko", reportType: "WEEKLY" },
};

describe("ReportGenerationProcessor", () => {
  it.each([
    { attempt: 1, isFinalAttempt: false },
    { attempt: 3, isFinalAttempt: false },
    { attempt: 4, isFinalAttempt: true },
  ])(
    "$attempt번째 시도는 마지막 시도 여부 $isFinalAttempt로 생성한다",
    async ({ attempt, isFinalAttempt }) => {
      // Given
      const generateReport = new RecordingGenerateReport();
      const processor = new ReportGenerationProcessor(generateReport);
      // When
      await processor.process(generateJob, attempt);
      // Then
      expect(generateReport.inputs).toEqual([expect.objectContaining({ isFinalAttempt })]);
    },
  );

  it("시도 번호 없이 직접 실행하면 마지막 시도로 보고 폴백까지 허용한다", async () => {
    // Given
    const generateReport = new RecordingGenerateReport();
    const processor = new ReportGenerationProcessor(generateReport);
    // When
    await processor.process(generateJob);
    // Then
    expect(generateReport.inputs).toEqual([expect.objectContaining({ isFinalAttempt: true })]);
  });
});
