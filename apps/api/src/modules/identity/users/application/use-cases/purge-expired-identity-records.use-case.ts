import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";

import type { OAuthStateRepositoryPort } from "../../../oauth-states/application/ports/oauth-state.repository.port.js";
import { OAUTH_STATE_RETENTION_DAYS } from "../../../oauth-states/domain/oauth-states.constants.js";
import type { LoginAttemptRepositoryPort } from "../../../sessions/application/ports/login-attempt.repository.port.js";
import type { SessionRepositoryPort } from "../../../sessions/application/ports/session.repository.port.js";
import {
  LOGIN_ATTEMPT_RETENTION_DAYS,
  SESSION_RETENTION_DAYS,
} from "../../../sessions/domain/sessions.constants.js";
import type { VerificationRepositoryPort } from "../../../verifications/application/ports/verification.repository.port.js";
import { VERIFICATION_RETENTION_DAYS } from "../../../verifications/domain/verifications.constants.js";
import { SECURITY_LOG_RETENTION_DAYS } from "../../domain/users.constants.js";
import type { SecurityLogRepositoryPort } from "../ports/security-log.repository.port.js";
import { UserLogEvent } from "../users.log-events.js";

// 한 번에 지우지 않고 문장마다 따로 커밋해 잠금과 WAL을 작게 나눈다
const PURGE_BATCH_SIZE = 500;

interface PurgeExpiredIdentityRecordsDependencies {
  readonly sessionRepository: Pick<SessionRepositoryPort, "deleteEndedBefore">;
  readonly loginAttemptRepository: Pick<LoginAttemptRepositoryPort, "deleteAttemptedBefore">;
  readonly verificationRepository: Pick<VerificationRepositoryPort, "deleteExpiredBefore">;
  readonly oauthStateRepository: Pick<OAuthStateRepositoryPort, "deleteExpiredBefore">;
  readonly securityLogRepository: Pick<SecurityLogRepositoryPort, "deleteRecordedBefore">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
  readonly batchSize?: number;
}

export class PurgeExpiredIdentityRecordsUseCase {
  readonly #dependencies: PurgeExpiredIdentityRecordsDependencies;

  constructor(dependencies: PurgeExpiredIdentityRecordsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(): Promise<void> {
    const {
      sessionRepository,
      loginAttemptRepository,
      verificationRepository,
      oauthStateRepository,
      securityLogRepository,
      clock,
      logger,
    } = this.#dependencies;
    const now = clock.now();

    const sessionCount = await this.#deleteInBatches((limit) =>
      sessionRepository.deleteEndedBefore(daysBefore(now, SESSION_RETENTION_DAYS), limit),
    );
    const loginAttemptCount = await this.#deleteInBatches((limit) =>
      loginAttemptRepository.deleteAttemptedBefore(
        daysBefore(now, LOGIN_ATTEMPT_RETENTION_DAYS),
        limit,
      ),
    );
    const verificationCount = await this.#deleteInBatches((limit) =>
      verificationRepository.deleteExpiredBefore(
        daysBefore(now, VERIFICATION_RETENTION_DAYS),
        limit,
      ),
    );
    const oauthStateCount = await this.#deleteInBatches((limit) =>
      oauthStateRepository.deleteExpiredBefore(daysBefore(now, OAUTH_STATE_RETENTION_DAYS), limit),
    );
    const securityLogCount = await this.#deleteInBatches((limit) =>
      securityLogRepository.deleteRecordedBefore(
        daysBefore(now, SECURITY_LOG_RETENTION_DAYS),
        limit,
      ),
    );

    logger.log({
      event: UserLogEvent.EXPIRED_RECORD_PURGE_COMPLETED,
      sessionCount,
      loginAttemptCount,
      verificationCount,
      oauthStateCount,
      securityLogCount,
    });
  }

  async #deleteInBatches(deleteBatch: (limit: number) => Promise<number>): Promise<number> {
    const batchSize = this.#dependencies.batchSize ?? PURGE_BATCH_SIZE;
    let deletedCount = 0;
    for (;;) {
      const batchCount = await deleteBatch(batchSize);
      deletedCount += batchCount;
      if (batchCount < batchSize) {
        return deletedCount;
      }
    }
  }
}

// UTC 일수라 일광 절약 없이 24시간 단위다
function daysBefore(now: Temporal.Instant, days: number): Temporal.Instant {
  return now.subtract({ hours: 24 * days });
}
