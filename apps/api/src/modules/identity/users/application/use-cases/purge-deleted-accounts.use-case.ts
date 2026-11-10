import { SECURITY_EVENT } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import type { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { toIsoString } from "#api/shared/domain/time/instant";

import { AuthLogEvent } from "../../../auth/application/auth.log-events.js";
import type { AuthSecurityLogRepositoryPort } from "../../../auth/application/ports/auth-security-log.repository.port.js";
import type { AuthUserRepositoryPort } from "../../../auth/application/ports/auth-user.repository.port.js";
import type {
  AccountNotificationCleanupPort,
  AccountTodoCommentCleanupPort,
  AccountUsageCleanupPort,
} from "../ports/account-cleanup.port.js";
import { UserAlerts } from "../users.alerts.js";

interface PurgeDeletedAccountsDependencies {
  readonly userRepository: Pick<
    AuthUserRepositoryPort,
    "listPurgeEligible" | "findByIdForUpdate" | "hardDelete"
  >;
  readonly unitOfWork: UnitOfWorkPort;
  readonly securityLogRepository: Pick<AuthSecurityLogRepositoryPort, "create">;
  readonly notificationCleanup: AccountNotificationCleanupPort;
  readonly todoCommentCleanup: AccountTodoCommentCleanupPort;
  readonly usageCleanup: AccountUsageCleanupPort;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
  readonly alert: Pick<OperationalAlertPort, "raise">;
}

export class PurgeDeletedAccountsUseCase {
  readonly #dependencies: PurgeDeletedAccountsDependencies;

  constructor(dependencies: PurgeDeletedAccountsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(): Promise<void> {
    const at = this.#dependencies.clock.now();
    const users = await this.#dependencies.userRepository.listPurgeEligible(at);
    let purgedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    for (const candidate of users) {
      try {
        const cleanup = await this.#dependencies.unitOfWork.run(async () => {
          const user = await this.#dependencies.userRepository.findByIdForUpdate(
            candidate.id.value,
          );
          if (user == null) {
            return null;
          }
          // 잠금을 기다리는 사이 복구됐을 수 있어 잠근 상태로 다시 판단한다
          const deletedAt = user.deletedAt;
          if (deletedAt == null || !user.isPurgeEligibleAt(at)) {
            return null;
          }
          const userId = user.id.value;
          const notification =
            await this.#dependencies.notificationCleanup.cleanupInTransaction(userId);
          const todoComment =
            await this.#dependencies.todoCommentCleanup.cleanupInTransaction(userId);
          await this.#dependencies.usageCleanup.cleanupInTransaction(userId);
          await this.#dependencies.userRepository.hardDelete(userId);
          // 삭제된 User FK를 참조하지 않고 삭제·감사 기록을 함께 커밋한다.
          await this.#dependencies.securityLogRepository.create({
            event: SECURITY_EVENT.ACCOUNT_HARD_DELETED,
            ipAddress: "SYSTEM",
            userAgent: "AccountPurgeJob",
            metadata: {
              purgedUserId: userId,
              email: user.email,
              deletedAt: toIsoString(deletedAt),
            },
          });
          return { notification, todoComment };
        });
        if (cleanup == null) {
          skippedCount += 1;
          continue;
        }
        purgedCount += 1;
        this.#dependencies.logger.log({
          event: AuthLogEvent.ACCOUNT_PURGED,
          userId: candidate.id.value,
        });
        const settlements = await Promise.allSettled([
          Promise.resolve().then(() =>
            this.#dependencies.notificationCleanup.settleAfterCommit(cleanup.notification),
          ),
          Promise.resolve().then(() =>
            this.#dependencies.todoCommentCleanup.settleAfterCommit(cleanup.todoComment),
          ),
        ]);
        for (const [index, settlement] of settlements.entries()) {
          if (settlement.status === "rejected") {
            this.#dependencies.logger.warn({
              event: AuthLogEvent.ACCOUNT_PURGE_SETTLEMENT_FAILED,
              userId: candidate.id.value,
              context: index === 0 ? "notification" : "engagement",
            });
          }
        }
      } catch (error) {
        failedCount += 1;
        this.#dependencies.logger.error({
          event: AuthLogEvent.ACCOUNT_PURGE_FAILED,
          userId: candidate.id.value,
          errorType: error instanceof Error ? error.name : "unknown",
        });
      }
    }
    this.#dependencies.logger.log({
      event: AuthLogEvent.ACCOUNT_PURGE_COMPLETED,
      candidateCount: users.length,
      purgedCount,
      skippedCount,
      failedCount,
    });
    // 사용자 하나의 실패는 잡을 실패시키지 않아 pg-boss 재시도·작업 실패 경보로는 보이지 않는다
    if (failedCount > 0) {
      this.#dependencies.alert.raise({
        ...UserAlerts.ACCOUNT_PURGE_FAILED,
        details: { candidateCount: users.length, purgedCount, failedCount },
      });
    }
  }
}
