import type { UserBriefReadModel } from "#api/modules/identity/users/identity-users.public";
import { DrizzleUserBriefReader } from "#api/modules/identity/users/infrastructure/persistence/drizzle-user-brief.reader";
import { DrizzleCheerReader } from "#api/modules/social/cheers/infrastructure/persistence/drizzle-cheer.reader";
import { DrizzleCheerRepository } from "#api/modules/social/cheers/infrastructure/persistence/drizzle-cheer.repository";
import { user, userBlock, userProfile } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { describeCheerRepositoryContract } from "#test/contracts/social/cheer-repository.contract";
import { createUserRowFixture } from "#test/fixtures/identity/user-row.fixture";
import {
  CHEER_FIXTURE_OTHER_USER_ID,
  CHEER_FIXTURE_RECEIVER_ID,
  CHEER_FIXTURE_NOW,
  CHEER_FIXTURE_SENDER_ID,
  createCheerFixture,
} from "#test/fixtures/social/cheer.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const RECEIVER_ID = UserId.reconstitute(CHEER_FIXTURE_RECEIVER_ID);
const SENDER_ID = UserId.reconstitute(CHEER_FIXTURE_SENDER_ID);

// 응원 행을 읽은 뒤 사용자 요약을 읽기 전에 그 사람이 지워진 경합을 흉내 낸다
class UserBriefReaderWithout extends DrizzleUserBriefReader {
  readonly #missingUserId: string;

  constructor(
    transactionHost: ConstructorParameters<typeof DrizzleUserBriefReader>[0],
    missingUserId: string,
  ) {
    super(transactionHost);
    this.#missingUserId = missingUserId;
  }

  override async listByUserIds(userIds: readonly UserId[]): Promise<UserBriefReadModel[]> {
    const briefs = await super.listByUserIds(userIds);
    return briefs.filter((brief) => brief.userId.value !== this.#missingUserId);
  }
}

describe("DrizzleCheerRepository (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    await client
      .insert(user)
      .values([
        createUserRowFixture({ id: CHEER_FIXTURE_SENDER_ID, userTag: "SENDER01" }),
        createUserRowFixture({ id: CHEER_FIXTURE_RECEIVER_ID, userTag: "RECEIVE1" }),
        createUserRowFixture({ id: CHEER_FIXTURE_OTHER_USER_ID, userTag: "OTHER001" }),
      ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  function createRepository(): DrizzleCheerRepository {
    const { transactionHost } = createDatabaseTransactionFixture(client);
    return new DrizzleCheerRepository(transactionHost);
  }

  function createReader(): DrizzleCheerReader {
    const { transactionHost } = createDatabaseTransactionFixture(client);
    return new DrizzleCheerReader(transactionHost, new DrizzleUserBriefReader(transactionHost));
  }

  describeCheerRepositoryContract(async () => ({
    repository: createRepository(),
    reader: createReader(),
  }));

  it("목록의 사용자 요약은 프로필 이름·이미지를 싣고 프로필이 없으면 null이다", async () => {
    // Given
    const repository = createRepository();
    await client
      .insert(userProfile)
      .values({ userId: CHEER_FIXTURE_SENDER_ID, name: "보낸이", profileImage: "avatar-1" });
    await repository.save(createCheerFixture({ id: (await repository.nextId()).value }));

    // When
    const {
      items: [item],
    } = await createReader().listReceived({
      userId: RECEIVER_ID,
      afterCheerId: null,
      size: 1,
    });

    // Then
    expect(item?.sender).toEqual({
      id: CHEER_FIXTURE_SENDER_ID,
      userTag: "SENDER01",
      name: "보낸이",
      profileImage: "avatar-1",
    });
    expect(item?.receiver).toEqual({
      id: CHEER_FIXTURE_RECEIVER_ID,
      userTag: "RECEIVE1",
      name: null,
      profileImage: null,
    });
  });

  it("어느 쪽이든 차단한 상대와 주고받은 응원은 목록과 개수에서 빠진다", async () => {
    // Given
    const repository = createRepository();
    await repository.save(createCheerFixture({ id: (await repository.nextId()).value }));
    await repository.save(
      createCheerFixture({
        id: (await repository.nextId()).value,
        senderId: CHEER_FIXTURE_OTHER_USER_ID,
      }),
    );
    await client
      .insert(userBlock)
      .values({ blockerId: CHEER_FIXTURE_SENDER_ID, blockedId: CHEER_FIXTURE_RECEIVER_ID });

    // When
    const received = await createReader().listReceived({
      userId: RECEIVER_ID,
      afterCheerId: null,
      size: 5,
    });
    const sent = await createReader().listSent({ userId: SENDER_ID, afterCheerId: null, size: 5 });
    const counts = {
      received: await createReader().countReceived(RECEIVER_ID),
      unread: await createReader().countUnreadReceived(RECEIVER_ID),
      sent: await createReader().countSent(SENDER_ID),
    };

    // Then
    expect(received.items.map((cheer) => cheer.senderId)).toEqual([CHEER_FIXTURE_OTHER_USER_ID]);
    expect(sent.items).toEqual([]);
    expect(counts).toEqual({ received: 1, unread: 1, sent: 0 });
  });

  it("쪽 가운데 응원의 보낸 사람이 사라져도 다음 쪽 여부와 커서는 읽은 원래 행으로 정한다", async () => {
    // Given
    const repository = createRepository();
    const oldest = createCheerFixture({ id: (await repository.nextId()).value });
    const middle = createCheerFixture({
      id: (await repository.nextId()).value,
      senderId: CHEER_FIXTURE_OTHER_USER_ID,
      createdAt: CHEER_FIXTURE_NOW.add({ minutes: 1 }),
    });
    const newest = createCheerFixture({
      id: (await repository.nextId()).value,
      createdAt: CHEER_FIXTURE_NOW.add({ minutes: 2 }),
    });
    for (const cheer of [oldest, middle, newest]) {
      await repository.save(cheer);
    }
    const { transactionHost } = createDatabaseTransactionFixture(client);
    const reader = new DrizzleCheerReader(
      transactionHost,
      new UserBriefReaderWithout(transactionHost, CHEER_FIXTURE_OTHER_USER_ID),
    );

    // When
    const firstPage = await reader.listReceived({
      userId: RECEIVER_ID,
      afterCheerId: null,
      size: 2,
    });
    const nextPage = await reader.listReceived({
      userId: RECEIVER_ID,
      afterCheerId: middle.id,
      size: 2,
    });

    // Then
    expect(firstPage.items.map((cheer) => cheer.id)).toEqual([newest.id.value]);
    expect(firstPage.pagination).toEqual({ nextCursor: middle.id.value, hasNext: true, size: 2 });
    expect(nextPage.items.map((cheer) => cheer.id)).toEqual([oldest.id.value]);
    expect(nextPage.pagination.hasNext).toBe(false);
  });

  it("시각은 ms 3자리 UTC로 저장하고 같은 Instant로 읽는다", async () => {
    // Given
    const repository = createRepository();
    const createdAt = Temporal.Instant.from("2027-01-08T12:00:00.123Z");
    const cheer = createCheerFixture({
      id: (await repository.nextId()).value,
      createdAt,
      readAt: createdAt.add({ seconds: 5 }),
    });

    // When
    await repository.save(cheer);
    const found = await repository.findById(cheer.id);

    // Then
    expect(found?.toPrimitives()).toEqual(cheer.toPrimitives());
  });
});
