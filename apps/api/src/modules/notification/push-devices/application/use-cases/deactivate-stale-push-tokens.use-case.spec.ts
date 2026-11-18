import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { InMemoryPushTokenRepository } from "#test/doubles/notification/in-memory-push-token.repository";
import { RecordingPushTokenCache } from "#test/doubles/notification/recording-push-token-cache";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createPushTokenFixture } from "#test/fixtures/notification/push-token.fixture";

import { PushDeviceLogEvent } from "../push-devices.log-events.js";
import { DeactivateStalePushTokensUseCase } from "./deactivate-stale-push-tokens.use-case.js";

const NOW = Temporal.Instant.from("2026-11-18T19:10:00Z");

function reportedDaysAgo(days: number, minutes = 0): Temporal.Instant {
  return NOW.subtract({ hours: days * 24, minutes });
}

describe("DeactivateStalePushTokensUseCase", () => {
  it("마지막 보고가 270일보다 오래된 활성 토큰만 끄고 그 사람의 토큰 캐시를 비운다", async () => {
    // Given
    const pushTokenRepository = new InMemoryPushTokenRepository([
      createPushTokenFixture({
        id: 1,
        userId: "user-stale",
        deviceId: "ios_old-ipad",
        token: "ExponentPushToken[old-ipad]",
        updatedAt: reportedDaysAgo(270, 1),
      }),
      createPushTokenFixture({
        id: 2,
        userId: "user-stale",
        deviceId: "ios_phone",
        token: "ExponentPushToken[phone]",
        updatedAt: reportedDaysAgo(30),
      }),
      createPushTokenFixture({
        id: 3,
        userId: "user-boundary",
        deviceId: "android_tablet",
        token: "ExponentPushToken[tablet]",
        updatedAt: reportedDaysAgo(270),
      }),
    ]);
    const cache = new RecordingPushTokenCache();
    const useCase = new DeactivateStalePushTokensUseCase({
      pushTokenRepository,
      cache,
      clock: new FixedClock(NOW),
      logger: new SilentLogger(),
    });

    // When
    const result = await useCase.execute();

    // Then
    expect(result).toEqual({ deactivatedCount: 1, completed: true });
    const activeTokens = await pushTokenRepository.findActivePushTokensByUsers(
      ["user-stale", "user-boundary"].map((userId) => UserId.reconstitute(userId)),
    );
    expect(activeTokens.map(({ token }) => token).toSorted()).toEqual([
      "ExponentPushToken[phone]",
      "ExponentPushToken[tablet]",
    ]);
    expect(cache.invalidatedPushTokenUserIds).toEqual(["user-stale"]);
  });

  it("토큰 캐시를 비우지 못해도 끈 토큰은 되돌리지 않고 경고만 남긴다", async () => {
    // Given
    const pushTokenRepository = new InMemoryPushTokenRepository([
      createPushTokenFixture({ id: 1, userId: "user-stale", updatedAt: reportedDaysAgo(400) }),
    ]);
    const cache = new RecordingPushTokenCache();
    cache.failPushTokenInvalidationFor.add("user-stale");
    const logger = new SilentLogger();
    const useCase = new DeactivateStalePushTokensUseCase({
      pushTokenRepository,
      cache,
      clock: new FixedClock(NOW),
      logger,
    });

    // When
    const result = await useCase.execute();

    // Then
    expect(result.deactivatedCount).toBe(1);
    expect(pushTokenRepository.tokenOf("user-stale", "ios_device-a")?.isActive).toBe(false);
    expect(logger.messages).toContainEqual(
      expect.objectContaining({ event: PushDeviceLogEvent.STALE_PUSH_TOKEN_CACHE_SETTLE_FAILED }),
    );
  });
});
