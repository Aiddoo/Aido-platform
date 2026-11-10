import { HttpClient } from "@nestjs/http-client";
import { mock } from "vitest-mock-extended";

import type { AdminNotifierProviderId } from "#api/platform/config/schemas/webhook.schema";
import { TypedConfigService } from "#api/platform/config/services/config.service";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { RecordingOperationalAlert } from "#test/mocks/recording-operational-alert";

import { createAdminNotifier } from "./admin-notifier-selection.adapter.js";
import { DiscordAdminNotifierAdapter } from "./discord-admin-notifier.adapter.js";
import { LogAdminNotifierAdapter } from "./log-admin-notifier.adapter.js";

describe("createAdminNotifier", () => {
  it.each([
    ["discord", DiscordAdminNotifierAdapter],
    ["log", LogAdminNotifierAdapter],
  ] as const satisfies readonly (readonly [AdminNotifierProviderId, unknown])[])(
    "ADMIN_NOTIFIER_PROVIDER=%s이면 해당 어댑터를 만든다",
    (provider, adapter) => {
      // Given
      const config = mock<TypedConfigService>({
        adminNotifierProvider: provider,
        discordSignupWebhookUrl: undefined,
        discordPaymentWebhookUrl: undefined,
      });

      // When
      const notifier = createAdminNotifier(
        config,
        new HttpClient(),
        new OutboundPolicyRegistry(new RecordingOperationalAlert()),
      );

      // Then
      expect(notifier).toBeInstanceOf(adapter);
    },
  );
});
