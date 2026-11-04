import { HttpClient } from "@nestjs/http-client";
import { mock } from "vitest-mock-extended";

import type { AdminNotifierProviderId } from "#api/platform/config/schemas/webhook.schema";
import { TypedConfigService } from "#api/platform/config/services/config.service";

import { createAdminNotifier } from "./admin-notifier.factory.js";
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
      const notifier = createAdminNotifier(config, new HttpClient());

      // Then
      expect(notifier).toBeInstanceOf(adapter);
    },
  );
});
