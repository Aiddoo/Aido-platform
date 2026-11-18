import { InMemoryMailTransport } from "@nestjs/mail";

import type { EmailProviderId } from "#api/platform/config/schemas/email.schema";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { createTestMailer, type TestMailer } from "#test/doubles/notification/test-mailer";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";

import { selectEmailSender } from "./email-sender-factory.adapter.js";
import { LogEmailSenderAdapter } from "./log-email-sender.adapter.js";
import { NestMailEmailSenderAdapter } from "./nest-mail-email-sender.adapter.js";

describe("selectEmailSender", () => {
  let testMailer: TestMailer;

  beforeAll(async () => {
    testMailer = await createTestMailer(new InMemoryMailTransport());
  });

  afterAll(async () => {
    await testMailer.close();
  });

  it.each([
    ["resend", NestMailEmailSenderAdapter],
    ["log", LogEmailSenderAdapter],
  ] as const satisfies readonly (readonly [EmailProviderId, unknown])[])(
    "EMAIL_PROVIDER=%s이면 해당 어댑터로 보낸다",
    (provider, adapter) => {
      // Given
      const nestMail = new NestMailEmailSenderAdapter({
        mailer: testMailer.mailer,
        policies: new OutboundPolicyRegistry(new RecordingOperationalAlert()),
        isConfigured: true,
      });

      // When
      const sender = selectEmailSender(provider, nestMail);

      // Then
      expect(sender).toBeInstanceOf(adapter);
    },
  );
});
