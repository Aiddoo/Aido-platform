import type { AppReleaseRepositoryPort } from "#api/modules/app-config/app-versions/application/ports/app-release.repository.port";
import type { AppReleasePrimitives } from "#api/modules/app-config/app-versions/domain/app-release.aggregate";
import {
  APP_RELEASE_FIXTURE_NOW,
  createAppReleaseFixture,
} from "#test/fixtures/app-config/app-release.fixture";

const LATER = APP_RELEASE_FIXTURE_NOW.add({ minutes: 1 });

async function listByPlatform(
  repository: AppReleaseRepositoryPort,
): Promise<Record<string, AppReleasePrimitives>> {
  const releases = await repository.listLatestReleases();
  return Object.fromEntries(releases.map((release) => [release.platform, release.toPrimitives()]));
}

export function describeAppReleaseRepositoryContract(
  createRepository: () => Promise<AppReleaseRepositoryPort>,
): void {
  describe("앱 릴리스 저장소 계약", () => {
    it("저장한 적이 없으면 목록이 비어 있다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const releases = await repository.listLatestReleases();

      // Then
      expect(releases).toEqual([]);
    });

    it("플랫폼마다 저장한 릴리스를 모두 나열한다", async () => {
      // Given
      const repository = await createRepository();
      const ios = createAppReleaseFixture({ platform: "ios", latestVersion: "1.15.2" });
      const android = createAppReleaseFixture({
        platform: "android",
        latestVersion: "1.15.1",
        updatedAt: Temporal.Instant.from("2026-11-11T03:04:05.678Z"),
      });

      // When
      await repository.save(ios);
      await repository.save(android);

      // Then
      expect(await listByPlatform(repository)).toEqual({
        ios: ios.toPrimitives(),
        android: android.toPrimitives(),
      });
    });

    it("같은 플랫폼을 다시 저장하면 버전과 시각을 바꾸고 다른 플랫폼은 둔다", async () => {
      // Given
      const repository = await createRepository();
      const android = createAppReleaseFixture({ platform: "android", latestVersion: "1.15.1" });
      await repository.save(createAppReleaseFixture({ platform: "ios", latestVersion: "1.15.1" }));
      await repository.save(android);
      const republished = createAppReleaseFixture({
        platform: "ios",
        latestVersion: "1.15.2",
        updatedAt: LATER,
      });

      // When
      await repository.save(republished);

      // Then
      expect(await listByPlatform(repository)).toEqual({
        ios: republished.toPrimitives(),
        android: android.toPrimitives(),
      });
    });
  });
}
