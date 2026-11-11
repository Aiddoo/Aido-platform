import { ErrorCode } from "@aido/api/errors";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { InMemoryInviteRepository } from "#test/doubles/social/in-memory-invite.repository";
import { StubInviteCodeGenerator } from "#test/doubles/social/stub-invite-code-generator";
import {
  createInviteFixture,
  INVITE_FIXTURE_INVITER_ID,
  INVITE_FIXTURE_NOW,
  INVITE_FIXTURE_OTHER_INVITER_ID,
} from "#test/fixtures/social/invite.fixture";

import { IssueInviteUseCase } from "./issue-invite.use-case.js";

const OTHER_INVITER_ID = UserId.reconstitute(INVITE_FIXTURE_OTHER_INVITER_ID);

function createIssueInviteUseCase(codes: readonly string[]) {
  // 다른 사람이 이미 K7M2QX를 쓰고 있다
  const inviteRepository = new InMemoryInviteRepository([
    createInviteFixture({ inviterId: INVITE_FIXTURE_INVITER_ID, code: "K7M2QX" }),
  ]);
  const useCase = new IssueInviteUseCase({
    inviteRepository,
    codeGenerator: new StubInviteCodeGenerator(codes),
  });
  return { useCase, inviteRepository };
}

describe("IssueInviteUseCase — 초대 코드 발급", () => {
  it("코드가 겹치면 새 코드로 다시 발급한다", async () => {
    // Given
    const { useCase, inviteRepository } = createIssueInviteUseCase(["K7M2QX", "B2C3D4"]);

    // When
    const invite = await useCase.execute({ inviterId: OTHER_INVITER_ID, now: INVITE_FIXTURE_NOW });

    // Then
    expect(invite.toPrimitives()).toMatchObject({
      inviterId: INVITE_FIXTURE_OTHER_INVITER_ID,
      code: "B2C3D4",
      status: "ACTIVE",
      createdAt: INVITE_FIXTURE_NOW,
    });
    expect((await inviteRepository.findActiveByInviterId(OTHER_INVITER_ID))?.code.value).toBe(
      "B2C3D4",
    );
  });

  it("5번 모두 겹치면 발급을 멈추고 SYS_0001을 반환한다", async () => {
    // Given
    const { useCase, inviteRepository } = createIssueInviteUseCase(
      Array.from({ length: 5 }, () => "K7M2QX"),
    );

    // When
    const issued = useCase.execute({ inviterId: OTHER_INVITER_ID, now: INVITE_FIXTURE_NOW });

    // Then
    await expect(issued).rejects.toMatchObject({
      errorCode: ErrorCode.SYS_0001,
      details: { detail: "Invite code collision retries exhausted", attempts: 5 },
    });
    expect(inviteRepository.size).toBe(1);
  });
});
