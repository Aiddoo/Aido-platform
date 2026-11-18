import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { chunk, delay } from "es-toolkit";
import Expo, { type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";
import { match, P } from "ts-pattern";

import type { OutboundPolicy } from "#api/platform/resilience/outbound-policy";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";

import {
  type PushChannelPort,
  type PushFailure,
  type PushMessage,
  type PushReceiptResult,
  type PushSendResult,
} from "../../application/ports/push-channel.port.js";
import { retryablePushProviderTransport } from "../../application/push-dispatches.errors.js";
import {
  PUSH_FAILURE_KIND,
  type PushFailureKind,
} from "../../domain/push-failure-kind.constants.js";
import { PushTicketId } from "../../domain/push-ticket-id.vo.js";
import { notificationPushDispatchesConfig } from "../../notification-push-dispatches.config.js";
import { EXPO_PUSH_POLICY } from "./expo-outbound.policy.js";
import { EXPO_PUSH_CHANNEL_CONFIG } from "./expo-push-channel.constants.js";
import { buildExpoPushMessage } from "./expo-push-message.mapper.js";
import { PushProviderLogEvent, pushTransportStatusCode } from "./push-provider.log-events.js";
import { PushThroughputLimiterAdapter } from "./push-throughput-limiter.adapter.js";

// 로그·transport 오류의 provider 값. 운영 로그 검색이 이 값을 쓴다
const EXPO_PROVIDER_LOG_NAME = "expo";

function toPushFailureKind(providerCode: string | undefined): PushFailureKind {
  return match(providerCode)
    .with("DeviceNotRegistered", () => PUSH_FAILURE_KIND.DEVICE_UNREGISTERED)
    .with("MessageTooBig", () => PUSH_FAILURE_KIND.PAYLOAD_TOO_LARGE)
    .with("MessageRateExceeded", () => PUSH_FAILURE_KIND.RATE_LIMITED)
    .with(
      P.union("InvalidCredentials", "DeveloperError", "MismatchSenderId"),
      () => PUSH_FAILURE_KIND.PROVIDER_REJECTED,
    )
    .with(P.union("ExpoError", "ProviderError"), () => PUSH_FAILURE_KIND.PROVIDER_UNAVAILABLE)
    .otherwise(() => PUSH_FAILURE_KIND.UNKNOWN);
}

interface SendableMessage {
  readonly index: number;
  readonly token: string;
  readonly message: ExpoPushMessage;
}

/** @see https://docs.expo.dev/push-notifications/sending-notifications/ */
@Injectable()
export class ExpoPushChannelAdapter implements PushChannelPort {
  readonly channel = "EXPO";
  readonly timing = EXPO_PUSH_CHANNEL_CONFIG.timing;
  readonly #logger = new Logger(ExpoPushChannelAdapter.name);
  readonly #expo: Expo;
  readonly #throughput = new PushThroughputLimiterAdapter({
    messagesPerSecond: EXPO_PUSH_CHANNEL_CONFIG.messagesPerSecond,
  });

  readonly #policy: OutboundPolicy;

  constructor(
    @Inject(notificationPushDispatchesConfig.KEY)
    config: Pick<ConfigType<typeof notificationPushDispatchesConfig>, "expoAccessToken">,
    policies: OutboundPolicyRegistry,
  ) {
    const accessToken = config.expoAccessToken;
    this.#expo = new Expo(accessToken ? { accessToken } : undefined);
    this.#policy = policies.get(EXPO_PUSH_POLICY);
  }

  acceptsToken(token: string): boolean {
    return Expo.isExpoPushToken(token);
  }

  async readReceipts(ticketIds: readonly PushTicketId[]): Promise<PushReceiptResult[]> {
    const results: PushReceiptResult[] = [];
    for (const receiptBatch of this.#expo.chunkPushNotificationReceiptIds(
      ticketIds.map((ticketId) => ticketId.value),
    )) {
      const receipts = await this.#policy.execute(() =>
        this.#expo.getPushNotificationReceiptsAsync(receiptBatch),
      );
      for (const ticketId of receiptBatch) {
        const receipt = receipts[ticketId];
        if (receipt == null) {
          continue;
        }
        results.push(
          receipt.status === "ok"
            ? { ticketId: PushTicketId.reconstitute(ticketId), status: "delivered" }
            : {
                ticketId: PushTicketId.reconstitute(ticketId),
                status: "failed",
                failure: this.#failure(receipt.details?.error, receipt.message),
              },
        );
      }
    }
    return results;
  }

  /**
   * 토큰 형식·payload 크기처럼 확정된 실패는 결과로 돌려준다. 청크 transport 실패는 수락 여부를
   * 알 수 없어 RetryablePushProviderTransportError를 던진다.
   */
  async sendBatch(messages: readonly PushMessage[]): Promise<PushSendResult[]> {
    const results: Array<PushSendResult | undefined> = Array.from({ length: messages.length });
    let pending: SendableMessage[] = [];
    for (const [index, message] of messages.entries()) {
      if (!this.acceptsToken(message.token)) {
        results[index] = this.#rejected(message.token, { kind: PUSH_FAILURE_KIND.INVALID_TOKEN });
        continue;
      }
      const built = buildExpoPushMessage(message);
      if (built.status === "rejected") {
        results[index] = this.#rejected(message.token, {
          kind: PUSH_FAILURE_KIND.PAYLOAD_TOO_LARGE,
        });
        continue;
      }
      pending.push({ index, token: message.token, message: built.message });
    }

    const progress = { resolved: 0, accepted: 0, total: pending.length };
    const retryDelaysMs = [0, ...EXPO_PUSH_CHANNEL_CONFIG.rateExceededRetryDelaysMs];
    for (const [round, retryDelayMs] of retryDelaysMs.entries()) {
      if (pending.length === 0) {
        break;
      }
      if (retryDelayMs > 0) {
        await delay(retryDelayMs);
      }
      const canRetry = round < retryDelaysMs.length - 1;
      const rateLimited: SendableMessage[] = [];
      for (const batch of chunk(pending, EXPO_PUSH_CHANNEL_CONFIG.chunkSize)) {
        const tickets = await this.#sendMessages(batch, progress);
        for (const [position, entry] of batch.entries()) {
          const result = this.#toResult(entry.token, tickets[position]);
          results[entry.index] = result;
          if (
            canRetry &&
            result.status === "rejected" &&
            result.failure.kind === PUSH_FAILURE_KIND.RATE_LIMITED
          ) {
            rateLimited.push(entry);
            continue;
          }
          progress.resolved += 1;
          if (result.status === "accepted") {
            progress.accepted += 1;
          }
        }
      }
      pending = rateLimited;
    }

    return results.filter((result) => result != null);
  }

  async #sendMessages(
    batch: readonly SendableMessage[],
    progress: { readonly resolved: number; readonly accepted: number; readonly total: number },
  ): Promise<ExpoPushTicket[]> {
    await this.#throughput.acquire(batch.length);
    try {
      return await this.#policy.execute(() =>
        this.#expo.sendPushNotificationsAsync(batch.map(({ message }) => message)),
      );
    } catch (error) {
      const transportError = retryablePushProviderTransport(
        {
          providerName: EXPO_PROVIDER_LOG_NAME,
          resolvedPayloadCountBeforeFailure: progress.resolved,
          acceptedTicketCountBeforeFailure: progress.accepted,
          unconfirmedPayloadCount: batch.length,
          unattemptedPayloadCount: Math.max(progress.total - progress.resolved - batch.length, 0),
        },
        error,
      );
      this.#logger.error({
        event: PushProviderLogEvent.TRANSPORT_FAILED,
        provider: EXPO_PROVIDER_LOG_NAME,
        statusCode: pushTransportStatusCode(error),
        ...transportError.metadata,
      });
      throw transportError;
    }
  }

  #toResult(token: string, ticket: ExpoPushTicket | undefined): PushSendResult {
    if (ticket == null) {
      return this.#rejected(token, { kind: PUSH_FAILURE_KIND.UNKNOWN });
    }
    if (ticket.status === "ok") {
      return { token, status: "accepted", ticketId: PushTicketId.reconstitute(ticket.id) };
    }
    const failure = this.#failure(ticket.details?.error, ticket.message);
    this.#logger.warn({
      event: PushProviderLogEvent.TICKET_FAILED,
      provider: EXPO_PROVIDER_LOG_NAME,
      failureKind: failure.kind,
    });
    return this.#rejected(token, failure);
  }

  #failure(providerCode: string | undefined, message: string | undefined): PushFailure {
    return {
      kind: toPushFailureKind(providerCode),
      ...(providerCode != null && { providerCode }),
      ...(message != null && { message }),
    };
  }

  #rejected(token: string, failure: PushFailure): PushSendResult {
    return { token, status: "rejected", failure };
  }
}
