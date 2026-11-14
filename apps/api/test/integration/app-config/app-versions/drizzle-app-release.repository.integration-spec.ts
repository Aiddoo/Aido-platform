import type { AppConfigAppVersionsConfig } from "#api/modules/app-config/app-versions/app-config-app-versions.config";
import { DrizzleAppReleaseRepository } from "#api/modules/app-config/app-versions/infrastructure/persistence/drizzle-app-release.repository";
import { describeAppReleaseRepositoryContract } from "#test/contracts/app-config/app-release-repository.contract";
import { createAppReleaseFixture } from "#test/fixtures/app-config/app-release.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const ENVIRONMENT_CHECK_OFF: AppConfigAppVersionsConfig = {
  enabled: false,
  iosLatestVersion: undefined,
  androidLatestVersion: undefined,
};

describe("DrizzleAppReleaseRepository (실제 PostgreSQL)", () => {
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

  function createRepository(
    config: AppConfigAppVersionsConfig = ENVIRONMENT_CHECK_OFF,
  ): DrizzleAppReleaseRepository {
    const { txHost } = createDatabaseTransactionFixture(client);
    return new DrizzleAppReleaseRepository(txHost, config);
  }

  describeAppReleaseRepositoryContract(async () => createRepository());

  it("행이 없는 플랫폼만 env 값으로 채워 나열한다", async () => {
    // Given
    const repository = createRepository({
      enabled: true,
      iosLatestVersion: "1.15.0",
      androidLatestVersion: "1.15.0",
    });
    await repository.save(createAppReleaseFixture({ platform: "ios", latestVersion: "1.15.2" }));

    // When
    const releases = await repository.listLatestReleases();

    // Then
    expect(
      Object.fromEntries(
        releases.map((release) => [release.platform, release.latestVersion.value]),
      ),
    ).toEqual({ ios: "1.15.2", android: "1.15.0" });
  });
});
