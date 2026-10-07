import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";

import { IdentityUser } from "../../../domain/aggregates/auth/identity-user.aggregate.js";
import { ACCOUNT_DELETION, SECURITY_EVENT } from "../../../domain/constants/auth/auth.constants.js";
import { IdentityLogEvent } from "../../observability/auth/identity-log.events.js";
import type {
  AccountNotificationCleanupPort,
  AccountTodoCommentCleanupPort,
} from "../../ports/auth/account-cleanup.port.js";
import type {
  AuthSecurityLogRepositoryPort,
  AuthAccountLifecycleRepositoryPort,
} from "../../ports/auth/auth-persistence.port.js";

interface PurgeDeletedAccountsDependencies {
  readonly userRepository: AuthAccountLifecycleRepositoryPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly securityLogRepository: Pick<AuthSecurityLogRepositoryPort, "create">;
  readonly notificationCleanup: AccountNotificationCleanupPort;
  readonly todoCommentCleanup: AccountTodoCommentCleanupPort;
  readonly logger: ApplicationLogger;
}

export class PurgeDeletedAccounts {
  readonly #dependencies: PurgeDeletedAccountsDependencies;

  constructor(dependencies: PurgeDeletedAccountsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(): Promise<void> {
    const at = now();
    const users = await this.#dependencies.userRepository.findSoftDeletedForPurge(
      ACCOUNT_DELETION.GRACE_PERIOD_DAYS,
      at,
    );
    let purgedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    for (const candidate of users) {
      try {
        const cleanup = await this.#dependencies.unitOfWork.run(async () => {
          const user = await this.#dependencies.userRepository.findByIdForPurge(candidate.id);
          if (user === null) {
            return null;
          }
          const identityUser = IdentityUser.reconstitute(user);
          if (user.deletedAt === null || !identityUser.isPurgeEligibleAt(at)) {
            return null;
          }
          const notification = await this.#dependencies.notificationCleanup.cleanupInTransaction(
            user.id,
          );
          const todoComment = await this.#dependencies.todoCommentCleanup.cleanupInTransaction(
            user.id,
          );
          await this.#dependencies.userRepository.hardDelete(user.id);
          // 삭제된 User FK를 참조하지 않고 삭제·감사 기록을 함께 커밋한다.
          await this.#dependencies.securityLogRepository.create({
            event: SECURITY_EVENT.ACCOUNT_HARD_DELETED,
            ipAddress: "SYSTEM",
            userAgent: "AccountPurgeJob",
            metadata: {
              purgedUserId: user.id,
              email: user.email,
              deletedAt: user.deletedAt.toISOString(),
            },
          });
          return { notification, todoComment };
        });
        if (cleanup === null) {
          skippedCount += 1;
          continue;
        }
        purgedCount += 1;
        this.#dependencies.logger.log({
          event: IdentityLogEvent.ACCOUNT_PURGED,
          userId: candidate.id,
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
              event: IdentityLogEvent.ACCOUNT_PURGE_SETTLEMENT_FAILED,
              userId: candidate.id,
              context: index === 0 ? "notification" : "engagement",
            });
          }
        }
      } catch (error) {
        failedCount += 1;
        this.#dependencies.logger.error({
          event: IdentityLogEvent.ACCOUNT_PURGE_FAILED,
          userId: candidate.id,
          errorType: error instanceof Error ? error.name : "unknown",
        });
      }
    }
    this.#dependencies.logger.log({
      event: IdentityLogEvent.ACCOUNT_PURGE_COMPLETED,
      candidateCount: users.length,
      purgedCount,
      skippedCount,
      failedCount,
    });
  }
}
