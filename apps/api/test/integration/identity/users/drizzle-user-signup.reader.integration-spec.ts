import { DrizzleUserSignupReader } from "#api/modules/identity/users/infrastructure/persistence/drizzle-user-signup.reader";
import { linkedAccount, user, userProfile } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AccountFixture, UserFixture } from "#test/fixtures/user.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const START = Temporal.Instant.from("2026-10-07T15:00:00Z");
const END = Temporal.Instant.from("2026-10-08T15:00:00Z");
const JOINED_AT = Temporal.Instant.from("2026-10-01T03:00:00Z");

describe("DrizzleUserSignupReader — 가입 정보 조회 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let reader: DrizzleUserSignupReader;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
    const { transactionHost } = createDatabaseTransactionFixture(client);
    reader = new DrizzleUserSignupReader(transactionHost);
  });
  afterAll(async () => database?.stop());
  beforeEach(async () => {
    await database.cleanup();
    UserFixture.reset();
    AccountFixture.reset();
  });

  it("가입 방식은 나중에 연결한 수단이 아니라 처음 만든 로그인 수단이다", async () => {
    // Given
    const owner = UserFixture.create({ userTag: "MATT2025", createdAt: JOINED_AT });
    await client.insert(user).values(owner);
    await client.insert(userProfile).values({ userId: owner.id, name: "매튜" });
    await client.insert(linkedAccount).values([
      AccountFixture.create({ userId: owner.id, provider: "APPLE", createdAt: JOINED_AT }),
      AccountFixture.create({
        userId: owner.id,
        provider: "GOOGLE",
        createdAt: JOINED_AT.add({ hours: 1 }),
      }),
    ]);

    // When
    const found = await reader.findSignup(UserId.reconstitute(owner.id));

    // Then
    expect(found).toMatchObject({
      email: owner.email,
      userTag: "MATT2025",
      name: "매튜",
      signupMethod: "APPLE",
    });
    expect(found?.userId.value).toBe(owner.id);
    expect(found?.signedUpAt.equals(JOINED_AT)).toBe(true);
  });

  it("탈퇴한 사용자는 찾지 않는다", async () => {
    // Given
    const deleted = UserFixture.create({ deletedAt: END });
    await client.insert(user).values(deleted);

    // When
    const found = await reader.findSignup(UserId.reconstitute(deleted.id));

    // Then
    expect(found).toBeNull();
  });

  it("프로필·계정이 없는 사용자는 이름·가입 방식을 비운다", async () => {
    // Given
    const bare = UserFixture.create({ userTag: "BARE0001", createdAt: JOINED_AT });
    await client.insert(user).values(bare);

    // When
    const found = await reader.findSignup(UserId.reconstitute(bare.id));

    // Then
    expect(found).toMatchObject({ userTag: "BARE0001", name: null, signupMethod: null });
  });

  it("한국 날짜에 가입한 사용자를 첫 계정 공급자로 세고 경계는 시작 포함·끝 제외다", async () => {
    // Given
    const signups = [
      { provider: "CREDENTIAL", createdAt: START.subtract({ milliseconds: 1 }) },
      { provider: "CREDENTIAL", createdAt: START },
      { provider: "GOOGLE", createdAt: START.add({ milliseconds: 1 }) },
      { provider: "GOOGLE", createdAt: END },
    ] as const;
    for (const signup of signups) {
      const created = UserFixture.create({ createdAt: signup.createdAt });
      await client.insert(user).values(created);
      await client
        .insert(linkedAccount)
        .values(AccountFixture.create({ ...signup, userId: created.id }));
    }

    // When
    const counts = await reader.countSignupsByMethod({ start: START, end: END });

    // Then
    expect(
      counts.toSorted((left, right) => left.signupMethod.localeCompare(right.signupMethod)),
    ).toEqual([
      { signupMethod: "CREDENTIAL", count: 1 },
      { signupMethod: "GOOGLE", count: 1 },
    ]);
  });

  it("기존 사용자가 그날 다른 공급자를 연동해도 가입으로 세지 않는다", async () => {
    // Given
    const existing = UserFixture.create({ createdAt: START.subtract({ hours: 24 }) });
    await client.insert(user).values(existing);
    await client.insert(linkedAccount).values([
      AccountFixture.create({
        userId: existing.id,
        provider: "KAKAO",
        createdAt: existing.createdAt,
      }),
      AccountFixture.create({
        userId: existing.id,
        provider: "GOOGLE",
        createdAt: START.add({ hours: 1 }),
      }),
    ]);

    // When
    const counts = await reader.countSignupsByMethod({ start: START, end: END });
    const registered = await reader.countRegisteredUsers();

    // Then
    expect(counts).toEqual([]);
    expect(registered).toBe(1);
  });

  it("전체 사용자에서 인증 계정 없는 내부 사용자와 탈퇴한 사용자를 뺀다", async () => {
    // Given
    const active = UserFixture.create();
    const deleted = UserFixture.create({ deletedAt: START });
    await client.insert(user).values([active, deleted, UserFixture.create()]);
    await client
      .insert(linkedAccount)
      .values([
        AccountFixture.create({ userId: active.id, provider: "KAKAO" }),
        AccountFixture.create({ userId: deleted.id, provider: "GOOGLE" }),
      ]);

    // When
    const registered = await reader.countRegisteredUsers();

    // Then
    expect(registered).toBe(1);
  });
});
