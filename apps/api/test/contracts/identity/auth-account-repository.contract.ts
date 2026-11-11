import { ErrorCode } from "@aido/api/errors";

import { AuthPersistenceConflict } from "#api/modules/identity/auth/application/auth.errors";
import type { AuthAccountRepositoryPort } from "#api/modules/identity/auth/application/ports/auth-account.repository.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  AUTH_FIXTURE_OTHER_USER_ID,
  AUTH_FIXTURE_USER_ID,
} from "#test/fixtures/identity/auth-session.fixture";

export function describeAuthAccountRepositoryContract(
  createRepository: () => Promise<AuthAccountRepositoryPort>,
): void {
  describe("로그인 계정 저장소 계약", () => {
    it("이메일 계정은 사용자 id를 공급자 계정 id로 쓰고 비밀번호 hash를 둔다", async () => {
      // Given
      const repository = await createRepository();

      // When
      await repository.createCredentialAccount(UserId.reconstitute(AUTH_FIXTURE_USER_ID), "hash-1");
      const found = await repository.findByUserIdAndProvider(
        UserId.reconstitute(AUTH_FIXTURE_USER_ID),
        "CREDENTIAL",
      );

      // Then
      expect(found).toMatchObject({
        userId: AUTH_FIXTURE_USER_ID,
        provider: "CREDENTIAL",
        providerAccountId: AUTH_FIXTURE_USER_ID,
        password: "hash-1",
      });
      expect(found?.createdAt).toBeInstanceOf(Temporal.Instant);
    });

    it("같은 사용자의 이메일 계정을 또 만들면 USER_0604로 거절한다", async () => {
      // Given
      const repository = await createRepository();
      await repository.createCredentialAccount(UserId.reconstitute(AUTH_FIXTURE_USER_ID), "hash-1");

      // When
      const duplicated = repository.createCredentialAccount(
        UserId.reconstitute(AUTH_FIXTURE_USER_ID),
        "hash-2",
      );

      // Then
      await expect(duplicated).rejects.toMatchObject({ errorCode: ErrorCode.USER_0604 });
    });

    it("소셜 계정은 공급자 계정 id로 찾고 다른 사용자가 같은 계정을 연결하면 충돌이다", async () => {
      // Given
      const repository = await createRepository();
      await repository.createOAuthAccount({
        userId: UserId.reconstitute(AUTH_FIXTURE_USER_ID),
        provider: "GOOGLE",
        providerAccountId: "google-account",
        refreshToken: "provider-refresh",
      });

      // When
      const found = await repository.findByProviderAccountId("GOOGLE", "google-account");
      const duplicated = repository.createOAuthAccount({
        userId: UserId.reconstitute(AUTH_FIXTURE_OTHER_USER_ID),
        provider: "GOOGLE",
        providerAccountId: "google-account",
      });

      // Then
      expect(found).toMatchObject({ userId: AUTH_FIXTURE_USER_ID, password: null });
      await expect(duplicated).rejects.toEqual(
        new AuthPersistenceConflict("OAUTH_ACCOUNT_ALREADY_LINKED"),
      );
    });

    it("한 사용자의 같은 공급자를 두 번 연결하면 충돌이다", async () => {
      // Given
      const repository = await createRepository();
      await repository.createOAuthAccount({
        userId: UserId.reconstitute(AUTH_FIXTURE_USER_ID),
        provider: "KAKAO",
        providerAccountId: "kakao-1",
      });

      // When
      const duplicated = repository.createOAuthAccount({
        userId: UserId.reconstitute(AUTH_FIXTURE_USER_ID),
        provider: "KAKAO",
        providerAccountId: "kakao-2",
      });

      // Then
      await expect(duplicated).rejects.toBeInstanceOf(AuthPersistenceConflict);
    });

    it("사용자의 계정 목록은 만든 순서이고 로그인 수단 묶음과 같다", async () => {
      // Given
      const repository = await createRepository();
      await repository.createCredentialAccount(UserId.reconstitute(AUTH_FIXTURE_USER_ID), "hash-1");
      await repository.createOAuthAccount({
        userId: UserId.reconstitute(AUTH_FIXTURE_USER_ID),
        provider: "APPLE",
        providerAccountId: "apple-account",
      });
      await repository.createOAuthAccount({
        userId: UserId.reconstitute(AUTH_FIXTURE_OTHER_USER_ID),
        provider: "APPLE",
        providerAccountId: "other-apple",
      });

      // When
      const accounts = await repository.findAllByUserId(UserId.reconstitute(AUTH_FIXTURE_USER_ID));
      const identity = await repository.findIdentityAccounts(
        UserId.reconstitute(AUTH_FIXTURE_USER_ID),
      );

      // Then
      expect(accounts.map((account) => account.provider)).toEqual(["CREDENTIAL", "APPLE"]);
      expect(identity.toPrimitives()).toEqual({
        userId: AUTH_FIXTURE_USER_ID,
        accounts: accounts.map(({ id, provider, providerAccountId, createdAt }) => ({
          id,
          provider,
          providerAccountId,
          createdAt,
        })),
      });
    });

    it("비밀번호는 바꾸고, 기대한 hash일 때만 다시 바꾼다", async () => {
      // Given
      const repository = await createRepository();
      await repository.createCredentialAccount(
        UserId.reconstitute(AUTH_FIXTURE_USER_ID),
        "old-hash",
      );
      await repository.updatePassword(UserId.reconstitute(AUTH_FIXTURE_USER_ID), "new-hash");

      // When
      const stale = await repository.updatePasswordIfUnchanged(
        UserId.reconstitute(AUTH_FIXTURE_USER_ID),
        "old-hash",
        "rehash-from-old",
      );
      const current = await repository.updatePasswordIfUnchanged(
        UserId.reconstitute(AUTH_FIXTURE_USER_ID),
        "new-hash",
        "rehash-from-new",
      );
      const found = await repository.findByUserIdAndProvider(
        UserId.reconstitute(AUTH_FIXTURE_USER_ID),
        "CREDENTIAL",
      );

      // Then
      expect({ stale, current, password: found?.password }).toEqual({
        stale: false,
        current: true,
        password: "rehash-from-new",
      });
    });

    it("계정 삭제는 그 공급자만 지운다", async () => {
      // Given
      const repository = await createRepository();
      await repository.createCredentialAccount(UserId.reconstitute(AUTH_FIXTURE_USER_ID), "hash-1");
      await repository.createOAuthAccount({
        userId: UserId.reconstitute(AUTH_FIXTURE_USER_ID),
        provider: "NAVER",
        providerAccountId: "naver-account",
      });

      // When
      await repository.deleteAccount(UserId.reconstitute(AUTH_FIXTURE_USER_ID), "NAVER");

      // Then
      expect(
        (await repository.findAllByUserId(UserId.reconstitute(AUTH_FIXTURE_USER_ID))).map(
          (account) => account.provider,
        ),
      ).toEqual(["CREDENTIAL"]);
      expect(await repository.findByProviderAccountId("NAVER", "naver-account")).toBeNull();
    });
  });
}
