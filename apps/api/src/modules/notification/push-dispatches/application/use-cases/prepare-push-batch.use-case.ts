import { isSemanticVersionAtLeast, type PushDispatchSkipReason } from "@aido/api/vocabulary";
import { groupBy, uniq } from "es-toolkit";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UnreadNotificationCountReaderPort } from "../../../notifications/notification-notifications-queries.public.js";
import {
  type ActivePushTokenReaderPort,
  type ActivePushTokenReadModel,
  type PushTokenRepositoryPort,
  toActivePushTokens,
} from "../../../push-devices/notification-push-devices.public.js";
import { supportsFeatureDiscoveryMarketing } from "../../domain/feature-marketing-capability.domain-service.js";
import { carriesUnreadBadge, pushBadgeFor } from "../../domain/push-badge.domain-service.js";
import type { NoActiveTokenReasonReader } from "../no-active-token-reason.reader.js";
import type { PushMessage } from "../ports/push-channel.port.js";
import type { BatchPushNotificationPayload } from "../ports/push-notification-payload.port.js";

interface PreparedPushBatchBase {
  readonly attemptedDispatchIds: ReadonlySet<number>;
  readonly skippedDispatches: readonly {
    readonly dispatchId: number;
    readonly reason: PushDispatchSkipReason;
  }[];
  readonly recipientUserIds: readonly string[];
}

export type PreparedPushBatch =
  | (PreparedPushBatchBase & { readonly status: "empty" })
  | (PreparedPushBatchBase & {
      readonly status: "ready";
      readonly messages: readonly PushMessage[];
      readonly dispatchIds: readonly number[];
    });

type CapabilityTokensByUser = Partial<
  Record<string, Awaited<ReturnType<PushTokenRepositoryPort["listActivePushTokensByUsers"]>>>
>;

interface PreparePushBatchDependencies {
  readonly pushTokenRepository: Pick<PushTokenRepositoryPort, "listActivePushTokensByUsers">;
  readonly activePushTokenReader: Pick<ActivePushTokenReaderPort, "listByUserIds">;
  readonly noActiveTokenReasons: Pick<NoActiveTokenReasonReader, "findReasons">;
  readonly unreadCounts: Pick<UnreadNotificationCountReaderPort, "countUnreadByUsers">;
}

interface SelectedPushToken {
  readonly payload: BatchPushNotificationPayload;
  readonly token: ActivePushTokenReadModel;
}

// 배치 payload마다 받을 토큰을 골라 공급자 payload로 펼치고, 토큰이 없는 발송은 이유와 함께 뺀다
export class PreparePushBatchUseCase {
  readonly #dependencies: PreparePushBatchDependencies;

  constructor(dependencies: PreparePushBatchDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(payloads: readonly BatchPushNotificationPayload[]): Promise<PreparedPushBatch> {
    const userIds = uniq(payloads.map((payload) => payload.userId.value));
    const tokensByUser = await this.#dependencies.activePushTokenReader.listByUserIds(
      userIds.map((userId) => UserId.reconstitute(userId)),
    );
    const capabilityTokensByUser = await this.#findCapabilityTokens(payloads);

    const selected: SelectedPushToken[] = [];
    const dispatchIds: number[] = [];
    const attemptedDispatchIds = new Set<number>();
    const skippedDispatches: Array<{ dispatchId: number; reason: PushDispatchSkipReason }> = [];
    const noTokenUserIdByDispatch = new Map<number, string>();

    for (const payload of payloads) {
      const userId = payload.userId.value;
      const dispatchId = payload.dispatchId.value;
      const selection = selectTokens(
        payload,
        tokensByUser.get(userId) ?? [],
        capabilityTokensByUser,
      );
      if (selection.status === "skipped") {
        if (selection.reason === "NO_ACTIVE_TOKEN") {
          noTokenUserIdByDispatch.set(dispatchId, userId);
        }
        skippedDispatches.push({ dispatchId, reason: selection.reason });
        continue;
      }
      attemptedDispatchIds.add(dispatchId);
      for (const token of selection.tokens) {
        selected.push({ payload, token });
        dispatchIds.push(dispatchId);
      }
    }

    const noTokenReasons = await this.#dependencies.noActiveTokenReasons.findReasons([
      ...new Set(noTokenUserIdByDispatch.values()),
    ]);
    for (const skipped of skippedDispatches) {
      const userId = noTokenUserIdByDispatch.get(skipped.dispatchId);
      if (userId != null) {
        skipped.reason = noTokenReasons.get(userId) ?? skipped.reason;
      }
    }

    const unreadCounts = await this.#unreadCountsForBadges(selected);
    const messages = selected.map(({ payload, token }) =>
      toPushMessage(payload, token, unreadCounts.get(payload.userId.value) ?? 0),
    );
    const base = { attemptedDispatchIds, skippedDispatches, recipientUserIds: userIds };
    if (messages.length === 0) {
      return { status: "empty", ...base };
    }
    return { status: "ready", messages, dispatchIds, ...base };
  }

  // 배지를 실을 기기가 있는 사람만 한 번에 센다. 수신자마다 따로 묻지 않는다
  async #unreadCountsForBadges(
    selected: readonly SelectedPushToken[],
  ): Promise<ReadonlyMap<string, number>> {
    const badgeUserIds = uniq(
      selected
        .filter(({ token }) => carriesUnreadBadge(token.appVersion))
        .map(({ payload }) => payload.userId.value),
    );
    if (badgeUserIds.length === 0) {
      return new Map();
    }
    return this.#dependencies.unreadCounts.countUnreadByUsers(
      badgeUserIds.map((userId) => UserId.reconstitute(userId)),
    );
  }

  async #findCapabilityTokens(
    payloads: readonly BatchPushNotificationPayload[],
  ): Promise<CapabilityTokensByUser> {
    const capabilityUserIds = uniq(
      payloads.filter(requiresCapability).map((payload) => payload.userId.value),
    );
    if (capabilityUserIds.length === 0) {
      return {};
    }
    const records = await this.#dependencies.pushTokenRepository.listActivePushTokensByUsers(
      capabilityUserIds.map((userId) => UserId.reconstitute(userId)),
    );
    return groupBy(records, (record) => record.userId);
  }
}

function requiresCapability(payload: BatchPushNotificationPayload): boolean {
  return payload.requiresFeatureCapability || payload.minAppVersion != null;
}

function selectTokens(
  payload: BatchPushNotificationPayload,
  activeTokens: readonly ActivePushTokenReadModel[],
  capabilityTokensByUser: CapabilityTokensByUser,
):
  | { readonly status: "selected"; readonly tokens: readonly ActivePushTokenReadModel[] }
  | { readonly status: "skipped"; readonly reason: PushDispatchSkipReason } {
  const capabilityRecords = capabilityTokensByUser[payload.userId.value] ?? [];
  const { minAppVersion } = payload;
  const needsCapability = requiresCapability(payload);
  const activeTokenCount = needsCapability ? capabilityRecords.length : activeTokens.length;
  if (activeTokenCount === 0) {
    return { status: "skipped", reason: "NO_ACTIVE_TOKEN" };
  }

  const tokens = needsCapability
    ? toActivePushTokens(
        capabilityRecords.filter(
          (record) =>
            (!payload.requiresFeatureCapability || supportsFeatureDiscoveryMarketing(record)) &&
            (minAppVersion == null || isSemanticVersionAtLeast(record.appVersion, minAppVersion)),
        ),
      )
    : activeTokens;
  return tokens.length === 0
    ? { status: "skipped", reason: "UNSUPPORTED_APP_CAPABILITY" }
    : { status: "selected", tokens };
}

function toPushMessage(
  payload: BatchPushNotificationPayload,
  { channel, token, platform, appVersion }: ActivePushTokenReadModel,
  unreadCount: number,
): PushMessage {
  const badge = pushBadgeFor({ appVersion, unreadCount });
  return {
    channel,
    token,
    platform,
    ...(badge != null && { badge }),
    title: payload.title,
    body: payload.body,
    data: payload.data,
    categoryId: payload.categoryId,
    collapseKey: payload.collapseKey,
    priority: payload.priority,
    ttlSeconds: payload.ttlSeconds,
  };
}
