import type { InviteRepositoryPort } from "#api/modules/social/invites/application/ports/invite.repository.port";
import { InviteCode } from "#api/modules/social/invites/domain/invite-code.vo";
import type { Invite, InvitePrimitives } from "#api/modules/social/invites/domain/invite.aggregate";
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
  const invite = createInviteFixture({ id: (await repository.nextId()).value, ...overrides });
  if (!(await repository.add(invite))) {
    throw new Error("초대를 저장하지 못했습니다");
  }
  return invite;
}

export function describeInviteRepositoryContract(
  createRepository: () => Promise<InviteRepositoryPort>,
): void {
  describe("초대 저장소 계약", () => {
    it("nextId는 부를 때마다 다른 id를 준다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const ids = [await repository.nextId(), await repository.nextId()];

      // Then
      expect(ids[0]?.equals(ids[1] ?? ids[0])).toBe(false);
    });

    it("저장한 ACTIVE 초대는 그 사람의 초대로만 찾고 코드로 초대한 사람 공개 프로필과 함께 읽는다", async () => {
      // Given
      const repository = await createRepository();
      const invite = await addInvite(repository, { code: "K7M2QX" });

      // When
      const active = await repository.findActiveByInviterId(INVITER_ID);
      const foreign = await repository.findActiveByInviterId(OTHER_INVITER_ID);
      const byCode = await repository.findByCodeWithInviter(InviteCode.create("k7m2-qx"));

      // Then
      expect(active?.toPrimitives()).toEqual(invite.toPrimitives());
      expect(foreign).toBeNull();
      expect(byCode?.invite.toPrimitives()).toEqual(invite.toPrimitives());
      expect(byCode?.inviter).toEqual({
        userId: INVITE_FIXTURE_INVITER.id,
        name: INVITE_FIXTURE_INVITER.name,
        userTag: INVITE_FIXTURE_INVITER.userTag,
        profileImage: INVITE_FIXTURE_INVITER.profileImage,
      });
    });

    it("이미 쓰인 코드로는 저장하지 않고 false를 반환한다", async () => {
      // Given
      const repository = await createRepository();
      await addInvite(repository, { code: "K7M2QX" });
      const duplicate = createInviteFixture({
        id: (await repository.nextId()).value,
        inviterId: INVITE_FIXTURE_OTHER_INVITER.id,
        code: "K7M2QX",
      });

      // When
      const added = await repository.add(duplicate);

      // Then
      expect(added).toBe(false);
      expect(await repository.findActiveByInviterId(OTHER_INVITER_ID)).toBeNull();
    });

    it("폐기를 저장하면 ACTIVE로 찾지 않고 코드로는 폐기 시각과 함께 읽는다", async () => {
      // Given
      const repository = await createRepository();
      const invite = await addInvite(repository);
      invite.revoke(LATER);

      // When
      await repository.save(invite);

      // Then
      expect(await repository.findActiveByInviterId(INVITER_ID)).toBeNull();
      const revoked = await repository.findByCodeWithInviter(invite.code);
      expect(revoked?.invite.toPrimitives()).toEqual({
        ...invite.toPrimitives(),
        status: "REVOKED",
        revokedAt: LATER,
      });
    });

    it("없는 코드는 null이다", async () => {
      // Given
      const repository = await createRepository();
      await addInvite(repository, { code: "K7M2QX" });

      // When
      const found = await repository.findByCodeWithInviter(InviteCode.create("B2C3D4"));

      // Then
      expect(found).toBeNull();
    });
  });
}
