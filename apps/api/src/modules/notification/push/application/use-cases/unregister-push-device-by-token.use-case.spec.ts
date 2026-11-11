import { InMemoryPushDeviceRepository } from "#test/doubles/notification/in-memory-push-device.repository";
import { InMemoryPushTokenRepository } from "#test/doubles/notification/in-memory-push-token.repository";
import { PassThroughNotificationCache } from "#test/doubles/notification/pass-through-notification-cache";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createPushDeviceFixture } from "#test/fixtures/notification/push-device.fixture";
import { createPushTokenFixture } from "#test/fixtures/notification/push-token.fixture";

import { NotificationDeliveryLogEvent } from "../notification-delivery.log-events.js";
import { UnregisterPushDeviceByTokenUseCase } from "./unregister-push-device-by-token.use-case.js";

const PHONE_TOKEN = "ExponentPushToken[phone]";
const TABLET_TOKEN = "ExponentPushToken[tablet]";

// user-a가 휴대폰과 태블릿 두 기기를 쓰고 있다
function setup() {
  const devices = new InMemoryPushDeviceRepository([
    createPushDeviceFixture({ userId: "user-a", deviceId: "ios_phone" }),
    createPushDeviceFixture({ userId: "user-a", deviceId: "android_tablet", platform: "ANDROID" }),
  ]);
  const tokens = new InMemoryPushTokenRepository([
    createPushTokenFixture({ id: 1, userId: "user-a", deviceId: "ios_phone", token: PHONE_TOKEN }),
    createPushTokenFixture({
      id: 2,
      userId: "user-a",
      deviceId: "android_tablet",
      platform: "ANDROID",
      token: TABLET_TOKEN,
    }),
  ]);
  const cache = new PassThroughNotificationCache();
  const logger = new SilentLogger();
  const useCase = new UnregisterPushDeviceByTokenUseCase({
    pushDeviceRepository: devices,
    pushTokenRepository: tokens,
    unitOfWork: new ImmediateUnitOfWork(),
    cache,
    logger,
  });
  return { devices, tokens, cache, logger, useCase };
}

describe("UnregisterPushDeviceByTokenUseCase — 세션이 끝난 기기의 푸시 해제", () => {
  it("기기 ID와 토큰이 모두 맞으면 그 기기의 토큰·권한 기록만 지우고 주인의 토큰 캐시를 비운다", async () => {
    // Given
    const { devices, tokens, cache, logger, useCase } = setup();

    // When
    await useCase.execute({ deviceId: "ios_phone", token: PHONE_TOKEN });

    // Then
    expect(tokens.tokenOf("user-a", "ios_phone")).toBeUndefined();
    expect(devices.deviceOf("user-a", "ios_phone")).toBeUndefined();
    expect(tokens.tokenOf("user-a", "android_tablet")?.token).toBe(TABLET_TOKEN);
    expect(devices.deviceOf("user-a", "android_tablet")).toBeDefined();
    expect(cache.invalidatedPushTokenUserIds).toEqual(["user-a"]);
    expect(logger.messages).toContainEqual({
      event: NotificationDeliveryLogEvent.PUSH_DEVICE_UNREGISTERED_BY_TOKEN,
      userIds: ["user-a"],
      tokenCount: 1,
    });
    expect(JSON.stringify(logger.messages)).not.toContain(PHONE_TOKEN);
  });

  it.each([
    ["다른 기기의 토큰", "ios_phone", TABLET_TOKEN],
    ["모르는 기기", "ios_unknown", PHONE_TOKEN],
    ["모르는 토큰", "ios_phone", "ExponentPushToken[unknown]"],
  ])("%s로 오면 아무것도 지우지 않는다", async (_case, deviceId, token) => {
    // Given
    const { devices, tokens, cache, useCase } = setup();

    // When
    await useCase.execute({ deviceId, token });

    // Then
    expect(tokens.size).toBe(2);
    expect(devices.size).toBe(2);
    expect(cache.invalidatedPushTokenUserIds).toEqual([]);
  });

  it("같은 요청을 다시 보내도 결과가 같다", async () => {
    // Given
    const { tokens, useCase } = setup();
    await useCase.execute({ deviceId: "ios_phone", token: PHONE_TOKEN });

    // When
    const repeated = useCase.execute({ deviceId: "ios_phone", token: PHONE_TOKEN });

    // Then
    await expect(repeated).resolves.toBeUndefined();
    expect(tokens.size).toBe(1);
  });
});
