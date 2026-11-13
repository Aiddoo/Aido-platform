import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { chunk, delay } from "es-toolkit";
import Expo, { type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";
import { match, P } from "ts-pattern";

import type { OutboundPolicy } from "#api/platform/resilience/outbound-policy";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";

import type {
  PushFailure,
  PushPayload,
  PushProviderPort,
  PushProviderTiming,
  PushReceiptResult,
  PushResult,
} from "../../application/ports/push-provider.port.js";
import { RetryablePushProviderTransportError } from "../../application/ports/push-provider.port.js";
import {
  PUSH_FAILURE_KIND,
  type PushFailureKind,
} from "../../domain/push-failure-kind.constants.js";
import { notificationPushConfig } from "../../notification-push.config.js";
import { EXPO_PUSH_POLICY } from "./expo-outbound.policy.js";
import { buildExpoPushMessage } from "./expo-push-message.mapper.js";
import {
  NotificationProviderLogEvent,
  pushTransportStatusCode,
} from "./notification-provider.log-events.js";
import { PushThroughputLimiterAdapter } from "./push-throughput-limiter.adapter.js";

const MINUTE_MS = 60_000;

/**
 * Expo는 수락 15분 뒤부터 receipt를 물으라고 권하고 receipt를 약 24시간 보관한다.
 * SDK 전송은 abort signal을 받지 않아 정책 timeout 뒤에도 요청이 이어질 수 있어 lease 여유를 둔다.
 */
export const EXPO_PUSH_TIMING = {
  receipt: { readyAfterMs: 15 * MINUTE_MS, retentionMs: 24 * 60 * MINUTE_MS },
  unabortableSendGraceMs: 10 * MINUTE_MS,
} as const satisfies PushProviderTiming;

/** Expo 프로젝트 한도(초당 600건)보다 여유를 둔다. 운영 API는 단일 프로세스다. */
const EXPO_PUSH_MESSAGES_PER_SECOND = 500;
/** 기기별 MessageRateExceeded는 Expo 안내대로 지수 backoff 뒤 해당 메시지만 다시 보낸다. */
export const EXPO_RATE_EXCEEDED_RETRY_DELAYS_MS = [1000, 2000, 4000] as const;

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
export class ExpoPushSenderAdapter implements PushProviderPort {
  readonly name = "expo";
  readonly timing = EXPO_PUSH_TIMING;
  readonly #logger = new Logger(ExpoPushSenderAdapter.name);
  readonly #expo: Expo;
  readonly #throughput = new PushThroughputLimiterAdapter({
    messagesPerSecond: EXPO_PUSH_MESSAGES_PER_SECOND,
  });

  readonly #policy: OutboundPolicy;

  constructor(
    @Inject(notificationPushConfig.KEY)
    config: Pick<ConfigType<typeof notificationPushConfig>, "expoAccessToken">,
    policies: OutboundPolicyRegistry,
  ) {
    const accessToken = config.expoAccessToken;
    this.#expo = new Expo(accessToken ? { accessToken } : undefined);
    this.#policy = policies.get(EXPO_PUSH_POLICY);
  }

  validateToken(token: string): boolean {
    return Expo.isExpoPushToken(token);
  }

  async getReceipts(ticketIds: readonly string[]): Promise<PushReceiptResult[]> {
    const results: PushReceiptResult[] = [];
    for (const receiptBatch of this.#expo.chunkPushNotificationReceiptIds([...ticketIds])) {
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
            ? { ticketId, status: "delivered" }
            : {
                ticketId,
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
  async sendBatch(payloads: readonly PushPayload[]): Promise<PushResult[]> {
    const results: Array<PushResult | undefined> = Array.from({ length: payloads.length });
    let pending: SendableMessage[] = [];
    for (const [index, payload] of payloads.entries()) {
      if (!this.validateToken(payload.token)) {
        results[index] = this.#rejected(payload.token, { kind: PUSH_FAILURE_KIND.INVALID_TOKEN });
        continue;
      }
      const built = buildExpoPushMessage(payload);
      if (built.status === "rejected") {
        results[index] = this.#rejected(payload.token, {
          kind: PUSH_FAILURE_KIND.PAYLOAD_TOO_LARGE,
        });
        continue;
      }
      pending.push({ index, token: payload.token, message: built.message });
    }

    const progress = { resolved: 0, accepted: 0, total: pending.length };
    const retryDelaysMs = [0, ...EXPO_RATE_EXCEEDED_RETRY_DELAYS_MS];
    for (const [round, retryDelayMs] of retryDelaysMs.entries()) {
      if (pending.length === 0) {
        break;
      }
      if (retryDelayMs > 0) {
        await delay(retryDelayMs);
      }
      const canRetry = round < retryDelaysMs.length - 1;
      const rateLimited: SendableMessage[] = [];
      for (const batch of chunk(pending, Expo.pushNotificationChunkSizeLimit)) {
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
      const transportError = new RetryablePushProviderTransportError(
        {
          providerName: this.name,
          resolvedPayloadCountBeforeFailure: progress.resolved,
          acceptedTicketCountBeforeFailure: progress.accepted,
          unconfirmedPayloadCount: batch.length,
          unattemptedPayloadCount: Math.max(progress.total - progress.resolved - batch.length, 0),
        },
        { cause: error },
      );
      this.#logger.error({
        event: NotificationProviderLogEvent.TRANSPORT_FAILED,
        provider: this.name,
        statusCode: pushTransportStatusCode(error),
        ...transportError.metadata,
      });
      throw transportError;
    }
  }

  #toResult(token: string, ticket: ExpoPushTicket | undefined): PushResult {
    if (ticket == null) {
      return this.#rejected(token, { kind: PUSH_FAILURE_KIND.UNKNOWN });
    }
    if (ticket.status === "ok") {
      return { token, status: "accepted", ticketId: ticket.id };
    }
    const failure = this.#failure(ticket.details?.error, ticket.message);
    this.#logger.warn({
      event: NotificationProviderLogEvent.TICKET_FAILED,
      provider: this.name,
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

  #rejected(token: string, failure: PushFailure): PushResult {
    return { token, status: "rejected", failure };
  }
}
