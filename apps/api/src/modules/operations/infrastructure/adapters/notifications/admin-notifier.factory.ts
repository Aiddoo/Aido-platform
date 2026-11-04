import { type HttpClient } from "@nestjs/http-client";

import type { AdminNotifierProviderId } from "#api/platform/config/schemas/webhook.schema";
import { TypedConfigService } from "#api/platform/config/services/config.service";

import type { AdminNotifierPort } from "../../../application/ports/notifications/admin-notifier.port.js";
import { DiscordAdminNotifierAdapter } from "./discord-admin-notifier.adapter.js";
import { LogAdminNotifierAdapter } from "./log-admin-notifier.adapter.js";

/** 어댑터를 더하려면 AdminNotifierProviderId와 이 표에 한 줄씩 더한다. */
const adapters = {
  discord: (config, http) =>
    new DiscordAdminNotifierAdapter(
      { admin: config.discordSignupWebhookUrl, payment: config.discordPaymentWebhookUrl },
      http,
    ),
  log: () => new LogAdminNotifierAdapter(),
} satisfies Record<
  AdminNotifierProviderId,
  (config: TypedConfigService, http: HttpClient) => AdminNotifierPort
>;

export function createAdminNotifier(
  config: TypedConfigService,
  http: HttpClient,
): AdminNotifierPort {
  return adapters[config.adminNotifierProvider](config, http);
}
