import type { AdminNotifierProviderId } from "#api/platform/config/schemas/webhook.schema";

import type { AdminNotifierPort } from "../../application/ports/admin-notifier.port.js";
import type { OperationsAdminNoticesConfig } from "../../operations-admin-notices.config.js";
import type { DiscordAdminNotifierAdapter } from "./discord-admin-notifier.adapter.js";
import { LogAdminNotifierAdapter } from "./log-admin-notifier.adapter.js";

type AdminNotifierConfig = Pick<OperationsAdminNoticesConfig, "provider">;

/** 어댑터를 더하려면 AdminNotifierProviderId와 이 표에 한 줄씩 더한다. */
const adapters = {
  discord: (discord) => discord,
  log: () => new LogAdminNotifierAdapter(),
} satisfies Record<
  AdminNotifierProviderId,
  (discord: DiscordAdminNotifierAdapter) => AdminNotifierPort
>;

export function selectAdminNotifier(
  config: AdminNotifierConfig,
  discord: DiscordAdminNotifierAdapter,
): AdminNotifierPort {
  return adapters[config.provider](discord);
}
