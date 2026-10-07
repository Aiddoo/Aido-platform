import { vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { UserFixture } from "#test/fixtures/index";
import {
  StubAccountLifecycleRepository,
  StubAccountNotificationCleanup,
  StubAccountTodoCommentCleanup,
} from "#test/mocks/ports/account-lifecycle.stub";
import { StubAuthSecurityLogRepository } from "#test/mocks/ports/auth-session.stub";
import { createUnitOfWorkMock } from "#test/mocks/ports/unit-of-work.mock";

import { SECURITY_EVENT } from "../../../domain/constants/auth/auth.constants.js";
import { IdentityLogEvent } from "../../observability/auth/identity-log.events.js";
import { PurgeDeletedAccounts } from "./purge-deleted-accounts.use-case.js";

const currentTime = new Date("2026-12-31T23:59:00Z");
const deletedAt = new Date("2026-11-30T23:59:00Z");

describe("PurgeDeletedAccounts — 유예 기간이 지난 계정의 영구 삭제", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(currentTime);
  });
  afterEach(() => vi.useRealTimers());

  function givenUsers(userIds: readonly string[] = ["user-1"]) {
    const userRepository = new StubAccountLifecycleRepository(
      userIds.map((id) => UserFixture.create({ id, status: "SUSPENDED", deletedAt })),
    );
    const notificationCleanup = new StubAccountNotificationCleanup();
    const todoCommentCleanup = new StubAccountTodoCommentCleanup();
    const securityLogRepository = new StubAuthSecurityLogRepository();
    const logger = mock<ApplicationLogger>();
    const useCase = new PurgeDeletedAccounts({
      userRepository,
      notificationCleanup,
      todoCommentCleanup,
      securityLogRepository,
      logger,
      unitOfWork: createUnitOfWorkMock(),
    });
    return {
      useCase,
      userRepository,
      notificationCleanup,
      todoCommentCleanup,
      securityLogRepository,
      logger,
    };
  }

  it("알림과 댓글 정리 결과를 전달하고 계정 삭제·감사 기록과 실제 완료 수를 남긴다", async () => {
    // Given
    const fixture = givenUsers();
    const user = fixture.userRepository.users.get("user-1");
    if (user === undefined) throw new Error("삭제할 사용자 fixture가 없습니다.");

    // When
    await fixture.useCase.execute();

    // Then
    expect(fixture.userRepository.users.has(user.id)).toBe(false);
    expect(fixture.notificationCleanup.cleanedUserIds).toEqual([user.id]);
    expect(fixture.todoCommentCleanup.cleanedUserIds).toEqual([user.id]);
    expect(fixture.notificationCleanup.settlements).toEqual([{ affectedUserIds: [user.id] }]);
    expect(fixture.todoCommentCleanup.settlements).toEqual([{ affectedTodoIds: [101] }]);
    expect(fixture.securityLogRepository.entries).toEqual([
      {
        event: SECURITY_EVENT.ACCOUNT_HARD_DELETED,
        ipAddress: "SYSTEM",
        userAgent: "AccountPurgeJob",
        metadata: { purgedUserId: user.id, email: user.email, deletedAt: deletedAt.toISOString() },
      },
    ]);
    expect(fixture.logger.log).toHaveBeenCalledWith({
      event: IdentityLogEvent.ACCOUNT_PURGE_COMPLETED,
      candidateCount: 1,
      purgedCount: 1,
      skippedCount: 0,
      failedCount: 0,
    });
    expect(JSON.stringify(fixture.logger.log.mock.calls)).not.toContain(user.email);
  });

  it("댓글 정리가 실패하면 계정을 지우거나 감사 기록·커밋 후 정리를 실행하지 않는다", async () => {
    // Given
    const fixture = givenUsers();
    vi.spyOn(fixture.todoCommentCleanup, "cleanupInTransaction").mockRejectedValueOnce(
      new Error("Cleanup failed: private@example.com"),
    );

    // When
    await fixture.useCase.execute();

    // Then
    expect(fixture.userRepository.users.has("user-1")).toBe(true);
    expect(fixture.securityLogRepository.entries).toEqual([]);
    expect(fixture.notificationCleanup.settlements).toEqual([]);
    expect(fixture.todoCommentCleanup.settlements).toEqual([]);
    expect(fixture.logger.log).toHaveBeenCalledWith({
      event: IdentityLogEvent.ACCOUNT_PURGE_COMPLETED,
      candidateCount: 1,
      purgedCount: 0,
      skippedCount: 0,
      failedCount: 1,
    });
    expect(JSON.stringify(fixture.logger.error.mock.calls)).not.toContain("private@example.com");
  });

  it("첫 사용자 삭제가 실패해도 다음 사용자를 실제로 삭제하고 성공과 실패를 구분한다", async () => {
    // Given
    const fixture = givenUsers(["user-1", "user-2"]);
    vi.spyOn(fixture.userRepository, "hardDelete").mockRejectedValueOnce(
      new Error("Delete failed"),
    );

    // When
    await fixture.useCase.execute();

    // Then
    expect(new Set(fixture.userRepository.users.keys())).toEqual(new Set(["user-1"]));
    expect(fixture.securityLogRepository.entries).toEqual([
      expect.objectContaining({ metadata: expect.objectContaining({ purgedUserId: "user-2" }) }),
    ]);
    expect(fixture.notificationCleanup.settlements).toEqual([{ affectedUserIds: ["user-2"] }]);
    expect(fixture.todoCommentCleanup.settlements).toHaveLength(1);
    expect(fixture.logger.log).toHaveBeenCalledWith({
      event: IdentityLogEvent.ACCOUNT_PURGE_COMPLETED,
      candidateCount: 2,
      purgedCount: 1,
      skippedCount: 0,
      failedCount: 1,
    });
  });

  it.each(["비동기 거절", "동기 예외"])(
    "커밋 후 알림 정리의 %s도 삭제·감사 기록과 댓글 정산을 유지한다",
    async (scenario) => {
      // Given
      const fixture = givenUsers();
      const settle = vi.spyOn(fixture.notificationCleanup, "settleAfterCommit");
      if (scenario === "비동기 거절")
        settle.mockRejectedValueOnce(new Error("Private settlement failure"));
      else
        settle.mockImplementationOnce(() => {
          throw new Error("Private settlement failure");
        });

      // When
      await fixture.useCase.execute();

      // Then
      expect(fixture.userRepository.users.has("user-1")).toBe(false);
      expect(fixture.securityLogRepository.entries).toHaveLength(1);
      expect(fixture.todoCommentCleanup.settlements).toEqual([{ affectedTodoIds: [101] }]);
      expect(fixture.logger.log).toHaveBeenCalledWith({
        event: IdentityLogEvent.ACCOUNT_PURGE_COMPLETED,
        candidateCount: 1,
        purgedCount: 1,
        skippedCount: 0,
        failedCount: 0,
      });
      expect(fixture.logger.warn).toHaveBeenCalledWith({
        event: IdentityLogEvent.ACCOUNT_PURGE_SETTLEMENT_FAILED,
        userId: "user-1",
        context: "notification",
      });
      expect(JSON.stringify(fixture.logger.warn.mock.calls)).not.toContain(
        "Private settlement failure",
      );
    },
  );

  it("감사 저장이 실패하면 커밋 후 정리를 실행하지 않고 실패 수를 기록한다", async () => {
    // Given
    const fixture = givenUsers();
    vi.spyOn(fixture.securityLogRepository, "create").mockRejectedValueOnce(
      new Error("Audit write failed"),
    );

    // When
    await fixture.useCase.execute();

    // Then
    expect(fixture.notificationCleanup.settlements).toEqual([]);
    expect(fixture.todoCommentCleanup.settlements).toEqual([]);
    expect(fixture.logger.log).toHaveBeenCalledWith({
      event: IdentityLogEvent.ACCOUNT_PURGE_COMPLETED,
      candidateCount: 1,
      purgedCount: 0,
      skippedCount: 0,
      failedCount: 1,
    });
  });

  it("조회 이후 복구·갱신·삭제된 후보는 최신 상태를 확인하고 정리하지 않는다", async () => {
    // Given
    const fixture = givenUsers(["restored-user", "recent-user", "missing-user"]);
    fixture.userRepository.candidateSnapshot = [...fixture.userRepository.users.values()].map(
      (user) => ({ id: user.id, email: user.email, deletedAt }),
    );
    await fixture.userRepository.restore("restored-user");
    await fixture.userRepository.softDelete("recent-user", currentTime);
    await fixture.userRepository.hardDelete("missing-user");

    // When
    await fixture.useCase.execute();

    // Then
    expect(new Set(fixture.userRepository.users.keys())).toEqual(
      new Set(["restored-user", "recent-user"]),
    );
    expect(fixture.notificationCleanup.cleanedUserIds).toEqual([]);
    expect(fixture.todoCommentCleanup.cleanedUserIds).toEqual([]);
    expect(fixture.securityLogRepository.entries).toEqual([]);
    expect(fixture.logger.log).toHaveBeenCalledWith({
      event: IdentityLogEvent.ACCOUNT_PURGE_COMPLETED,
      candidateCount: 3,
      purgedCount: 0,
      skippedCount: 3,
      failedCount: 0,
    });
  });

  it("삭제 대상이 없으면 정리와 감사 기록 없이 완료 수 0을 기록한다", async () => {
    // Given
    const fixture = givenUsers([]);

    // When
    await fixture.useCase.execute();

    // Then
    expect(fixture.notificationCleanup.cleanedUserIds).toEqual([]);
    expect(fixture.todoCommentCleanup.cleanedUserIds).toEqual([]);
    expect(fixture.securityLogRepository.entries).toEqual([]);
    expect(fixture.logger.log).toHaveBeenCalledWith({
      event: IdentityLogEvent.ACCOUNT_PURGE_COMPLETED,
      candidateCount: 0,
      purgedCount: 0,
      skippedCount: 0,
      failedCount: 0,
    });
  });
});
