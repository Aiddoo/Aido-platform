import { SECURITY_EVENT } from "@aido/api/vocabulary";

import type { AccountTodoCommentCleanupResult } from "#api/modules/identity/users/application/ports/account-cleanup.port";
import type { IdentityUser } from "#api/modules/identity/users/domain/identity-user.aggregate";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { InMemoryAuthSecurityLogRepository } from "#test/doubles/identity/in-memory-auth-security-log.repository";
import { InMemoryAuthUserRepository } from "#test/doubles/identity/in-memory-auth-user.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import {
  AUTH_FIXTURE_NOW,
  createIdentityUserFixture,
} from "#test/fixtures/identity/auth-session.fixture";
import {
  StubAccountNotificationCleanup,
  StubAccountTodoCommentCleanup,
  StubAccountUsageCleanup,
} from "#test/mocks/ports/account-lifecycle.stub";

import { AuthLogEvent } from "../../../auth/application/auth.log-events.js";
import { UserAlerts } from "../users.alerts.js";
import { PurgeDeletedAccountsUseCase } from "./purge-deleted-accounts.use-case.js";

// 탈퇴 유예 30일을 하루 넘긴 시각
const deletedAt = AUTH_FIXTURE_NOW.subtract({ hours: 24 * 31 });

function deletedUser(id: string, at: Temporal.Instant = deletedAt): IdentityUser {
  return createIdentityUserFixture({
    id,
    email: `${id}@example.com`,
    status: "SUSPENDED",
    deletedAt: at,
  });
}

function completion(counts: {
  readonly candidateCount: number;
  readonly purgedCount: number;
  readonly skippedCount: number;
  readonly failedCount: number;
}) {
  return { event: AuthLogEvent.ACCOUNT_PURGE_COMPLETED, ...counts };
}

class FailingTodoCommentCleanup extends StubAccountTodoCommentCleanup {
  override async cleanupInTransaction(): Promise<AccountTodoCommentCleanupResult> {
    throw new Error("Cleanup failed: private@example.com");
  }
}

class FailingHardDeleteUserRepository extends InMemoryAuthUserRepository {
  override async hardDelete(id: UserId): Promise<void> {
    if (id.value === "user-1") {
      throw new Error("Delete failed");
    }
    await super.hardDelete(id);
  }
}

class RejectingNotificationSettlement extends StubAccountNotificationCleanup {
  override async settleAfterCommit(): Promise<void> {
    throw new Error("Private settlement failure");
  }
}

class ThrowingNotificationSettlement extends StubAccountNotificationCleanup {
  override settleAfterCommit(): Promise<void> {
    throw new Error("Private settlement failure");
  }
}

class FailingSecurityLogRepository extends InMemoryAuthSecurityLogRepository {
  override async create(): Promise<void> {
    throw new Error("Audit write failed");
  }
}

// 후보 조회 뒤 잠그기 전에 복구·재탈퇴·삭제된 경합을 만들려고 조회 시점의 후보를 따로 둔다
class StaleCandidateUserRepository extends InMemoryAuthUserRepository {
  readonly #candidates: readonly IdentityUser[];

  constructor(users: readonly IdentityUser[], candidates: readonly IdentityUser[]) {
    super(users);
    this.#candidates = candidates;
  }

  override async listPurgeEligible(): Promise<IdentityUser[]> {
    return [...this.#candidates];
  }
}

describe("PurgeDeletedAccounts — 유예 기간이 지난 계정의 영구 삭제", () => {
  function given(
    options: {
      readonly userRepository?: InMemoryAuthUserRepository;
      readonly notificationCleanup?: StubAccountNotificationCleanup;
      readonly todoCommentCleanup?: StubAccountTodoCommentCleanup;
      readonly securityLogRepository?: InMemoryAuthSecurityLogRepository;
    } = {},
  ) {
    const userRepository =
      options.userRepository ?? new InMemoryAuthUserRepository([deletedUser("user-1")]);
    const notificationCleanup = options.notificationCleanup ?? new StubAccountNotificationCleanup();
    const todoCommentCleanup = options.todoCommentCleanup ?? new StubAccountTodoCommentCleanup();
    const usageCleanup = new StubAccountUsageCleanup();
    const securityLogRepository =
      options.securityLogRepository ?? new InMemoryAuthSecurityLogRepository();
    const logger = new SilentLogger();
    const alert = new RecordingOperationalAlert();
    const useCase = new PurgeDeletedAccountsUseCase({
      clock: new FixedClock(AUTH_FIXTURE_NOW),
      userRepository,
      notificationCleanup,
      todoCommentCleanup,
      usageCleanup,
      securityLogRepository,
      logger,
      alert,
      unitOfWork: new ImmediateUnitOfWork(),
    });
    return {
      alert,
      useCase,
      userRepository,
      notificationCleanup,
      todoCommentCleanup,
      usageCleanup,
      securityLogRepository,
      logger,
    };
  }

  it("영구 삭제하는 계정의 외부 호출 사용량을 함께 지운다", async () => {
    // Given
    const fixture = given();

    // When
    await fixture.useCase.execute();

    // Then
    expect(fixture.usageCleanup.cleanedUserIds).toEqual(["user-1"]);
  });

  it("알림과 댓글 정리 결과를 전달하고 계정 삭제·감사 기록과 실제 완료 수를 남긴다", async () => {
    // Given
    const fixture = given();

    // When
    await fixture.useCase.execute();

    // Then
    expect(fixture.userRepository.stored("user-1")).toBeUndefined();
    expect(fixture.notificationCleanup.cleanedUserIds).toEqual(["user-1"]);
    expect(fixture.todoCommentCleanup.cleanedUserIds).toEqual(["user-1"]);
    expect(fixture.notificationCleanup.settlements).toEqual([{ affectedUserIds: ["user-1"] }]);
    expect(fixture.todoCommentCleanup.settlements).toEqual([{ affectedTodoIds: [101] }]);
    expect(fixture.securityLogRepository.entries).toEqual([
      {
        event: SECURITY_EVENT.ACCOUNT_HARD_DELETED,
        ipAddress: "SYSTEM",
        userAgent: "AccountPurgeJob",
        metadata: {
          purgedUserId: "user-1",
          email: "user-1@example.com",
          deletedAt: "2026-10-10T00:00:00.000Z",
        },
      },
    ]);
    // 이메일은 감사 기록에만 남고 운영 로그에는 남지 않는다
    expect(fixture.logger.messages).toEqual([
      { event: AuthLogEvent.ACCOUNT_PURGED, userId: "user-1" },
      completion({ candidateCount: 1, purgedCount: 1, skippedCount: 0, failedCount: 0 }),
    ]);
  });

  it("댓글 정리가 실패하면 계정을 지우거나 감사 기록·커밋 후 정리를 실행하지 않는다", async () => {
    // Given
    const fixture = given({ todoCommentCleanup: new FailingTodoCommentCleanup() });

    // When
    await fixture.useCase.execute();

    // Then
    expect(fixture.userRepository.stored("user-1")).toBeDefined();
    expect(fixture.securityLogRepository.entries).toEqual([]);
    expect(fixture.notificationCleanup.settlements).toEqual([]);
    expect(fixture.todoCommentCleanup.settlements).toEqual([]);
    expect(fixture.logger.messages).toEqual([
      { event: AuthLogEvent.ACCOUNT_PURGE_FAILED, userId: "user-1", errorType: "Error" },
      completion({ candidateCount: 1, purgedCount: 0, skippedCount: 0, failedCount: 1 }),
    ]);
  });

  it("첫 사용자 삭제가 실패해도 다음 사용자를 실제로 삭제하고 성공과 실패를 구분한다", async () => {
    // Given
    const fixture = given({
      userRepository: new FailingHardDeleteUserRepository([
        deletedUser("user-1"),
        deletedUser("user-2"),
      ]),
    });

    // When
    await fixture.useCase.execute();

    // Then
    expect(fixture.userRepository.all.map((user) => user.id)).toEqual(["user-1"]);
    expect(fixture.securityLogRepository.entries).toEqual([
      expect.objectContaining({ metadata: expect.objectContaining({ purgedUserId: "user-2" }) }),
    ]);
    expect(fixture.notificationCleanup.settlements).toEqual([{ affectedUserIds: ["user-2"] }]);
    expect(fixture.todoCommentCleanup.settlements).toHaveLength(1);
    expect(fixture.logger.messages).toContainEqual(
      completion({ candidateCount: 2, purgedCount: 1, skippedCount: 0, failedCount: 1 }),
    );
    expect(fixture.alert.alerts).toEqual([
      {
        ...UserAlerts.ACCOUNT_PURGE_FAILED,
        details: { candidateCount: 2, purgedCount: 1, failedCount: 1 },
      },
    ]);
  });

  it.each([
    { scenario: "비동기 거절", createCleanup: () => new RejectingNotificationSettlement() },
    { scenario: "동기 예외", createCleanup: () => new ThrowingNotificationSettlement() },
  ])(
    "커밋 후 알림 정리의 $scenario도 삭제·감사 기록과 댓글 정산을 유지한다",
    async ({ createCleanup }) => {
      // Given
      const fixture = given({ notificationCleanup: createCleanup() });

      // When
      await fixture.useCase.execute();

      // Then
      expect(fixture.userRepository.stored("user-1")).toBeUndefined();
      expect(fixture.alert.alerts).toEqual([]);
      expect(fixture.securityLogRepository.entries).toHaveLength(1);
      expect(fixture.todoCommentCleanup.settlements).toEqual([{ affectedTodoIds: [101] }]);
      expect(fixture.logger.messages).toEqual([
        { event: AuthLogEvent.ACCOUNT_PURGED, userId: "user-1" },
        {
          event: AuthLogEvent.ACCOUNT_PURGE_SETTLEMENT_FAILED,
          userId: "user-1",
          context: "notification",
        },
        completion({ candidateCount: 1, purgedCount: 1, skippedCount: 0, failedCount: 0 }),
      ]);
    },
  );

  it("감사 저장이 실패하면 커밋 후 정리를 실행하지 않고 실패 수를 기록한다", async () => {
    // Given
    const fixture = given({ securityLogRepository: new FailingSecurityLogRepository() });

    // When
    await fixture.useCase.execute();

    // Then
    expect(fixture.notificationCleanup.settlements).toEqual([]);
    expect(fixture.todoCommentCleanup.settlements).toEqual([]);
    expect(fixture.logger.messages).toContainEqual(
      completion({ candidateCount: 1, purgedCount: 0, skippedCount: 0, failedCount: 1 }),
    );
  });

  it("조회 이후 복구·갱신·삭제된 후보는 최신 상태를 확인하고 정리하지 않는다", async () => {
    // Given
    const restored = createIdentityUserFixture({
      id: "restored-user",
      email: "restored@example.com",
    });
    const recent = deletedUser("recent-user", AUTH_FIXTURE_NOW);
    const fixture = given({
      userRepository: new StaleCandidateUserRepository(
        [restored, recent],
        [deletedUser("restored-user"), deletedUser("recent-user"), deletedUser("missing-user")],
      ),
    });

    // When
    await fixture.useCase.execute();

    // Then
    expect(fixture.userRepository.all.map((user) => user.id)).toEqual([
      "restored-user",
      "recent-user",
    ]);
    expect(fixture.notificationCleanup.cleanedUserIds).toEqual([]);
    expect(fixture.todoCommentCleanup.cleanedUserIds).toEqual([]);
    expect(fixture.securityLogRepository.entries).toEqual([]);
    expect(fixture.logger.messages).toEqual([
      completion({ candidateCount: 3, purgedCount: 0, skippedCount: 3, failedCount: 0 }),
    ]);
  });

  it("삭제 대상이 없으면 정리와 감사 기록 없이 완료 수 0을 기록한다", async () => {
    // Given
    const fixture = given({ userRepository: new InMemoryAuthUserRepository() });

    // When
    await fixture.useCase.execute();

    // Then
    expect(fixture.notificationCleanup.cleanedUserIds).toEqual([]);
    expect(fixture.todoCommentCleanup.cleanedUserIds).toEqual([]);
    expect(fixture.securityLogRepository.entries).toEqual([]);
    expect(fixture.logger.messages).toEqual([
      completion({ candidateCount: 0, purgedCount: 0, skippedCount: 0, failedCount: 0 }),
    ]);
  });
});
