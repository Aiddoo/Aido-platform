import { Logger } from "@nestjs/common";
import { vi } from "vitest";

import { createVerificationCodeEmail } from "../../../application/services/email/email-message.factory.js";
import { EmailLogEvent } from "../../observability/email/email-log.events.js";
import { describeEmailSenderContract } from "./email-sender.contract.js";
import { LogEmailSenderAdapter } from "./log-email-sender.adapter.js";

describe("LogEmailSenderAdapter", () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, "debug").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describeEmailSenderContract({
    scenarios: ["success"],
    arrange: () => new LogEmailSenderAdapter(),
  });

  it("보내지 않고 종류만 로그에 남기며 수신자와 인증 코드는 남기지 않는다", async () => {
    // Given
    const message = createVerificationCodeEmail("private@example.com", {
      code: "987654",
      expiryMinutes: 10,
    });

    // When
    const outcome = await new LogEmailSenderAdapter().send(message);

    // Then
    expect(outcome).toEqual({ status: "sent", providerMessageId: null });
    expect(Logger.prototype.debug).toHaveBeenCalledExactlyOnceWith({
      event: EmailLogEvent.DELIVERY_SIMULATED,
      kind: "verification",
    });
  });
});
