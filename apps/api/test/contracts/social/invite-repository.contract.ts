import type { InviteReaderPort } from "#api/modules/social/invites/application/ports/invite.reader.port";
import type { InviteRepositoryPort } from "#api/modules/social/invites/application/ports/invite.repository.port";
import type { Invite, InvitePrimitives } from "#api/modules/social/invites/domain/invite.aggregate";
import { InviteCode } from "#api/modules/social/shared/domain/invite-code.vo";
import { InviteId } from "#api/modules/social/shared/domain/invite-id.vo";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  createInviteFixture,
  INVITE_FIXTURE_INVITER,
  INVITE_FIXTURE_NOW,
  INVITE_FIXTURE_OTHER_INVITER,
} from "#test/fixtures/social/invite.fixture";

const INVITER_ID = UserId.reconstitute(INVITE_FIXTURE_INVITER.id);
const OTHER_INVITER_ID = UserId.reconstitute(INVITE_FIXTURE_OTHER_INVITER.id);
const LATER = INVITE_FIXTURE_NOW.add({ hours: 1 });

async function addInvite(
  repository: InviteRepositoryPort,
  overrides: Partial<InvitePrimitives> = {},
): Promise<Invite> {
  const invite = createInviteFixture({ id: InviteId.generate().value, ...overrides });
  if (!(await repository.saveIfCodeUnused(invite))) {
    throw new Error("초대를 저장하지 못했습니다");
  }
  return invite;
}

// 같은 초대 상태를 저장소로 쓰고 조회로 읽는다
export interface InviteRepositoryContractSubject {
  readonly repository: InviteRepositoryPort;
  readonly reader: InviteReaderPort;
}

export function describeInviteRepositoryContract(
  createSubject: () => Promise<InviteRepositoryContractSubject>,
): void {
  describe("초대 저장소 계약", () => {
    it("저장한 ACTIVE 초대는 그 사람의 초대로만 찾고 코드로 초대한 사람 공개 프로필과 함께 읽는다", async () => {
      // Given
      const { repository, reader } = await createSubject();
      const invite = await addInvite(repository, { code: "K7M2QX" });

      // When
      const active = await repository.findActiveByInviterId(INVITER_ID);
      const foreign = await repository.findActiveByInviterId(OTHER_INVITER_ID);
      const byCode = await reader.findByCodeWithInviter(InviteCode.create("k7m2-qx"));

      // Then
      expect(active?.toPrimitives()).toEqual(invite.toPrimitives());
      expect(foreign).toBeNull();
      expect(byCode).toEqual({
        inviteId: invite.id.value,
        inviterId: INVITE_FIXTURE_INVITER.id,
        isActive: true,
        inviter: {
          userId: INVITE_FIXTURE_INVITER.id,
          name: INVITE_FIXTURE_INVITER.name,
          userTag: INVITE_FIXTURE_INVITER.userTag,
          profileImage: INVITE_FIXTURE_INVITER.profileImage,
        },
      });
    });

    it("이미 쓰인 코드로는 저장하지 않고 false를 반환한다", async () => {
      // Given
      const { repository } = await createSubject();
      await addInvite(repository, { code: "K7M2QX" });
      const duplicate = createInviteFixture({
        id: InviteId.generate().value,
        inviterId: INVITE_FIXTURE_OTHER_INVITER.id,
        code: "K7M2QX",
      });

      // When
      const added = await repository.saveIfCodeUnused(duplicate);

      // Then
      expect(added).toBe(false);
      expect(await repository.findActiveByInviterId(OTHER_INVITER_ID)).toBeNull();
    });

    it("폐기를 저장하면 ACTIVE로 찾지 않고 코드로는 폐기한 초대로 읽는다", async () => {
      // Given
      const { repository, reader } = await createSubject();
      const invite = await addInvite(repository);
      invite.revoke(LATER);

      // When
      await repository.save(invite);

      // Then
      expect(await repository.findActiveByInviterId(INVITER_ID)).toBeNull();
      const revoked = await reader.findByCodeWithInviter(invite.code);
      expect(revoked).toMatchObject({ inviteId: invite.id.value, isActive: false });
    });

    it("없는 코드는 null이다", async () => {
      // Given
      const { repository, reader } = await createSubject();
      await addInvite(repository, { code: "K7M2QX" });

      // When
      const found = await reader.findByCodeWithInviter(InviteCode.create("B2C3D4"));

      // Then
      expect(found).toBeNull();
    });
  });
}
