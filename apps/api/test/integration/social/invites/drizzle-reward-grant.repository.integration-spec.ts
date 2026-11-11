import { DrizzleInviteRedemptionRepository } from "#api/modules/social/invites/infrastructure/persistence/drizzle-invite-redemption.repository";
import { DrizzleRewardGrantRepository } from "#api/modules/social/invites/infrastructure/persistence/drizzle-reward-grant.repository";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { describeRewardGrantRepositoryContract } from "#test/contracts/social/reward-grant-repository.contract";
import { DateClock } from "#test/doubles/platform/date-clock";
import { createInviteRedemptionFixture } from "#test/fixtures/social/invite-redemption.fixture";
import {
  INVITE_FIXTURE_INVITER_ID,
  INVITE_FIXTURE_NOW,
  INVITE_FIXTURE_OTHER_INVITER_ID,
  insertInviteFixtureRows,
} from "#test/fixtures/social/invite.fixture";
import { createRewardGrantFixture } from "#test/fixtures/social/reward-grant.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleRewardGrantRepository (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    await insertInviteFixtureRows(client);
  });

  afterAll(async () => {
    await database.stop();
  });

  function createRepositories() {
    const { txHost } = createDatabaseTransactionFixture(client);
    return {
      grants: new DrizzleRewardGrantRepository(txHost),
      redemptions: new DrizzleInviteRedemptionRepository(txHost, new DateClock()),
    };
  }

  describeRewardGrantRepositoryContract(async () => createRepositories().grants);

  it("초대한 사람이 자기가 초대받아 받은 보상은 초대한 사람 보상 합계에서 뺀다", async () => {
    // Given 초대한 사람 자신도 다른 사람의 초대를 수락했다
    const { grants, redemptions } = createRepositories();
    const ownRedemption = createInviteRedemptionFixture({
      id: (await redemptions.nextId()).value,
      inviterId: INVITE_FIXTURE_OTHER_INVITER_ID,
      inviteeId: INVITE_FIXTURE_INVITER_ID,
    });
    await redemptions.add(ownRedemption);
    await grants.addAll([
      createRewardGrantFixture({
        id: (await grants.nextId()).value,
        sourceId: ownRedemption.id.value,
      }),
      createRewardGrantFixture({
        id: (await grants.nextId()).value,
        sourceId: "c0000000000000000000rdm0a",
        quantity: 3,
      }),
    ]);

    // When
    const totals = await grants.summarizeInviterRewards(
      UserId.reconstitute(INVITE_FIXTURE_INVITER_ID),
      INVITE_FIXTURE_NOW.subtract({ hours: 1 }),
    );

    // Then
    expect(totals).toEqual([
      { rewardType: "PREMIUM_DAYS", quantityInWindow: 3, totalQuantity: 3, appliedQuantity: 0 },
    ]);
  });
});
