import { ErrorCode } from "@aido/api/errors";

import { InMemoryAppReleaseRepository } from "#test/doubles/app-config/in-memory-app-release.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import {
  APP_RELEASE_FIXTURE_NOW,
  createAppReleaseFixture,
} from "#test/fixtures/app-config/app-release.fixture";

import {
  type PublishAppReleaseDependencies,
  PublishAppReleaseUseCase,
} from "./publish-app-release.use-case.js";

const NOW = APP_RELEASE_FIXTURE_NOW.add({ hours: 1 });

function createPublishAppReleaseUseCase(overrides: Partial<PublishAppReleaseDependencies> = {}) {
  return new PublishAppReleaseUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock: new RecordingMutationLock(),
    appReleaseRepository: new InMemoryAppReleaseRepository(),
    clock: new FixedClock(NOW),
    logger: new SilentLogger(),
    ...overrides,
  });
}

describe("PublishAppReleaseUseCase — 스토어 공개 버전 반영", () => {
  it("그 플랫폼의 버전과 반영 시각을 바꾸고 다른 플랫폼은 둔다", async () => {
    // Given
    const android = createAppReleaseFixture({ platform: "android", latestVersion: "1.15.0" });
    const appReleaseRepository = new InMemoryAppReleaseRepository([
      createAppReleaseFixture({ platform: "ios", latestVersion: "1.15.0" }),
      android,
    ]);
    const useCase = createPublishAppReleaseUseCase({ appReleaseRepository });

    // When
    const published = await useCase.execute({ platform: "ios", latestVersion: "1.15.2" });

    // Then
    const expected = { platform: "ios", latestVersion: "1.15.2", updatedAt: NOW };
    expect(published.toPrimitives()).toEqual(expected);
    expect(
      (await appReleaseRepository.listLatestReleases()).map((release) => release.toPrimitives()),
    ).toEqual(expect.arrayContaining([expected, android.toPrimitives()]));
  });

  it.each(["1.15", "1.15.2-rc.1", "v1.15.2", "", `1.15.${"9".repeat(40)}`])(
    "스토어 버전 모양이 아닌 값(%j)은 SYS_0002로 거절하고 저장하지 않는다",
    async (latestVersion) => {
      // Given
      const appReleaseRepository = new InMemoryAppReleaseRepository();
      const useCase = createPublishAppReleaseUseCase({ appReleaseRepository });

      // When
      const result = useCase.execute({ platform: "ios", latestVersion });

      // Then
      await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
      expect(await appReleaseRepository.listLatestReleases()).toEqual([]);
    },
  );
});
