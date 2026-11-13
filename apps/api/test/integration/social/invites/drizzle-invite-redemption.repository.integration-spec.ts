import { eq } from "drizzle-orm";

import { SummarizeMyInviteUseCase } from "#api/modules/social/invites/application/use-cases/summarize-my-invite.use-case";
import { DrizzleInviteRedemptionRepository } from "#api/modules/social/invites/infrastructure/persistence/drizzle-invite-redemption.repository";
import { DrizzleRewardGrantRepository } from "#api/modules/social/invites/infrastructure/persistence/drizzle-reward-grant.repository";
import {
  inviteActiveDay,
  inviteRedemption,
  rewardGrant,
  user as userTable,
} from "#api/platform/database/schema/index";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createEntityId } from "#api/shared/domain/model/entity-id";
import { describeInviteRedemptionRepositoryContract } from "#test/contracts/social/invite-redemption-repository.contract";
import { DateClock } from "#test/doubles/platform/date-clock";
import { createInviteRedemptionFixture } from "#test/fixtures/social/invite-redemption.fixture";
import {
  createInviteFixture,
  INVITE_FIXTURE_ID,
  INVITE_FIXTURE_INVITEE_ID,
  INVITE_FIXTURE_INVITER_ID,
  INVITE_FIXTURE_NOW,
  insertInviteFixtureRows,
} from "#test/fixtures/social/invite.fixture";
import { UserFixture } from "#test/fixtures/user.fixture";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const INVITER_ID = UserId.reconstitute(INVITE_FIXTURE_INVITER_ID);

let statements: string[] | null = null;

describe("DrizzleInviteRedemptionRepository (실제 PostgreSQL)", () => {
  const database = new TestDatabase({
    createClient: (url) =>
      createTestClient(url, { max: 4 }, (statement) => {
        statements?.push(statement);
      }),
  });
  let client: TestDatabaseClient;

  beforeAll(async () => {
    client = await database.start();
  });

  beforeEach(async () => {
    statements = null;
    await database.cleanup();
    await insertInviteFixtureRows(client);
  });

  afterAll(async () => {
    await database.stop();
  });

  function createRepositories(): {
    readonly redemptions: DrizzleInviteRedemptionRepository;
    readonly grants: DrizzleRewardGrantRepository;
    readonly unitOfWork: UnitOfWorkPort;
  } {
    const { txHost, uow } = createDatabaseTransactionFixture(client);
    return {
      redemptions: new DrizzleInviteRedemptionRepository(txHost, new DateClock()),
      grants: new DrizzleRewardGrantRepository(txHost),
      unitOfWork: uow,
    };
  }

  async function insertInvitees(count: number): Promise<string[]> {
    const ids = Array.from({ length: count }, () => createEntityId());
    await client.insert(userTable).values(
      ids.map((id, index) =>
        UserFixture.create({
          id,
          userTag: `BLK${String(index).padStart(5, "0")}`,
          email: `blk${index}@example.test`,
        }),
      ),
    );
    return ids;
  }

  describeInviteRedemptionRepositoryContract(async () => createRepositories().redemptions);

  it("활동일은 DATE 칸에 그 날짜 그대로 남고 다시 읽어도 하루 밀리지 않는다", async () => {
    // Given 서울 2/29 00:01 완료
    const { redemptions } = createRepositories();
    const redemption = createInviteRedemptionFixture({ id: (await redemptions.nextId()).value });
    await redemptions.add(redemption);
    redemption.recordActivity(Temporal.Instant.from("2028-02-28T15:01:00Z"));

    // When
    await redemptions.save(redemption);

    // Then
    const rows = await client
      .select({ localDate: inviteActiveDay.localDate })
      .from(inviteActiveDay)
      .where(eq(inviteActiveDay.redemptionId, redemption.id.value));
    expect(rows).toEqual([{ localDate: Temporal.PlainDate.from("2028-02-29") }]);
    const found = await redemptions.findByIdForUpdate(redemption.id);
    expect(found?.activeDays.map(String)).toEqual(["2028-02-29"]);
  });

  it("초대한 사람이 탈퇴해도 수락 기록은 남고 초대·초대한 사람만 비운다", async () => {
    // Given
    const { redemptions } = createRepositories();
    const redemption = createInviteRedemptionFixture({ id: (await redemptions.nextId()).value });
    await redemptions.add(redemption);

    // When
    await client.delete(userTable).where(eq(userTable.id, INVITE_FIXTURE_INVITER_ID));

    // Then
    const kept = await redemptions.findByIdForUpdate(redemption.id);
    expect(kept?.toPrimitives()).toMatchObject({
      inviteId: null,
      inviterId: null,
      inviteeId: INVITE_FIXTURE_INVITEE_ID,
      timezone: "Asia/Seoul",
      inviterRewardEligible: true,
    });
  });

  it("페이지 크기와 관계없이 SQL 한 번으로 프로필·활동일 수를 함께 읽는다", async () => {
    // Given
    const { redemptions } = createRepositories();
    const inviteeIds = await insertInvitees(5);
    for (const [index, inviteeId] of inviteeIds.entries()) {
      await redemptions.add(
        createInviteRedemptionFixture({
          id: (await redemptions.nextId()).value,
          inviteeId,
          joinedAt: INVITE_FIXTURE_NOW.add({ minutes: index }),
        }),
      );
    }

    // When
    statements = [];
    await redemptions.listInvitedFriends({
      inviterId: INVITER_ID,
      afterInviteeId: null,
      status: null,
      limit: 2,
    });
    const smallPageStatements = statements.length;
    statements = [];
    const everyone = await redemptions.listInvitedFriends({
      inviterId: INVITER_ID,
      afterInviteeId: null,
      status: null,
      limit: 5,
    });
    const fullPageStatements = statements.length;
    statements = null;

    // Then
    expect([smallPageStatements, fullPageStatements]).toEqual([1, 1]);
    expect(everyone.map((friend) => friend.userId)).toEqual([...inviteeIds].reverse());
  });

  it("마감 정비가 동시에 돌아도 SKIP LOCKED로 나눠 잡아 같은 수락을 두 번 거절하지 않는다", async () => {
    // Given
    const { redemptions, unitOfWork } = createRepositories();
    for (const inviteeId of await insertInvitees(6)) {
      await redemptions.add(
        createInviteRedemptionFixture({ id: (await redemptions.nextId()).value, inviteeId }),
      );
    }
    const at = Temporal.Instant.from("2028-03-20T00:00:00Z");

    // When
    const counts = await Promise.all(
      Array.from({ length: 3 }, () => unitOfWork.run(() => redemptions.expireJoinedBefore(at, 4))),
    );
    const rest = await unitOfWork.run(() => redemptions.expireJoinedBefore(at, 4));

    // Then
    expect(counts.reduce((sum, count) => sum + count, 0) + rest).toBe(6);
    expect(await redemptions.summarizeByInviterId(INVITER_ID)).toMatchObject({
      joinedCount: 0,
      rejectedCount: 6,
    });
  });

  it("수락이 1천 건이어도 내 초대 요약은 문장 네 개, 상태별 목록은 한 문장이다", async () => {
    // Given
    const { redemptions, grants } = createRepositories();
    const inviteeIds = await insertInvitees(1000);
    const now = Temporal.Instant.from("2028-03-10T00:00:00Z");
    const rows = inviteeIds.map((inviteeId, index) => ({
      id: createEntityId(),
      inviteId: INVITE_FIXTURE_ID,
      inviterId: INVITE_FIXTURE_INVITER_ID,
      inviteeId,
      status: index % 4 === 0 ? ("QUALIFIED" as const) : ("JOINED" as const),
      timezone: "Asia/Seoul",
      joinedAt: INVITE_FIXTURE_NOW.add({ seconds: index }),
      qualifiedAt: index % 4 === 0 ? now : null,
      expiresAt: now.add({ hours: 120 }),
      updatedAt: now,
    }));
    await client.insert(inviteRedemption).values(rows);
    await client.insert(rewardGrant).values(
      rows
        .filter((row) => row.status === "QUALIFIED")
        .map((row) => ({
          recipientId: INVITE_FIXTURE_INVITER_ID,
          sourceType: "INVITE_REDEMPTION" as const,
          sourceId: row.id,
          rewardType: "FRIEND_SLOT" as const,
          quantity: 1,
          status: "APPLIED" as const,
          appliedAt: now,
          updatedAt: now,
        })),
    );
    const summarizeMyInvite = new SummarizeMyInviteUseCase({
      inviteRedemptionRepository: redemptions,
      rewardGrantRepository: grants,
    });

    // When
    statements = [];
    const myInvite = await summarizeMyInvite.execute({ invite: createInviteFixture(), now });
    const summaryStatements = statements.length;
    statements = [];
    const waiting = await redemptions.listInvitedFriends({
      inviterId: INVITER_ID,
      afterInviteeId: null,
      status: "JOINED",
      limit: 21,
    });
    const listStatements = statements.length;
    statements = null;

    // Then
    expect([summaryStatements, listStatements]).toEqual([4, 1]);
    expect(myInvite).toMatchObject({
      waitingCount: 750,
      qualifiedCount: 250,
      rewardsEarned: [{ rewardType: "FRIEND_SLOT", quantity: 250 }],
    });
    expect(waiting).toHaveLength(21);
    expect(waiting.every((friend) => friend.status === "JOINED")).toBe(true);
  });
});
