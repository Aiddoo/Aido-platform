import { InMemoryPushDeviceRepository } from "#test/doubles/notification/in-memory-push-device.repository";
import { InMemoryPushTokenRepository } from "#test/doubles/notification/in-memory-push-token.repository";
import { PassThroughNotificationCache } from "#test/doubles/notification/pass-through-notification-cache";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createPushDeviceFixture } from "#test/fixtures/notification/push-device.fixture";
import { createPushTokenFixture } from "#test/fixtures/notification/push-token.fixture";

import { UnregisterPushDeviceUseCase } from "./unregister-push-device.use-case.js";

const DEVICE_IDS = ["ios_phone", "android_tablet"] as const;

// user-a가 두 기기를 쓰고 있다
function setup() {
  const devices = new InMemoryPushDeviceRepository(
    DEVICE_IDS.map((deviceId) =>
      createPushDeviceFixture({
        userId: "user-a",
        deviceId,
        platform: deviceId === "ios_phone" ? "IOS" : "ANDROID",
      }),
    ),
  );
  const tokens = new InMemoryPushTokenRepository(
    DEVICE_IDS.map((deviceId, index) =>
      createPushTokenFixture({
        id: index + 1,
        userId: "user-a",
        deviceId,
        token: `ExponentPushToken[${deviceId}]`,
      }),
    ),
  );
  const cache = new PassThroughNotificationCache();
  const useCase = new UnregisterPushDeviceUseCase({
    pushDeviceRepository: devices,
    pushTokenRepository: tokens,
    unitOfWork: new ImmediateUnitOfWork(),
    cache,
    logger: new SilentLogger(),
  });
  return { devices, tokens, cache, useCase };
}

describe("UnregisterPushDeviceUseCase — 푸시 기기 해제", () => {
  it("deviceId가 있으면 그 기기의 기록과 토큰만 지우고 토큰 캐시를 비운다", async () => {
    // Given 기기 두 대
    const { devices, tokens, cache, useCase } = setup();

    // When
    await useCase.execute("user-a", "ios_phone");

    // Then
    expect(devices.deviceOf("user-a", "ios_phone")).toBeUndefined();
    expect(tokens.tokenOf("user-a", "ios_phone")).toBeUndefined();
    expect(devices.deviceOf("user-a", "android_tablet")).toBeDefined();
    expect(tokens.tokenOf("user-a", "android_tablet")?.token).toBe(
      "ExponentPushToken[android_tablet]",
    );
    expect(cache.invalidatedPushTokenUserIds).toEqual(["user-a"]);
  });

  it("deviceId가 없으면(1.14.1 이하 앱) 모든 기기를 지운다", async () => {
    // Given
    const { devices, tokens, useCase } = setup();

    // When
    await useCase.execute("user-a");

    // Then
    expect(devices.size).toBe(0);
    expect(tokens.size).toBe(0);
  });

  it("등록되지 않은 기기를 해제해도 오류 없이 끝나고 다른 기기는 남긴다", async () => {
    // Given
    const { tokens, useCase } = setup();

    // When
    const result = useCase.execute("user-a", "ios_unknown");

    // Then
    await expect(result).resolves.toBeUndefined();
    expect(tokens.size).toBe(2);
  });
});
