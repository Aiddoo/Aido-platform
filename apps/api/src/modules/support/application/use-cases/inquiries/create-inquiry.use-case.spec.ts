import { ErrorCode, Errors } from "@aido/api/errors";
import { mockDeep } from "vitest-mock-extended";

import type {
  InquiryDeliveryResult,
  InquiryMailerPort,
} from "../../ports/inquiries/inquiry-mailer.port.js";
import type { InquirySubmission } from "../../read-models/inquiries/inquiry-submission.read-model.js";
import { type CreateInquiryInput, CreateInquiry } from "./create-inquiry.use-case.js";

class StubInquiryMailer implements InquiryMailerPort {
  readonly attempts: InquirySubmission[] = [];
  result: InquiryDeliveryResult = { success: true };

  async deliver(submission: InquirySubmission): Promise<InquiryDeliveryResult> {
    this.attempts.push({ ...submission });
    return this.result;
  }
}

function makeInput(overrides: Partial<CreateInquiryInput> = {}): CreateInquiryInput {
  return {
    userId: "user-123",
    userEmail: "user@example.test",
    category: "BUG_REPORT",
    content: "  합성 문의 <b>원문</b>입니다.\n공백도 보존해 주세요.  ",
    ...overrides,
  };
}

function setup() {
  const mailer = new StubInquiryMailer();
  const logger = mockDeep<ConstructorParameters<typeof CreateInquiry>[0]["logger"]>();
  return { useCase: new CreateInquiry({ mailer, logger }), mailer, logger };
}

describe("CreateInquiry — 문의 접수", () => {
  it("라벨·KST 제출 시각을 조립하고 사용자 원문을 그대로 전달한다", async () => {
    // Given
    const { useCase, mailer, logger } = setup();
    const cases: readonly [CreateInquiryInput["category"], string][] = [
      ["BUG_REPORT", "버그 신고"],
      ["FEATURE_REQUEST", "기능 요청"],
      ["OTHER", "기타"],
    ];
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-07T15:00:00Z"));
    try {
      for (const [category, categoryLabel] of cases) {
        const input = makeInput({ category });
        // When
        await useCase.execute(input);
        // Then
        expect(mailer.attempts.at(-1)).toEqual({
          userEmail: input.userEmail,
          category,
          categoryLabel,
          content: input.content,
          submittedAt: "2026-10-08 00:00 (KST)",
        });
      }
      expect(mailer.attempts).toHaveLength(3);
      expect(logger.log).toHaveBeenCalledTimes(3);
      expect(logger.log).toHaveBeenCalledWith({
        event: "support.inquiry.submitted",
        userId: "user-123",
        category: "OTHER",
      });
      expect(JSON.stringify(logger.log.mock.calls)).not.toContain(makeInput().userEmail);
      expect(JSON.stringify(logger.log.mock.calls)).not.toContain(makeInput().content);
    } finally {
      vi.useRealTimers();
    }
  });

  it("INQUIRY_1501을 유지하고 공급자 원문을 실패 details에 복사하지 않는다", async () => {
    // Given
    const { useCase, mailer, logger } = setup();
    const privateError = "synthetic-inquiry-content-sensitive";
    mailer.result = { success: false, error: privateError };
    // When
    const error = await useCase.execute(makeInput()).catch((failure: unknown) => failure);
    // Then - production HTTP details는 원래 숨겨졌으며 Application 예외 경계를 검증한다.
    expect(error).toMatchObject({
      errorCode: ErrorCode.INQUIRY_1501,
      message: Errors[ErrorCode.INQUIRY_1501].message,
      details: { userId: "user-123" },
    });
    expect(JSON.stringify(error)).not.toContain(privateError);
    expect(mailer.attempts).toHaveLength(1);
    expect(logger.log).not.toHaveBeenCalled();
  });
});
