import {
  RecordingEmailBudget,
  RecordingEmailDeliveryQueue,
} from "#test/doubles/notification/recording-email-delivery";
import { StubEmailTemplateRenderer } from "#test/doubles/notification/stub-email-template-renderer";

import { QueueEmailMessageUseCase } from "./queue-email-message.use-case.js";
import { SendUserReportEmailUseCase } from "./send-user-report-email.use-case.js";

describe("SendUserReportEmailUseCase — 신고 접수 메일", () => {
  it("신고는 신고 ID를 deliveryId로 써서 같은 신고가 큐에 한 번만 담기게 한다", async () => {
    // Given
    const queue = new RecordingEmailDeliveryQueue();
    const budget = new RecordingEmailBudget();
    const sendUserReportEmail = new SendUserReportEmailUseCase({
      renderer: new StubEmailTemplateRenderer(),
      queueEmailMessage: new QueueEmailMessageUseCase({
        queue,
        budget,
        logger: { log: () => undefined, warn: () => undefined },
      }),
    });

    // When
    await sendUserReportEmail.execute({
      to: "support@test.com",
      templateData: {
        reportId: "report-1",
        reporterId: "u1",
        reporterTag: "A",
        targetUserId: "u2",
        targetUserTag: "B",
        targetType: "PROFILE",
        targetTypeLabel: "사용자",
        targetId: null,
        reason: "SPAM",
        reasonLabel: "스팸",
        detail: null,
        submittedAt: "2026-03-09 10:00",
        resolutionEndpoint: "POST /x",
        resolutionDocsUrl: null,
      },
    });

    // Then
    expect(queue.deliveries[0]?.deliveryId).toBe("user-report:report-1");
    expect(budget.reserved).toEqual(["standard"]);
  });
});
