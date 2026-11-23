import { SECURITY_EVENT } from "#api/modules/identity/users/domain/users.constants";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { toIsoString } from "#api/shared/domain/time/instant";

import type { User } from "../../domain/user.aggregate.js";
import type {
  AccountNotificationCleanupPort,
  AccountTodoCommentCleanupPort,
  AccountUsageCleanupPort,
} from "../ports/account-cleanup.port.js";
import type { SecurityLogRepositoryPort } from "../ports/security-log.repository.port.js";
import type { UserRepositoryPort } from "../ports/user.repository.port.js";
import { UserAlerts } from "../users.alerts.js";
import { UserLogEvent } from "../users.log-events.js";

// 사용자마다 잠금·정리·삭제를 한 트랜잭션으로 하므로 후보는 이 수만큼씩 id 순으로 이어 읽는다
const ACCOUNT_PURGE_BATCH_SIZE = 100;

type PurgeOutcome = "purged" | "skipped" | "failed";

interface PurgeDeletedAccountsDependencies {
  readonly userRepository: Pick<
    UserRepositoryPort,
    "listPurgeEligible" | "findByIdForUpdate" | "hardDelete"
  >;
  readonly unitOfWork: UnitOfWorkPort;
  readonly securityLogRepository: Pick<SecurityLogRepositoryPort, "create">;
  readonly notificationCleanup: AccountNotificationCleanupPort;
  readonly todoCommentCleanup: AccountTodoCommentCleanupPort;
  readonly usageCleanup: AccountUsageCleanupPort;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
  readonly alert: Pick<OperationalAlertPort, "raise">;
  readonly batchSize?: number;
}

export class PurgeDeletedAccountsUseCase {
  readonly #dependencies: PurgeDeletedAccountsDependencies;

  constructor(dependencies: PurgeDeletedAccountsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(): Promise<void> {
    const at = this.#dependencies.clock.now();
    const outcomes: Record<PurgeOutcome, number> = { purged: 0, skipped: 0, failed: 0 };
    let candidateCount = 0;
    for await (const candidate of this.#purgeCandidates(at)) {
      candidateCount += 1;
      outcomes[await this.#purge(candidate.id, at)] += 1;
    }
    this.#dependencies.logger.log({
      event: UserLogEvent.ACCOUNT_PURGE_COMPLETED,
      candidateCount,
      purgedCount: outcomes.purged,
      skippedCount: outcomes.skipped,
      failedCount: outcomes.failed,
    });
    // 사용자 하나의 실패는 잡을 실패시키지 않아 pg-boss 재시도·작업 실패 경보로는 보이지 않는다
    if (outcomes.failed > 0) {
      this.#dependencies.alert.raise({
        ...UserAlerts.ACCOUNT_PURGE_FAILED,
        details: {
          candidateCount,
          purgedCount: outcomes.purged,
          failedCount: outcomes.failed,
        },
      });
    }
  }

  // 실패·건너뛴 후보도 커서가 지나가므로 같은 실행에서 다시 읽지 않는다
  async *#purgeCandidates(at: Temporal.Instant): AsyncGenerator<User> {
    const batchSize = this.#dependencies.batchSize ?? ACCOUNT_PURGE_BATCH_SIZE;
    let afterId: UserId | null = null;
    for (;;) {
      const batch: readonly User[] = await this.#dependencies.userRepository.listPurgeEligible({
        now: at,
        afterId,
        limit: batchSize,
      });
      yield* batch;
      const last = batch.at(-1);
      if (last == null || batch.length < batchSize) {
        return;
      }
      afterId = last.id;
    }
  }

  async #purge(userId: UserId, at: Temporal.Instant): Promise<PurgeOutcome> {
    try {
      const cleanup = await this.#dependencies.unitOfWork.run(async () => {
        const user = await this.#dependencies.userRepository.findByIdForUpdate(userId);
        if (user == null) {
          return null;
        }
        // 잠금을 기다리는 사이 복구됐을 수 있어 잠근 상태로 다시 판단한다
        const deletedAt = user.deletedAt;
        if (deletedAt == null || !user.isPurgeEligibleAt(at)) {
          return null;
        }
        const notification = await this.#dependencies.notificationCleanup.cleanupInTransaction(
          user.id,
        );
        const todoComment = await this.#dependencies.todoCommentCleanup.cleanupInTransaction(
          user.id,
        );
        await this.#dependencies.usageCleanup.cleanupInTransaction(user.id);
        await this.#dependencies.userRepository.hardDelete(user.id);
        // 삭제된 User FK를 참조하지 않고 삭제·감사 기록을 함께 커밋한다.
        await this.#dependencies.securityLogRepository.create({
          event: SECURITY_EVENT.ACCOUNT_HARD_DELETED,
          ipAddress: "SYSTEM",
          userAgent: "AccountPurgeJob",
          metadata: {
            purgedUserId: user.id.value,
            email: user.email,
            deletedAt: toIsoString(deletedAt),
          },
        });
        return { notification, todoComment };
      });
      if (cleanup == null) {
        return "skipped";
      }
      this.#dependencies.logger.log({
        event: UserLogEvent.ACCOUNT_PURGED,
        userId: userId.value,
      });
      const settlements = await Promise.allSettled([
        Promise.try(() =>
          this.#dependencies.notificationCleanup.settleAfterCommit(cleanup.notification),
        ),
        Promise.try(() =>
          this.#dependencies.todoCommentCleanup.settleAfterCommit(cleanup.todoComment),
        ),
      ]);
      for (const [index, settlement] of settlements.entries()) {
        if (settlement.status === "rejected") {
          this.#dependencies.logger.warn({
            event: UserLogEvent.ACCOUNT_PURGE_SETTLEMENT_FAILED,
            userId: userId.value,
            context: index === 0 ? "notification" : "engagement",
          });
        }
      }
      return "purged";
    } catch (error) {
      this.#dependencies.logger.error({
        event: UserLogEvent.ACCOUNT_PURGE_FAILED,
        userId: userId.value,
        errorType: error instanceof Error ? error.name : "unknown",
      });
      return "failed";
    }
  }
}
