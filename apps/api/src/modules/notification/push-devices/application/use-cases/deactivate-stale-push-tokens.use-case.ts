import { uniqBy } from "es-toolkit";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { DAY_MS, MINUTE_MS } from "#api/shared/domain/time/time-units";

import { PUSH_TOKEN_STALE_AFTER_DAYS } from "../../domain/push-device.domain-service.js";
import type { PushTokenCachePort } from "../ports/push-token-cache.port.js";
import type { PushTokenRepositoryPort } from "../ports/push-token.repository.port.js";
import { PushDeviceLogEvent } from "../push-devices.log-events.js";

// 문장 하나가 짧게 끝나는 크기다(docs/scaling.md 묶음 단위)
const DEACTIVATE_BATCH_SIZE = 500;
// 작은 RDS를 오래 잡지 않도록 하루 실행을 끊고 남은 토큰은 다음 날 이어 끈다
const DEACTIVATE_TIME_BUDGET_MS = MINUTE_MS;

interface DeactivateStalePushTokensDependencies {
  readonly pushTokenRepository: Pick<PushTokenRepositoryPort, "deactivateUnreportedSince">;
  readonly cache: Pick<PushTokenCachePort, "invalidatePushTokens">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "warn">;
}

interface DeactivateStalePushTokensResult {
  readonly deactivatedCount: number;
  readonly completed: boolean;
}

/** 오래 보고하지 않은 기기의 활성 토큰을 묶음으로 끈다. 그 기기가 다시 보고하면 등록이 토큰을 다시 켠다 */
export class DeactivateStalePushTokensUseCase {
  readonly #dependencies: DeactivateStalePushTokensDependencies;

  constructor(dependencies: DeactivateStalePushTokensDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(): Promise<DeactivateStalePushTokensResult> {
    const { clock, pushTokenRepository, logger } = this.#dependencies;
    const startedAt = clock.now();
    const deadline = startedAt.add({ milliseconds: DEACTIVATE_TIME_BUDGET_MS });
    // UTC 일수라 일광 절약 없이 24시간 단위다
    const reportedBefore = startedAt.subtract({
      milliseconds: PUSH_TOKEN_STALE_AFTER_DAYS * DAY_MS,
    });
    let deactivatedCount = 0;
    let completed = false;
    while (Temporal.Instant.compare(clock.now(), deadline) < 0) {
      const { userIds } = await pushTokenRepository.deactivateUnreportedSince({
        reportedBefore,
        deactivatedAt: clock.now(),
        limit: DEACTIVATE_BATCH_SIZE,
      });
      deactivatedCount += userIds.length;
      // 문장마다 커밋되므로 바로 비운다
      await this.#invalidateTokenCaches(userIds);
      if (userIds.length < DEACTIVATE_BATCH_SIZE) {
        completed = true;
        break;
      }
    }
    logger.log({
      event: PushDeviceLogEvent.STALE_PUSH_TOKENS_DEACTIVATED,
      deactivatedCount,
      completed,
    });
    return { deactivatedCount, completed };
  }

  async #invalidateTokenCaches(userIds: readonly UserId[]): Promise<void> {
    const settlements = await Promise.allSettled(
      uniqBy(userIds, (userId) => userId.value).map((userId) =>
        this.#dependencies.cache.invalidatePushTokens(userId),
      ),
    );
    const failedCount = settlements.filter(({ status }) => status === "rejected").length;
    if (failedCount > 0) {
      this.#dependencies.logger.warn({
        event: PushDeviceLogEvent.STALE_PUSH_TOKEN_CACHE_SETTLE_FAILED,
        failedCount,
        errorType: "cache-invalidation",
      });
    }
  }
}
