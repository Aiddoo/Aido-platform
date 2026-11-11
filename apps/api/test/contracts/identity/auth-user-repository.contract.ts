import { ACCOUNT_DELETION } from "@aido/api/vocabulary";

import { AuthPersistenceConflict } from "#api/modules/identity/auth/application/auth.errors";
import type { AuthUserRepositoryPort } from "#api/modules/identity/auth/application/ports/auth-user.repository.port";
import type { IdentityUser } from "#api/modules/identity/users/domain/identity-user.aggregate";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AUTH_FIXTURE_NOW } from "#test/fixtures/identity/auth-session.fixture";

const GRACE_PERIOD = { hours: 24 * ACCOUNT_DELETION.GRACE_PERIOD_DAYS };
let emailSequence = 0;

async function createUser(
  repository: AuthUserRepositoryPort,
  overrides: { readonly emailVerifiedAt?: Temporal.Instant } = {},
): Promise<IdentityUser> {
  emailSequence += 1;
  return repository.create({
    email: `contract-${emailSequence}@example.com`,
    status: "PENDING_VERIFY",
    ...overrides,
  });
}

export function describeAuthUserRepositoryContract(
  createRepository: () => Promise<AuthUserRepositoryPort>,
): void {
  describe("인증 사용자 저장소 계약", () => {
    it("만든 사용자는 id·이메일·잠금 조회로 같은 값을 읽는다", async () => {
      // Given
      const repository = await createRepository();
      const created = await createUser(repository, { emailVerifiedAt: AUTH_FIXTURE_NOW });

      // When
      const byId = await repository.findById(created.id);
      const byEmail = await repository.findByEmail(created.email);
      const locked = await repository.findByIdForUpdate(created.id);

      // Then
      expect(created.toPrimitives()).toMatchObject({
        role: "USER",
        status: "PENDING_VERIFY",
        emailVerifiedAt: AUTH_FIXTURE_NOW,
        subscriptionStatus: "FREE",
        subscriptionExpiresAt: null,
        deletedAt: null,
      });
      expect(created.userTag).toHaveLength(8);
      expect(byId?.toPrimitives()).toEqual(created.toPrimitives());
      expect(byEmail?.toPrimitives()).toEqual(created.toPrimitives());
      expect(locked?.toPrimitives()).toEqual(created.toPrimitives());
    });

    it("같은 이메일로 또 만들면 EMAIL_ALREADY_EXISTS 충돌이다", async () => {
      // Given
      const repository = await createRepository();
      const created = await createUser(repository);

      // When
      const duplicated = repository.create({ email: created.email, status: "ACTIVE" });

      // Then
      await expect(duplicated).rejects.toEqual(new AuthPersistenceConflict("EMAIL_ALREADY_EXISTS"));
    });

    it("없는 사용자는 찾지 못한다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const byId = await repository.findById(UserId.reconstitute("missing-user"));
      const byEmail = await repository.findByEmail("missing@example.com");
      const withProfile = await repository.findByIdWithProfile(UserId.reconstitute("missing-user"));

      // Then
      expect({ byId, byEmail, withProfile }).toEqual({
        byId: null,
        byEmail: null,
        withProfile: null,
      });
    });

    it("프로필을 만들고 PATCH로 바꾸면 undefined는 두고 null은 비운다", async () => {
      // Given
      const repository = await createRepository();
      const created = await createUser(repository);
      await repository.createProfile(created.id, {
        name: "아이도",
        profileImage: "https://example.com/a.png",
      });

      // When
      const renamed = await repository.updateProfile(created.id, { name: "새 이름" });
      const cleared = await repository.updateProfile(created.id, { profileImage: null });
      const found = await repository.findByIdWithProfile(created.id);

      // Then
      expect(renamed).toEqual({ name: "새 이름", profileImage: "https://example.com/a.png" });
      expect(cleared).toEqual({ name: "새 이름", profileImage: null });
      expect(found).toMatchObject({
        id: created.id.value,
        email: created.email,
        userTag: created.userTag,
        profile: { name: "새 이름", profileImage: null },
        accounts: [],
      });
    });

    it("프로필이 없으면 PATCH가 새로 만든다", async () => {
      // Given
      const repository = await createRepository();
      const created = await createUser(repository);

      // When
      const profile = await repository.updateProfile(created.id, { name: "처음" });

      // Then
      expect(profile).toEqual({ name: "처음", profileImage: null });
    });

    it("이메일 인증은 상태를 ACTIVE로 바꾸고 인증 시각을 남긴다", async () => {
      // Given
      const repository = await createRepository();
      const created = await createUser(repository);

      // When
      await repository.markEmailVerified(created.id, AUTH_FIXTURE_NOW);
      const found = await repository.findById(created.id);

      // Then
      expect(found?.toPrimitives()).toMatchObject({
        status: "ACTIVE",
        emailVerifiedAt: AUTH_FIXTURE_NOW,
      });
    });

    it("탈퇴 상태 저장은 status·deletedAt만 바꾸고 복구하면 비운다", async () => {
      // Given
      const repository = await createRepository();
      const created = await createUser(repository);
      created.requestDeletion(AUTH_FIXTURE_NOW);

      // When
      await repository.saveAccountStatus(created);
      const deleted = (await repository.findById(created.id))?.toPrimitives();
      created.restore(AUTH_FIXTURE_NOW.add({ hours: 1 }));
      await repository.saveAccountStatus(created);
      const restored = (await repository.findById(created.id))?.toPrimitives();

      // Then
      expect(deleted).toMatchObject({ status: "SUSPENDED", deletedAt: AUTH_FIXTURE_NOW });
      expect(restored).toEqual(created.toPrimitives());
    });

    it("완전 삭제 대상은 탈퇴 유예가 지난 사용자뿐이다", async () => {
      // Given
      const repository = await createRepository();
      const expired = await createUser(repository);
      const atBoundary = await createUser(repository);
      await createUser(repository);
      expired.requestDeletion(
        AUTH_FIXTURE_NOW.subtract(GRACE_PERIOD).subtract({ milliseconds: 1 }),
      );
      atBoundary.requestDeletion(AUTH_FIXTURE_NOW.subtract(GRACE_PERIOD));
      await repository.saveAccountStatus(expired);
      await repository.saveAccountStatus(atBoundary);

      // When
      const eligible = await repository.listPurgeEligible(AUTH_FIXTURE_NOW);

      // Then
      expect(eligible.map((user) => user.id.value)).toEqual([expired.id.value]);
    });

    it("완전 삭제하면 다시 찾지 못하고 없는 사용자 삭제는 실패한다", async () => {
      // Given
      const repository = await createRepository();
      const created = await createUser(repository);

      // When
      await repository.hardDelete(created.id);

      // Then
      expect(await repository.findById(created.id)).toBeNull();
      await expect(repository.hardDelete(created.id)).rejects.toThrow();
    });
  });
}
