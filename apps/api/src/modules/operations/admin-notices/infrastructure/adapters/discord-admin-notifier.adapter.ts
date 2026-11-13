import { Logger } from "@nestjs/common";
import type { HttpClient } from "@nestjs/http-client";

import type { OutboundPolicy } from "#api/platform/resilience/outbound-policy";
import type { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { toIsoString } from "#api/shared/domain/time/instant";

import {
  AdminNotifierPort,
  type AdminNotifyOutcome,
} from "../../application/ports/admin-notifier.port.js";
import type { AdminNotice } from "../../application/read-models/admin-notice.read-model.js";
import type { AdminNotificationChannel } from "../../domain/admin-notices.constants.js";
import { AdminNotifierProviderLogEvent } from "./admin-notifier-provider.log-events.js";
import { renderDiscordEmbed } from "./discord-embed.mapper.js";
import { DISCORD_WEBHOOK_POLICY } from "./discord-outbound.policy.js";

/** 응답 없는 webhook이 관리자 알림 worker 슬롯을 붙잡지 않도록 요청마다 끊는다. */
export const DISCORD_WEBHOOK_TIMEOUT_MS = 10_000;

const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR = 500;

/**
 * Discord Webhook으로 관리자 알림을 보낸다. 채널(admin·payment)마다 webhook URL이 다르다.
 *
 * @see https://discord.com/developers/docs/resources/webhook#execute-webhook
 */
export class DiscordAdminNotifierAdapter extends AdminNotifierPort {
  readonly #logger = new Logger(DiscordAdminNotifierAdapter.name);
  readonly #policy: OutboundPolicy;

  readonly #webhookUrls: Readonly<Record<AdminNotificationChannel, string | undefined>>;
  readonly #http: HttpClient;
  readonly #clock: ClockPort;

  constructor(
    webhookUrls: Readonly<Record<AdminNotificationChannel, string | undefined>>,
    http: HttpClient,
    policies: OutboundPolicyRegistry,
    clock: ClockPort,
  ) {
    super();
    this.#webhookUrls = webhookUrls;
    this.#http = http;
    this.#policy = policies.get(DISCORD_WEBHOOK_POLICY);
    this.#clock = clock;
  }

  async send(channel: AdminNotificationChannel, notice: AdminNotice): Promise<AdminNotifyOutcome> {
    const webhookUrl = this.#webhookUrls[channel];
    if (webhookUrl == null || webhookUrl === "") {
      this.#logger.debug({
        event: AdminNotifierProviderLogEvent.PROVIDER_NOT_CONFIGURED,
        provider: "discord",
        channel,
      });
      return { status: "skipped", reason: "not_configured" };
    }

    try {
      const { data: response } = await this.#policy.execute((signal) =>
        this.#http.request(webhookUrl, {
          method: "POST",
          responseType: "response",
          retry: false,
          throwOnHttpError: false,
          timeout: DISCORD_WEBHOOK_TIMEOUT_MS,
          signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            embeds: [renderDiscordEmbed(notice, toIsoString(this.#clock.now()))],
          }),
        }),
      );

      if (response.ok) {
        return { status: "sent" };
      }
      this.#logger.error({
        event: AdminNotifierProviderLogEvent.HTTP_FAILED,
        provider: "discord",
        channel,
        statusCode: response.status,
        errorType: "http",
      });
      return {
        status: "failed",
        retryable:
          response.status === HTTP_TOO_MANY_REQUESTS || response.status >= HTTP_SERVER_ERROR,
        statusCode: response.status,
      };
    } catch {
      this.#logger.error({
        event: AdminNotifierProviderLogEvent.REQUEST_FAILED,
        provider: "discord",
        channel,
        errorType: "transport",
      });
      return { status: "failed", retryable: true };
    }
  }
}
