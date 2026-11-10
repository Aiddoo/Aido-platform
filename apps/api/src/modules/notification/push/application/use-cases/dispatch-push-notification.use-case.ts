import { isSemanticVersionAtLeast } from "@aido/api/vocabulary";
import { groupBy, uniq } from "es-toolkit";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { type NotificationCachePort } from "../../../inbox/application/ports/notification-cache.port.js";
import type { CreateNotificationData } from "../../../inbox/application/ports/notification-draft.port.js";
import {
  FEATURE_DISCOVERY_CAMPAIGN_KEY,
  supportsFeatureDiscoveryMarketing,
} from "../../domain/feature-marketing-capability.domain-service.js";
import {
  notificationMinAppVersion,
  supportsNotificationType,
} from "../../domain/notification-client-capability.domain-service.js";
import {
  noActiveTokenSkipReason,
  type NoActiveTokenSkipReason,
  PUSH_DEVICE_STALE_AFTER_DAYS,
} from "../../domain/push-device.domain-service.js";
import { revokesPushToken } from "../../domain/push-failure-kind.constants.js";
import { NotificationDeliveryLogEvent } from "../notification-delivery.log-events.js";
import { type ActivePushTokenReaderPort } from "../ports/active-push-token.reader.port.js";
import type { PushDeviceRepositoryPort } from "../ports/push-device.repository.port.js";
import type { BatchPushNotificationPayload } from "../ports/push-notification-payload.port.js";
import {
  type PushPayload,
  type PushProviderPort,
  type PushResult,
} from "../ports/push-provider.port.js";
import { type PushTokenRepositoryPort } from "../ports/push-token.repository.port.js";
import type { PushDispatchSkipReason } from "../read-models/push-delivery.read-model.js";

function tokensToRevoke(results: readonly PushResult[]): string[] {
  return results.flatMap((result) =>
    result.status === "rejected" && revokesPushToken(result.failure.kind) ? [result.token] : [],
  );
}

function countOutcomes(results: readonly PushResult[]): {
  readonly successCount: number;
  readonly failureCount: number;
} {
  const successCount = results.filter((result) => result.status === "accepted").length;
  return { successCount, failureCount: results.length - successCount };
}

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
  readonly pushTokenRepository: Pick<
    PushTokenRepositoryPort,
    "deactivateInvalidTokens" | "findActivePushTokensByUsers" | "findPushTokensByUser"
  >;
  readonly pushDeviceRepository: Pick<PushDeviceRepositoryPort, "findPermissionStatusesByUsers">;
  readonly pushProvider: Pick<PushProviderPort, "sendBatch">;
  readonly activePushTokenReader: Pick<ActivePushTokenReaderPort, "findByUserId" | "findByUserIds">;
  readonly notificationCache: Pick<NotificationCachePort, "invalidatePushTokens">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "debug" | "warn">;
}

export class DispatchPushNotificationUseCase {
  readonly #dependencies: PushNotificationDeliveryServiceDependencies;

  constructor(dependencies: PushNotificationDeliveryServiceDependencies) {
    this.#dependencies = dependencies;
  }

  async deliverSingle(input: {
    readonly data: CreateNotificationData;
    readonly payload: Omit<PushPayload, "token">;
  }): Promise<SinglePushNotificationDeliveryResult> {
    const tokenResolution = await this.#resolveSingleTokens(input.data);
    if (tokenResolution.status === "skipped") {
      return tokenResolution;
    }

    const results = await this.#dependencies.pushProvider.sendBatch(
      tokenResolution.tokens.map((token) => ({ ...input.payload, token })),
    );
    const revokedTokens = tokensToRevoke(results);
    if (revokedTokens.length > 0) {
      await this.#dependencies.pushTokenRepository.deactivateInvalidTokens(
        revokedTokens,
        this.#dependencies.clock.now(),
      );
      await this.#dependencies.notificationCache.invalidatePushTokens(
        UserId.reconstitute(input.data.userId),
      );
      this.#dependencies.logger.warn({
        event: NotificationDeliveryLogEvent.PUSH_NOTIFICATION_DELIVERY_INVALID_TOKENS_DEACTIVATED,
        count: revokedTokens.length,
      });
    }
    this.#dependencies.logger.debug({
      event: NotificationDeliveryLogEvent.PUSH_NOTIFICATION_DELIVERY_SINGLE_SENT,
      userId: input.data.userId,
      ...countOutcomes(results),
    });
    return { status: "sent", results };
  }

  async prepareBatchDelivery(
    payloads: readonly BatchPushNotificationPayload[],
  ): Promise<PreparedBatchPushDelivery> {
    const userIds = uniq(payloads.map((payload) => payload.userId));
    const tokensByUser = await this.#dependencies.activePushTokenReader.findByUserIds(
      userIds.map((userId) => UserId.reconstitute(userId)),
    );
    const capabilityUserIds = uniq(
      payloads
        .filter((payload) => payload.requiresFeatureCapability || payload.minAppVersion != null)
        .map((payload) => payload.userId),
    );
    const capabilityTokenRecords =
      capabilityUserIds.length === 0
        ? []
        : await this.#dependencies.pushTokenRepository.findActivePushTokensByUsers(
            capabilityUserIds.map((userId) => UserId.reconstitute(userId)),
          );
    const capabilityTokensByUser = groupBy(capabilityTokenRecords, (record) => record.userId);

    const providerPayloads: PushPayload[] = [];
    const dispatchIds: number[] = [];
    const attemptedDispatchIds = new Set<number>();
    const skippedDispatches: Array<{
      dispatchId: number;
      reason: PushDispatchSkipReason;
    }> = [];
    const noTokenUserIdByDispatch = new Map<number, string>();

    for (const payload of payloads) {
      const activeTokens = tokensByUser.get(payload.userId) ?? [];
      const capabilityRecords = capabilityTokensByUser[payload.userId] ?? [];
      const { minAppVersion } = payload;
      const requiresCapability = payload.requiresFeatureCapability || minAppVersion != null;
      const activeTokenCount = requiresCapability ? capabilityRecords.length : activeTokens.length;
      if (activeTokenCount === 0) {
        noTokenUserIdByDispatch.set(payload.dispatchId, payload.userId);
        skippedDispatches.push({ dispatchId: payload.dispatchId, reason: "NO_ACTIVE_TOKEN" });
        continue;
      }

      const tokens = requiresCapability
        ? capabilityRecords
            .filter(
              (record) =>
                (!payload.requiresFeatureCapability || supportsFeatureDiscoveryMarketing(record)) &&
                (minAppVersion == null ||
                  isSemanticVersionAtLeast(record.appVersion, minAppVersion)),
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
          categoryId: payload.categoryId,
        });
        dispatchIds.push(payload.dispatchId);
      }
    }

    const noTokenReasons = await this.#noActiveTokenReasons([
      ...new Set(noTokenUserIdByDispatch.values()),
    ]);
    for (const skipped of skippedDispatches) {
      const userId = noTokenUserIdByDispatch.get(skipped.dispatchId);
      if (userId != null) {
        skipped.reason = noTokenReasons.get(userId) ?? skipped.reason;
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
    const results = await this.#dependencies.pushProvider.sendBatch(prepared.providerPayloads);
    const revokedTokens = tokensToRevoke(results);
    if (revokedTokens.length > 0) {
      await this.#dependencies.pushTokenRepository.deactivateInvalidTokens(
        revokedTokens,
        this.#dependencies.clock.now(),
      );
      await Promise.all(
        prepared.recipientUserIds.map((userId) =>
          this.#dependencies.notificationCache.invalidatePushTokens(UserId.reconstitute(userId)),
        ),
      );
      this.#dependencies.logger.warn({
        event:
          NotificationDeliveryLogEvent.PUSH_NOTIFICATION_DELIVERY_BATCH_INVALID_TOKENS_DEACTIVATED,
        count: revokedTokens.length,
      });
    }
    this.#dependencies.logger.debug({
      event: NotificationDeliveryLogEvent.PUSH_NOTIFICATION_DELIVERY_BATCH_SENT,
      total: results.length,
      ...countOutcomes(results),
    });

    const dispatchResults = results.flatMap((result, index) => {
      const dispatchId = prepared.dispatchIds[index];
      return dispatchId == null ? [] : [{ dispatchId, result }];
    });
    const resultsByDispatch = new Map(
      Object.entries(groupBy(dispatchResults, ({ dispatchId }) => dispatchId)).map(
        ([dispatchId, rows]) => [Number(dispatchId), rows.map(({ result }) => result)],
      ),
    );
    return { attemptedDispatchIds: prepared.attemptedDispatchIds, resultsByDispatch };
  }

  async #resolveSingleTokens(
    data: CreateNotificationData,
  ): Promise<
    | { readonly status: "resolved"; readonly tokens: readonly string[] }
    | { readonly status: "skipped"; readonly reason: PushDispatchSkipReason }
  > {
    const requiresFeatureCapability = data.campaignKey === FEATURE_DISCOVERY_CAMPAIGN_KEY;
    const requiresAppVersion = notificationMinAppVersion(data.type) != null;
    if (requiresFeatureCapability || requiresAppVersion) {
      const records = await this.#dependencies.pushTokenRepository.findPushTokensByUser({
        userId: UserId.reconstitute(data.userId),
        activeOnly: true,
      });
      if (records.length === 0) {
        return { status: "skipped", reason: await this.#noActiveTokenReason(data.userId) };
      }

      const tokens = records
        .filter(
          (record) =>
            (!requiresFeatureCapability || supportsFeatureDiscoveryMarketing(record)) &&
            supportsNotificationType(data.type, record.appVersion),
        )
        .map((record) => record.token);
      return tokens.length > 0
        ? { status: "resolved", tokens }
        : { status: "skipped", reason: "UNSUPPORTED_APP_CAPABILITY" };
    }

    const tokens = await this.#dependencies.activePushTokenReader.findByUserId(
      UserId.reconstitute(data.userId),
    );
    return tokens.length > 0
      ? { status: "resolved", tokens }
      : { status: "skipped", reason: await this.#noActiveTokenReason(data.userId) };
  }

  async #noActiveTokenReason(userId: string): Promise<NoActiveTokenSkipReason> {
    const reasons = await this.#noActiveTokenReasons([userId]);
    return reasons.get(userId) ?? "NO_ACTIVE_TOKEN";
  }

  async #noActiveTokenReasons(
    userIds: readonly string[],
  ): Promise<ReadonlyMap<string, NoActiveTokenSkipReason>> {
    if (userIds.length === 0) {
      return new Map();
    }
    const statusesByUser =
      await this.#dependencies.pushDeviceRepository.findPermissionStatusesByUsers(
        userIds.map((userId) => UserId.reconstitute(userId)),
        this.#dependencies.clock.now().subtract({ hours: 24 * PUSH_DEVICE_STALE_AFTER_DAYS }),
      );
    return new Map(
      userIds.map((userId) => [userId, noActiveTokenSkipReason(statusesByUser.get(userId) ?? [])]),
    );
  }
}
