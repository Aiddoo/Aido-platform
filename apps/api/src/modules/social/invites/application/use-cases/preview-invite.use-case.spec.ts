import { ErrorCode } from "@aido/api/errors";

import { InMemoryInviteReader } from "#test/doubles/social/in-memory-invite.reader";
import { InMemoryInviteRepository } from "#test/doubles/social/in-memory-invite.repository";
import {
  createInviteFixture,
  INVITE_FIXTURE_INVITER,
  INVITE_FIXTURE_NOW,
} from "#test/fixtures/social/invite.fixture";

import { type PreviewInviteDependencies, PreviewInviteUseCase } from "./preview-invite.use-case.js";

function readerOf(...invites: Parameters<typeof createInviteFixture>[0][]): InMemoryInviteReader {
  return new InMemoryInviteReader(
    new InMemoryInviteRepository(invites.map((overrides) => createInviteFixture(overrides))),
  );
}

function createPreviewInviteUseCase(overrides: Partial<PreviewInviteDependencies> = {}) {
  return new PreviewInviteUseCase({
    inviteReader: readerOf({ code: "K7M2QX" }),
    inviteConfig: { isEnabled: true },
    ...overrides,
  });
}

describe("PreviewInviteUseCase — 초대 미리보기", () => {
  it("붙여 넣은 소문자·하이픈 코드를 정규화해 찾고 초대한 사람 공개 프로필을 반환한다", async () => {
    // Given
    const useCase = createPreviewInviteUseCase();

    // When
    const inviter = await useCase.execute({ code: "k7m2-qx" });

    // Then
    expect(inviter).toEqual({
      userId: INVITE_FIXTURE_INVITER.id,
      name: INVITE_FIXTURE_INVITER.name,
      userTag: INVITE_FIXTURE_INVITER.userTag,
      profileImage: INVITE_FIXTURE_INVITER.profileImage,
    });
  });

  it.each([
    { name: "없는 코드", code: "B2C3D4", isEnabled: true, errorCode: ErrorCode.INVITE_2101 },
    { name: "기능 꺼짐", code: "K7M2QX", isEnabled: false, errorCode: ErrorCode.INVITE_2105 },
    { name: "형식이 틀린 코드", code: "K7M2Q0", isEnabled: true, errorCode: ErrorCode.SYS_0002 },
  ])("$name이면 $errorCode로 거절한다", async ({ code, isEnabled, errorCode }) => {
    // Given
    const useCase = createPreviewInviteUseCase({ inviteConfig: { isEnabled } });

    // When
    const preview = useCase.execute({ code });

    // Then
    await expect(preview).rejects.toMatchObject({ errorCode });
  });

  it("폐기된 코드는 INVITE_2102다", async () => {
    // Given
    const useCase = createPreviewInviteUseCase({
      inviteReader: readerOf({ status: "REVOKED", revokedAt: INVITE_FIXTURE_NOW }),
    });

    // When
    const preview = useCase.execute({ code: "K7M2QX" });

    // Then
    await expect(preview).rejects.toMatchObject({ errorCode: ErrorCode.INVITE_2102 });
  });

  it("탈퇴 대기 중인 사람의 초대는 없는 코드와 같게 INVITE_2101이다", async () => {
    // Given
    const inviteReader = readerOf({});
    inviteReader.withdraw(INVITE_FIXTURE_INVITER.id);
    const useCase = createPreviewInviteUseCase({ inviteReader });

    // When
    const preview = useCase.execute({ code: "K7M2QX" });

    // Then
    await expect(preview).rejects.toMatchObject({ errorCode: ErrorCode.INVITE_2101 });
  });
});
