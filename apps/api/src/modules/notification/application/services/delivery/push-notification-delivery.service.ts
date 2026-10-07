import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import type { PushTokenRecord } from "../../../domain/records/delivery/notification.record.js";
import {
  FEATURE_DISCOVERY_CAMPAIGN_KEY,
  supportsFeatureDiscoveryMarketing,
} from "../../../domain/services/delivery/feature-marketing-capability.js";
import {
  isNudgeInteractionNotification,
  supportsNudgeInteractions,
} from "../../../domain/services/delivery/notification-client-capability.js";
import { type ActivePushTokenReaderPort } from "../../ports/delivery/active-push-token.reader.port.js";
import { type NotificationCachePort } from "../../ports/delivery/notification-cache.port.js";
import type { CreateNotificationData } from "../../ports/delivery/notification-data.js";
import {
  type PushPayload,
  type PushProvider,
  type PushResult,
} from "../../ports/delivery/push-provider.port.js";
import { type PushTokenRepositoryPort } from "../../ports/delivery/push-token.repository.port.js";
import type { PushDispatchSkipReason } from "../../types/delivery/push-delivery.types.js";
import type { BatchPushNotificationPayload } from "./push-notification-payload.factory.js";

export type SinglePushNotificationDeliveryResult =
  | {
      readonly status: "sent";
      readonly results: PushResult[];
    }
  | {
      readonly status: "skipped";
      readonly reason: PushDispatchSkipReason;
    };

interface PreparedBatchPushDeliveryBase {
  readonly attemptedDispatchIds: ReadonlySet<number>;
  readonly skippedDispatches: readonly {
    readonly dispatchId: number;
    readonly reason: PushDispatchSkipReason;
  }[];
  readonly recipientUserIds: readonly string[];
}

export type PreparedBatchPushDelivery =
  | (PreparedBatchPushDeliveryBase & { readonly status: "empty" })
  | (PreparedBatchPushDeliveryBase & {
      readonly status: "ready";
      readonly providerPayloads: readonly PushPayload[];
      readonly dispatchIds: readonly number[];
    });

export interface BatchPushNotificationDeliveryResult {
  readonly attemptedDispatchIds: ReadonlySet<number>;
  readonly resultsByDispatch: ReadonlyMap<number, PushResult[]>;
}

/** 활성·capability 토큰을 선택하고 provider 전달과 무효 토큰 정리를 수행한다. */
interface PushNotificationDeliveryServiceDependencies {
  readonly pushTokenRepository: PushTokenRepositoryPort;
  readonly pushProvider: PushProvider;
  readonly activePushTokenReader: ActivePushTokenReaderPort;
  readonly notificationCache: NotificationCachePort;
  readonly logger: ApplicationLogger;
}

export class PushNotificationDeliveryService {
  readonly #dependencies: PushNotificationDeliveryServiceDependencies;

  constructor(dependencies: PushNotificationDeliveryServiceDependencies) {
    this.#dependencies = dependencies;
  }

  async deliverSingle(input: {
    readonly data: CreateNotificationData;
    readonly payload: Omit<PushPayload, "token">;
  }): Promise<SinglePushNotificationDeliveryResult> {
    const tokenResolution = await this.#resolveSingleTokens(input.data);
    if (tokenResolution.status === "skipped") return tokenResolution;

    const result = await this.#dependencies.pushProvider.sendBatch(
      tokenResolution.tokens.map((token) => ({ ...input.payload, token })),
    );
    if (result.invalidTokens.length > 0) {
      await this.#dependencies.pushTokenRepository.deactivateInvalidTokens(result.invalidTokens);
      await this.#dependencies.notificationCache.invalidatePushTokens(input.data.userId);
      this.#dependencies.logger.warn(`Deactivated invalid tokens: ${result.invalidTokens.length}`);
    }
    this.#dependencies.logger.debug(
      `Push sent to user ${input.data.userId}: success=${result.successCount}, failure=${result.failureCount}`,
    );
    return { status: "sent", results: result.results };
  }

  async prepareBatchDelivery(
    payloads: readonly BatchPushNotificationPayload[],
  ): Promise<PreparedBatchPushDelivery> {
    const userIds = [...new Set(payloads.map((payload) => payload.userId))];
    const tokensByUser = await this.#dependencies.activePushTokenReader.findByUserIds(userIds);
    const capabilityUserIds = [
      ...new Set(
        payloads
          .filter(
            (payload) =>
              payload.requiresFeatureCapability || payload.requiresNudgeInteractionCapability,
          )
          .map((payload) => payload.userId),
      ),
    ];
    const capabilityTokenRecords =
      capabilityUserIds.length === 0
        ? []
        : await this.#dependencies.pushTokenRepository.findActivePushTokensByUsers(
            capabilityUserIds,
          );
    const capabilityTokensByUser = this.#groupTokenRecords(capabilityTokenRecords);

    const providerPayloads: PushPayload[] = [];
    const dispatchIds: number[] = [];
    const attemptedDispatchIds = new Set<number>();
    const skippedDispatches: Array<{
      dispatchId: number;
      reason: PushDispatchSkipReason;
    }> = [];

    for (const payload of payloads) {
      const activeTokens = tokensByUser.get(payload.userId) ?? [];
      const capabilityRecords = capabilityTokensByUser.get(payload.userId) ?? [];
      const requiresCapability =
        payload.requiresFeatureCapability || payload.requiresNudgeInteractionCapability;
      const activeTokenCount = requiresCapability ? capabilityRecords.length : activeTokens.length;
      if (activeTokenCount === 0) {
        skippedDispatches.push({
          dispatchId: payload.dispatchId,
          reason: "NO_ACTIVE_TOKEN",
        });
        continue;
      }

      const tokens = requiresCapability
        ? capabilityRecords
            .filter(
              (record) =>
                (!payload.requiresFeatureCapability || supportsFeatureDiscoveryMarketing(record)) &&
                (!payload.requiresNudgeInteractionCapability ||
                  supportsNudgeInteractions(record.appVersion)),
            )
            .map((record) => record.token)
        : activeTokens;
      if (tokens.length === 0) {
        skippedDispatches.push({
          dispatchId: payload.dispatchId,
          reason: "UNSUPPORTED_APP_CAPABILITY",
        });
        continue;
      }

      attemptedDispatchIds.add(payload.dispatchId);
      for (const token of tokens) {
        providerPayloads.push({
          token,
          title: payload.title,
          body: payload.body,
          data: payload.data,
        });
        dispatchIds.push(payload.dispatchId);
      }
    }

    if (providerPayloads.length === 0) {
      return {
        status: "empty",
        attemptedDispatchIds,
        skippedDispatches,
        recipientUserIds: userIds,
      };
    }
    return {
      status: "ready",
      providerPayloads,
      dispatchIds,
      attemptedDispatchIds,
      skippedDispatches,
      recipientUserIds: userIds,
    };
  }

  async sendPreparedBatch(
    prepared: Extract<PreparedBatchPushDelivery, { readonly status: "ready" }>,
  ): Promise<BatchPushNotificationDeliveryResult> {
    const result = await this.#dependencies.pushProvider.sendBatch([...prepared.providerPayloads]);
    if (result.invalidTokens.length > 0) {
      await this.#dependencies.pushTokenRepository.deactivateInvalidTokens(result.invalidTokens);
      await Promise.all(
        prepared.recipientUserIds.map((userId) =>
          this.#dependencies.notificationCache.invalidatePushTokens(userId),
        ),
      );
      this.#dependencies.logger.warn(`Deactivated invalid tokens: ${result.invalidTokens.length}`);
    }
    this.#dependencies.logger.debug(
      `Batch push sent: total=${result.total}, success=${result.successCount}, failure=${result.failureCount}`,
    );

    const resultsByDispatch = new Map<number, PushResult[]>();
    for (const [index, pushResult] of result.results.entries()) {
      const dispatchId = prepared.dispatchIds[index];
      if (dispatchId === undefined) continue;
      const current = resultsByDispatch.get(dispatchId) ?? [];
      current.push(pushResult);
      resultsByDispatch.set(dispatchId, current);
    }
    return { attemptedDispatchIds: prepared.attemptedDispatchIds, resultsByDispatch };
  }

  async #resolveSingleTokens(
    data: CreateNotificationData,
  ): Promise<
    | { readonly status: "resolved"; readonly tokens: readonly string[] }
    | { readonly status: "skipped"; readonly reason: PushDispatchSkipReason }
  > {
    const requiresFeatureCapability = data.campaignKey === FEATURE_DISCOVERY_CAMPAIGN_KEY;
    const requiresNudgeInteractionCapability = isNudgeInteractionNotification(data.type);
    if (requiresFeatureCapability || requiresNudgeInteractionCapability) {
      const records = await this.#dependencies.pushTokenRepository.findPushTokensByUser({
        userId: data.userId,
        activeOnly: true,
      });
      if (records.length === 0) return { status: "skipped", reason: "NO_ACTIVE_TOKEN" };

      const tokens = records
        .filter(
          (record) =>
            (!requiresFeatureCapability || supportsFeatureDiscoveryMarketing(record)) &&
            (!requiresNudgeInteractionCapability || supportsNudgeInteractions(record.appVersion)),
        )
        .map((record) => record.token);
      return tokens.length > 0
        ? { status: "resolved", tokens }
        : { status: "skipped", reason: "UNSUPPORTED_APP_CAPABILITY" };
    }

    const tokens = await this.#dependencies.activePushTokenReader.findByUserId(data.userId);
    return tokens.length > 0
      ? { status: "resolved", tokens }
      : { status: "skipped", reason: "NO_ACTIVE_TOKEN" };
  }

  #groupTokenRecords(records: PushTokenRecord[]): Map<string, PushTokenRecord[]> {
    const byUserId = new Map<string, PushTokenRecord[]>();
    for (const record of records) {
      const userRecords = byUserId.get(record.userId) ?? [];
      userRecords.push(record);
      byUserId.set(record.userId, userRecords);
    }
    return byUserId;
  }
}
