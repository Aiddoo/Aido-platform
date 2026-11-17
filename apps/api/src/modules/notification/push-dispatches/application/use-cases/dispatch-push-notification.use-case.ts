import type { PushDispatchSkipReason } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  ActivePushTokenReaderPort,
  PushTokenCachePort,
  PushTokenRepositoryPort,
} from "../../../push-devices/notification-push-devices.public.js";
import {
  notificationMinAppVersion,
  supportsNotificationType,
} from "../../../shared/domain/notification-client-capability.domain-service.js";
import type { CreateNotificationData } from "../../../shared/domain/notification-draft.constants.js";
import {
  FEATURE_DISCOVERY_CAMPAIGN_KEY,
  supportsFeatureDiscoveryMarketing,
} from "../../domain/feature-marketing-capability.domain-service.js";
import type { NoActiveTokenReasonReader } from "../no-active-token-reason.reader.js";
import type { PushPayload, PushProviderPort, PushResult } from "../ports/push-provider.port.js";
import { countOutcomes, tokensToRevoke } from "../push-delivery-results.mapper.js";
import { PushDispatchLogEvent } from "../push-dispatches.log-events.js";

export interface DispatchPushNotificationCommand {
  readonly data: CreateNotificationData;
  readonly payload: Omit<PushPayload, "token">;
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

interface DispatchPushNotificationDependencies {
  readonly pushTokenRepository: Pick<
    PushTokenRepositoryPort,
    "deactivateInvalidTokens" | "findPushTokensByUser"
  >;
  readonly pushProvider: Pick<PushProviderPort, "sendBatch">;
  readonly activePushTokenReader: Pick<ActivePushTokenReaderPort, "findByUserId">;
  readonly pushTokenCache: Pick<PushTokenCachePort, "invalidatePushTokens">;
  readonly noActiveTokenReasons: Pick<NoActiveTokenReasonReader, "findReason">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "debug" | "warn">;
}

// 한 사람의 활성·capability 토큰으로 보내고 무효 토큰을 정리한다
export class DispatchPushNotificationUseCase {
  readonly #dependencies: DispatchPushNotificationDependencies;

  constructor(dependencies: DispatchPushNotificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(
    command: DispatchPushNotificationCommand,
  ): Promise<SinglePushNotificationDeliveryResult> {
    const tokenResolution = await this.#resolveTokens(command.data);
    if (tokenResolution.status === "skipped") {
      return tokenResolution;
    }

    const results = await this.#dependencies.pushProvider.sendBatch(
      tokenResolution.tokens.map((token) => ({ ...command.payload, token })),
    );
    const revokedTokens = tokensToRevoke(results);
    if (revokedTokens.length > 0) {
      await this.#dependencies.pushTokenRepository.deactivateInvalidTokens(
        revokedTokens,
        this.#dependencies.clock.now(),
      );
      await this.#dependencies.pushTokenCache.invalidatePushTokens(
        UserId.reconstitute(command.data.userId),
      );
      this.#dependencies.logger.warn({
        event: PushDispatchLogEvent.PUSH_NOTIFICATION_DELIVERY_INVALID_TOKENS_DEACTIVATED,
        count: revokedTokens.length,
      });
    }
    this.#dependencies.logger.debug({
      event: PushDispatchLogEvent.PUSH_NOTIFICATION_DELIVERY_SINGLE_SENT,
      userId: command.data.userId,
      ...countOutcomes(results),
    });
    return { status: "sent", results };
  }

  async #resolveTokens(
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
        return {
          status: "skipped",
          reason: await this.#dependencies.noActiveTokenReasons.findReason(data.userId),
        };
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
      : {
          status: "skipped",
          reason: await this.#dependencies.noActiveTokenReasons.findReason(data.userId),
        };
  }
}
