import { type HttpClient } from "@nestjs/http-client";

import type { AdminNotifierProviderId } from "#api/platform/config/schemas/webhook.schema";
import type { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";

import type { AdminNotifierPort } from "../../application/ports/admin-notifier.port.js";
import type { OperationsAdminNoticesConfig } from "../../operations-admin-notices.config.js";
import { DiscordAdminNotifierAdapter } from "./discord-admin-notifier.adapter.js";
import { LogAdminNotifierAdapter } from "./log-admin-notifier.adapter.js";

type AdminNotifierConfig = Pick<OperationsAdminNoticesConfig, "provider" | "discordWebhookUrls">;

/** 어댑터를 더하려면 AdminNotifierProviderId와 이 표에 한 줄씩 더한다. */
const adapters = {
  discord: (config, http, policies) =>
    new DiscordAdminNotifierAdapter(config.discordWebhookUrls, http, policies),
  log: () => new LogAdminNotifierAdapter(),
} satisfies Record<
  AdminNotifierProviderId,
  (
    config: OperationsAdminNoticesConfig,
    http: HttpClient,
    policies: OutboundPolicyRegistry,
  ) => AdminNotifierPort
>;

export function selectAdminNotifier(
  config: AdminNotifierConfig,
  http: HttpClient,
  policies: OutboundPolicyRegistry,
): AdminNotifierPort {
  return adapters[config.provider](config, http, policies);
}
