import { groupBy } from "es-toolkit";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  PushTokenCachePort,
  PushTokenRepositoryPort,
} from "../../../push-devices/notification-push-devices.public.js";
import type { PushSendResult } from "../ports/push-channel.port.js";
import { countOutcomes, tokensToRevoke } from "../push-delivery-results.mapper.js";
import { PushDispatchLogEvent } from "../push-dispatches.log-events.js";
import type { PreparedPushBatch } from "./prepare-push-batch.use-case.js";
import type { SendPushMessagesUseCase } from "./send-push-messages.use-case.js";

export interface PushBatchDeliveryResult {
  readonly attemptedDispatchIds: ReadonlySet<number>;
  readonly resultsByDispatch: ReadonlyMap<number, PushSendResult[]>;
}

interface SendPushBatchDependencies {
  readonly pushTokenRepository: Pick<PushTokenRepositoryPort, "deactivateInvalidTokens">;
  readonly sendMessages: Pick<SendPushMessagesUseCase, "execute">;
  readonly pushTokenCache: Pick<PushTokenCachePort, "invalidatePushTokens">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "debug" | "warn">;
}

// 준비한 메시지를 한 번에 보내고 결과를 발송별로 묶는다. 무효 토큰은 정리한다
export class SendPushBatchUseCase {
  readonly #dependencies: SendPushBatchDependencies;

  constructor(dependencies: SendPushBatchDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(
    prepared: Extract<PreparedPushBatch, { readonly status: "ready" }>,
  ): Promise<PushBatchDeliveryResult> {
    const results = await this.#dependencies.sendMessages.execute(prepared.messages);
    const revokedTokens = tokensToRevoke(results);
    if (revokedTokens.length > 0) {
      await this.#dependencies.pushTokenRepository.deactivateInvalidTokens(
        revokedTokens,
        this.#dependencies.clock.now(),
      );
      await Promise.all(
        prepared.recipientUserIds.map((userId) =>
          this.#dependencies.pushTokenCache.invalidatePushTokens(UserId.reconstitute(userId)),
        ),
      );
      this.#dependencies.logger.warn({
        event: PushDispatchLogEvent.PUSH_NOTIFICATION_DELIVERY_BATCH_INVALID_TOKENS_DEACTIVATED,
        count: revokedTokens.length,
      });
    }
    this.#dependencies.logger.debug({
      event: PushDispatchLogEvent.PUSH_NOTIFICATION_DELIVERY_BATCH_SENT,
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
}
