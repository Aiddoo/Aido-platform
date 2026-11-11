import { DrizzleRewardClaimRepository } from "#api/modules/social/invites/infrastructure/persistence/drizzle-reward-claim.repository";
import { rewardClaim } from "#api/platform/database/schema/index";
import { describeRewardClaimRepositoryContract } from "#test/contracts/social/reward-claim-repository.contract";
import { INVITE_FIXTURE_NOW } from "#test/fixtures/social/invite.fixture";
import { createRewardClaimFixture } from "#test/fixtures/social/reward-claim.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleRewardClaimRepository (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
  });

  afterAll(async () => {
    await database.stop();
  });

  function createRepository(): DrizzleRewardClaimRepository {
    const { txHost } = createDatabaseTransactionFixture(client);
    return new DrizzleRewardClaimRepository(txHost);
  }

  describeRewardClaimRepositoryContract(async () => createRepository());

  it("처음 받은 시각을 claim 시각으로 남긴다", async () => {
    // Given
    const repository = createRepository();

    // When
    await repository.claimAll([createRewardClaimFixture()], INVITE_FIXTURE_NOW);

    // Then
    const rows = await client
      .select({ claimKind: rewardClaim.claimKind, firstClaimedAt: rewardClaim.firstClaimedAt })
      .from(rewardClaim);
    expect(rows).toEqual([{ claimKind: "INSTALLATION", firstClaimedAt: INVITE_FIXTURE_NOW }]);
  });
});
