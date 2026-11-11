import { InMemoryPushDeviceRepository } from "#test/doubles/notification/in-memory-push-device.repository";
import { InMemoryPushTokenRepository } from "#test/doubles/notification/in-memory-push-token.repository";
import { PassThroughNotificationCache } from "#test/doubles/notification/pass-through-notification-cache";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createPushDeviceFixture } from "#test/fixtures/notification/push-device.fixture";
import { createPushTokenFixture } from "#test/fixtures/notification/push-token.fixture";

import { ReleaseSessionPushDevicesUseCase } from "./release-session-push-devices.use-case.js";

const INSTALLATIONS = [
  { userId: "user-a", sessionId: "session-phone", deviceId: "ios_phone" },
  { userId: "user-a", sessionId: "session-tablet", deviceId: "android_tablet" },
  { userId: "user-b", sessionId: null, deviceId: "ios_legacy" },
] as const;

function setup() {
  const devices = new InMemoryPushDeviceRepository(
    INSTALLATIONS.map((installation) => createPushDeviceFixture(installation)),
  );
  const tokens = new InMemoryPushTokenRepository(
    INSTALLATIONS.map((installation, index) => ({
      ...createPushTokenFixture({
        id: index + 1,
        userId: installation.userId,
        deviceId: installation.deviceId,
        token: `ExponentPushToken[${installation.deviceId}]`,
      }),
      sessionId: installation.sessionId,
    })),
  );
  const cache = new PassThroughNotificationCache();
  const useCase = new ReleaseSessionPushDevicesUseCase({
    pushDeviceRepository: devices,
    pushTokenRepository: tokens,
    unitOfWork: new ImmediateUnitOfWork(),
    cache,
    logger: new SilentLogger(),
  });
  return { devices, tokens, cache, useCase };
}

describe("ReleaseSessionPushDevicesUseCase — 폐기된 세션의 푸시 기기 해제", () => {
  it("폐기된 세션의 기기와 토큰만 지우고 그 사용자의 토큰 캐시를 비운다", async () => {
    // Given 기기 두 대를 쓰는 user-a
    const { devices, tokens, cache, useCase } = setup();

    // When 휴대폰 세션만 폐기됐다
    await useCase.releaseSessions(["session-phone"]);

    // Then
    expect(tokens.tokenOf("user-a", "ios_phone")).toBeUndefined();
    expect(devices.deviceOf("user-a", "ios_phone")).toBeUndefined();
    expect(tokens.tokenOf("user-a", "android_tablet")?.token).toBe(
      "ExponentPushToken[android_tablet]",
    );
    expect(tokens.tokenOf("user-b", "ios_legacy")?.token).toBe("ExponentPushToken[ios_legacy]");
    expect(cache.invalidatedPushTokenUserIds).toEqual(["user-a"]);
  });

  it("세션 목록이 비면 아무것도 하지 않는다", async () => {
    // Given
    const { tokens, devices, cache, useCase } = setup();

    // When
    await useCase.releaseSessions([]);

    // Then
    expect(tokens.size).toBe(3);
    expect(devices.size).toBe(3);
    expect(cache.invalidatedPushTokenUserIds).toEqual([]);
  });
});
