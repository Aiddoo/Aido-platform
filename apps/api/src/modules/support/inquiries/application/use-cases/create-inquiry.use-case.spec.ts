import { ErrorCode, Errors } from "@aido/api/errors";

import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { StubInquiryMailer } from "#test/doubles/support/stub-inquiry-mailer";
import {
  INQUIRY_FIXTURE_NOW,
  INQUIRY_FIXTURE_USER_ID,
} from "#test/fixtures/support/inquiry.fixture";

import {
  type CreateInquiryCommand,
  type CreateInquiryDependencies,
  CreateInquiryUseCase,
} from "./create-inquiry.use-case.js";

function createCommand(overrides: Partial<CreateInquiryCommand> = {}): CreateInquiryCommand {
  return {
    userId: INQUIRY_FIXTURE_USER_ID,
    userEmail: "user@example.test",
    category: "BUG_REPORT",
    content: "  합성 문의 <b>원문</b>입니다.\n공백도 보존해 주세요.  ",
    ...overrides,
  };
}

function createUseCase(overrides: Partial<CreateInquiryDependencies> = {}) {
  return new CreateInquiryUseCase({
    clock: new FixedClock(INQUIRY_FIXTURE_NOW),
    mailer: new StubInquiryMailer(),
    logger: new SilentLogger(),
    ...overrides,
  });
}

describe("CreateInquiryUseCase — 문의 접수", () => {
  it("라벨·KST 제출 시각을 조립하고 사용자 원문을 그대로 전달한다", async () => {
    // Given
    const mailer = new StubInquiryMailer();
    const useCase = createUseCase({ mailer });
    const cases = [
      ["BUG_REPORT", "버그 신고"],
      ["FEATURE_REQUEST", "기능 요청"],
      ["PAYMENT", "결제·구독"],
      ["OTHER", "기타"],
    ] as const;

    for (const [category, categoryLabel] of cases) {
      const command = createCommand({ category });

      // When
      await useCase.execute(command);

      // Then
      expect(mailer.attempts.at(-1)).toEqual({
        userEmail: command.userEmail,
        category,
        categoryLabel,
        content: command.content,
        submittedAt: "2026-10-08 00:00 (KST)",
      });
    }
    expect(mailer.attempts).toHaveLength(4);
  });

  it("접수 로그에는 이메일과 문의 내용을 남기지 않는다", async () => {
    // Given
    const logger = new SilentLogger();
    const useCase = createUseCase({ logger });
    const command = createCommand({ category: "OTHER" });

    // When
    await useCase.execute(command);

    // Then
    expect(logger.messages).toEqual([
      { event: "support.inquiry.submitted", userId: INQUIRY_FIXTURE_USER_ID, category: "OTHER" },
    ]);
    expect(JSON.stringify(logger.messages)).not.toContain(command.userEmail);
    expect(JSON.stringify(logger.messages)).not.toContain(command.content);
  });

  it("전달이 거절되면 INQUIRY_1501을 던지고 공급자 원문을 details에 복사하지 않는다", async () => {
    // Given
    const mailer = new StubInquiryMailer();
    const privateError = "synthetic-inquiry-content-sensitive";
    mailer.result = { status: "rejected", reason: privateError };
    const logger = new SilentLogger();
    const useCase = createUseCase({ mailer, logger });

    // When
    const error = await useCase.execute(createCommand()).catch((failure: unknown) => failure);

    // Then
    expect(error).toMatchObject({
      errorCode: ErrorCode.INQUIRY_1501,
      message: Errors[ErrorCode.INQUIRY_1501].message,
      details: { userId: INQUIRY_FIXTURE_USER_ID },
    });
    expect(JSON.stringify(error)).not.toContain(privateError);
    expect(mailer.attempts).toHaveLength(1);
    expect(logger.messages).toEqual([]);
  });

  it("내용이 길이 한도를 벗어나면 전달하지 않고 SYS_0002를 던진다", async () => {
    // Given
    const mailer = new StubInquiryMailer();
    const useCase = createUseCase({ mailer });

    // When
    const result = useCase.execute(createCommand({ content: "짧음" }));

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
    expect(mailer.attempts).toEqual([]);
  });
});
