import type { EmailProviderId } from "#api/platform/config/schemas/email.schema";
import { TypedConfigService } from "#api/platform/config/services/config.service";
import type { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";

import type { EmailSenderPort } from "../../application/ports/email-sender.port.js";
import { LogEmailSenderAdapter } from "./log-email-sender.adapter.js";
import { ResendEmailSenderAdapter } from "./resend-email-sender.adapter.js";

/** 어댑터를 더하려면 EmailProviderId와 이 표에 한 줄씩 더한다. */
const adapters = {
  resend: (config, policies) =>
    new ResendEmailSenderAdapter(
      {
        apiKey: config.email.apiKey ?? null,
        from: config.email.from,
        fromName: config.email.fromName,
        environment: config.nodeEnv,
      },
      policies,
    ),
  log: () => new LogEmailSenderAdapter(),
} satisfies Record<
  EmailProviderId,
  (config: TypedConfigService, policies: OutboundPolicyRegistry) => EmailSenderPort
>;

export function createEmailSender(
  config: TypedConfigService,
  policies: OutboundPolicyRegistry,
): EmailSenderPort {
  return adapters[config.email.provider](config, policies);
}
