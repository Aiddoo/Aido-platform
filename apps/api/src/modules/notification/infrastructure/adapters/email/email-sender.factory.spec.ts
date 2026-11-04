import { mock } from "vitest-mock-extended";

import type { EmailProviderId } from "#api/platform/config/schemas/email.schema";
import { TypedConfigService } from "#api/platform/config/services/config.service";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { RecordingOperationalAlert } from "#test/mocks/recording-operational-alert";

import { createEmailSender } from "./email-sender.factory.js";
import { LogEmailSenderAdapter } from "./log-email-sender.adapter.js";
import { ResendEmailSenderAdapter } from "./resend-email-sender.adapter.js";

describe("createEmailSender", () => {
  it.each([
    ["resend", ResendEmailSenderAdapter],
    ["log", LogEmailSenderAdapter],
  ] as const satisfies readonly (readonly [EmailProviderId, unknown])[])(
    "EMAIL_PROVIDER=%s이면 해당 어댑터를 만든다",
    (provider, adapter) => {
      // Given
      const config = mock<TypedConfigService>({
        nodeEnv: "test",
        email: {
          provider,
          apiKey: "key",
          from: "noreply@example.com",
          fromName: "Aido",
          supportEmail: "support@example.com",
        },
      });

      // When
      const sender = createEmailSender(
        config,
        new OutboundPolicyRegistry(new RecordingOperationalAlert()),
      );

      // Then
      expect(sender).toBeInstanceOf(adapter);
    },
  );
});
