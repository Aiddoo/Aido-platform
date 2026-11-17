import type { LinkedAccountsRepositoryPort } from "#api/modules/identity/linked-accounts/application/ports/linked-accounts.repository.port";
import { LinkedAccounts } from "#api/modules/identity/linked-accounts/domain/linked-accounts.aggregate";
import type { AccountProvider } from "#api/modules/identity/linked-accounts/domain/linked-accounts.constants";
import { ProviderAccountId } from "#api/modules/identity/linked-accounts/domain/provider-account-id.vo";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  AUTH_FIXTURE_NOW,
  AUTH_FIXTURE_OTHER_USER_ID,
  AUTH_FIXTURE_USER_ID,
} from "#test/fixtures/identity/session.fixture";

const OWNER = UserId.reconstitute(AUTH_FIXTURE_USER_ID);
const OTHER = UserId.reconstitute(AUTH_FIXTURE_OTHER_USER_ID);
const LATER = AUTH_FIXTURE_NOW.add({ minutes: 1 });

export function describeLinkedAccountsRepositoryContract(
  createRepository: () => Promise<LinkedAccountsRepositoryPort>,
): void {
  async function load(
    repository: LinkedAccountsRepositoryPort,
    userId: UserId,
  ): Promise<LinkedAccounts> {
    return (await repository.findByUserId(userId)) ?? LinkedAccounts.create(userId);
  }

  async function link(
    repository: LinkedAccountsRepositoryPort,
    userId: UserId,
    account: { readonly provider: AccountProvider; readonly providerAccountId: string },
  ): Promise<boolean> {
    const accounts = await load(repository, userId);
    accounts.link({ ...account, id: await repository.nextId(), now: AUTH_FIXTURE_NOW });
    return repository.save(accounts);
  }

  async function setPassword(
    repository: LinkedAccountsRepositoryPort,
    passwordHash: string,
  ): Promise<boolean> {
    const accounts = await load(repository, OWNER);
    accounts.setPassword({ id: await repository.nextId(), passwordHash, now: AUTH_FIXTURE_NOW });
    return repository.save(accounts);
  }

  async function providersOf(
    repository: LinkedAccountsRepositoryPort,
    userId: UserId,
  ): Promise<string[]> {
    const accounts = await repository.findByUserId(userId);
    return (accounts?.accounts ?? []).map((account) => account.provider);
  }

  describe("로그인 수단 저장소 계약", () => {
    it("로그인 수단이 없으면 null이다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const found = await repository.findByUserId(OWNER);

      // Then
      expect(found).toBeNull();
    });

    it("이메일 계정은 사용자 id를 공급자 계정 id로 쓰고 비밀번호 hash와 함께 다시 읽는다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const saved = await setPassword(repository, "hash-1");
      const found = await repository.findByUserId(OWNER);

      // Then
      expect(saved).toBe(true);
      expect(found?.toPrimitives()).toEqual({
        userId: AUTH_FIXTURE_USER_ID,
        accounts: [
          {
            id: expect.any(Number),
            provider: "CREDENTIAL",
            providerAccountId: AUTH_FIXTURE_USER_ID,
            passwordHash: "hash-1",
            createdAt: AUTH_FIXTURE_NOW,
            updatedAt: AUTH_FIXTURE_NOW,
          },
        ],
      });
    });

    it("소셜 계정의 연결 사용자를 공급자 계정 id로 찾는다", async () => {
      // Given
      const repository = await createRepository();
      await link(repository, OWNER, { provider: "GOOGLE", providerAccountId: "google-account" });

      // When
      const owner = await repository.findUserIdByProviderAccountId(
        "GOOGLE",
        ProviderAccountId.reconstitute("google-account"),
      );
      const nobody = await repository.findUserIdByProviderAccountId(
        "KAKAO",
        ProviderAccountId.reconstitute("google-account"),
      );

      // Then
      expect(owner?.value).toBe(AUTH_FIXTURE_USER_ID);
      expect(nobody).toBeNull();
    });

    it("다른 사용자가 먼저 연결한 공급자 계정을 연결하면 저장이 false이고 남기지 않는다", async () => {
      // Given
      const repository = await createRepository();
      await link(repository, OWNER, { provider: "GOOGLE", providerAccountId: "google-account" });

      // When
      const saved = await link(repository, OTHER, {
        provider: "GOOGLE",
        providerAccountId: "google-account",
      });

      // Then
      expect(saved).toBe(false);
      expect(await repository.findByUserId(OTHER)).toBeNull();
    });

    it("같은 사용자에게 같은 공급자를 동시에 연결하면 나중 저장이 false다", async () => {
      // Given
      const repository = await createRepository();
      const first = await load(repository, OWNER);
      const second = await load(repository, OWNER);
      first.link({
        id: await repository.nextId(),
        provider: "KAKAO",
        providerAccountId: "kakao-1",
        now: AUTH_FIXTURE_NOW,
      });
      second.link({
        id: await repository.nextId(),
        provider: "KAKAO",
        providerAccountId: "kakao-2",
        now: AUTH_FIXTURE_NOW,
      });

      // When
      const firstSaved = await repository.save(first);
      const secondSaved = await repository.save(second);

      // Then
      expect({ firstSaved, secondSaved }).toEqual({ firstSaved: true, secondSaved: false });
      expect(
        await repository.findUserIdByProviderAccountId(
          "KAKAO",
          ProviderAccountId.reconstitute("kakao-2"),
        ),
      ).toBeNull();
    });

    it("이메일 계정을 동시에 더하면 나중 저장이 false이고 먼저 저장한 hash가 남는다", async () => {
      // Given
      const repository = await createRepository();
      const first = await load(repository, OWNER);
      const second = await load(repository, OWNER);
      first.setPassword({ id: await repository.nextId(), passwordHash: "first", now: LATER });
      second.setPassword({ id: await repository.nextId(), passwordHash: "second", now: LATER });

      // When
      const firstSaved = await repository.save(first);
      const secondSaved = await repository.save(second);

      // Then
      expect({ firstSaved, secondSaved }).toEqual({ firstSaved: true, secondSaved: false });
      expect((await repository.findByUserId(OWNER))?.passwordHash).toBe("first");
    });

    it("연결 해제는 그 공급자만 지우고, 이미 지운 계정을 다시 지우면 false다", async () => {
      // Given
      const repository = await createRepository();
      await setPassword(repository, "hash-1");
      await link(repository, OWNER, { provider: "NAVER", providerAccountId: "naver-account" });
      const first = await load(repository, OWNER);
      const stale = await load(repository, OWNER);
      first.unlink("NAVER");
      stale.unlink("NAVER");

      // When
      const firstSaved = await repository.save(first);
      const staleSaved = await repository.save(stale);

      // Then
      expect({ firstSaved, staleSaved }).toEqual({ firstSaved: true, staleSaved: false });
      expect(await providersOf(repository, OWNER)).toEqual(["CREDENTIAL"]);
      expect(
        await repository.findUserIdByProviderAccountId(
          "NAVER",
          ProviderAccountId.reconstitute("naver-account"),
        ),
      ).toBeNull();
    });

    it("비밀번호는 읽은 hash가 그대로일 때만 바꿔 늦은 변경이 먼저 저장된 비밀번호를 덮지 않는다", async () => {
      // Given
      const repository = await createRepository();
      await setPassword(repository, "old-hash");
      const changed = await load(repository, OWNER);
      const slowRehash = await load(repository, OWNER);
      changed.changePassword("new-hash", LATER);
      slowRehash.changePassword("rehash-from-old", LATER);

      // When
      const changedSaved = await repository.save(changed);
      const rehashSaved = await repository.save(slowRehash);

      // Then
      expect({ changedSaved, rehashSaved }).toEqual({ changedSaved: true, rehashSaved: false });
      expect((await repository.findByUserId(OWNER))?.passwordHash).toBe("new-hash");
    });

    it("로그인 수단은 만든 순서로 읽고 다른 사용자의 계정은 섞지 않는다", async () => {
      // Given
      const repository = await createRepository();
      await setPassword(repository, "hash-1");
      await link(repository, OWNER, { provider: "APPLE", providerAccountId: "apple-account" });
      await link(repository, OTHER, { provider: "APPLE", providerAccountId: "other-apple" });

      // When
      const providers = await providersOf(repository, OWNER);

      // Then
      expect(providers).toEqual(["CREDENTIAL", "APPLE"]);
    });
  });
}
