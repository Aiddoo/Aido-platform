import { Logger } from "@nestjs/common";
import { vi } from "vitest";

import { describeEmailSenderContract } from "#test/contracts/notification/email-sender.contract";
import {
  createEmailMessageFixture,
  EMAIL_MESSAGE_FIXTURE_CODE,
  EMAIL_MESSAGE_FIXTURE_RECIPIENT,
} from "#test/fixtures/notification/email-message.fixture";

import { EmailLogEvent } from "./email-provider.log-events.js";
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
    const message = createEmailMessageFixture();

    // When
    const outcome = await new LogEmailSenderAdapter().send(message);

    // Then
    expect(outcome).toEqual({ status: "sent", providerMessageId: null });
    expect(Logger.prototype.debug).toHaveBeenCalledExactlyOnceWith({
      event: EmailLogEvent.DELIVERY_SIMULATED,
      kind: "verification",
    });
    const logged = JSON.stringify(vi.mocked(Logger.prototype.debug).mock.calls);
    expect(logged).not.toContain(EMAIL_MESSAGE_FIXTURE_RECIPIENT);
    expect(logged).not.toContain(EMAIL_MESSAGE_FIXTURE_CODE);
  });
});
