import { PushDeviceReportFixture } from "#test/fixtures/index";
import { InMemoryPushDeviceStore } from "#test/mocks/in-memory-push-device.store";
import { createUnitOfWorkMock } from "#test/mocks/ports/index";
import { StubPushTokenCache } from "#test/mocks/stub-push-token-cache";

import { ReleaseSessionPushDevices } from "./release-session-push-devices.use-case.js";
import { ReportPushDevice } from "./report-push-device.use-case.js";

async function setup() {
  const store = new InMemoryPushDeviceStore();
  const cache = new StubPushTokenCache();
  const logger = { log: () => undefined, warn: () => undefined };
  const report = new ReportPushDevice({
    pushDeviceRepository: store,
    pushTokenRepository: store,
    unitOfWork: createUnitOfWorkMock(),
    pushProvider: { validateToken: () => true },
    userSettings: {
      upsertPushLocale: async () => undefined,
      upsertPushTimezone: async () => undefined,
    },
    cache: {
      invalidatePushTokens: async () => undefined,
      invalidateUserPreference: async () => undefined,
    },
    logger,
  });
  const devices = [
    { userId: "user-a", sessionId: "session-phone", deviceId: "ios_phone" },
    { userId: "user-a", sessionId: "session-tablet", deviceId: "android_tablet" },
    { userId: "user-b", sessionId: null, deviceId: "ios_legacy" },
  ];
  for (const device of devices) {
    await report.execute(
      PushDeviceReportFixture.command({
        ...device,
        permission: { status: "GRANTED", canAskAgain: false },
        token: `ExponentPushToken[${device.deviceId}]`,
        payloadVersion: 2,
      }),
    );
  }
  const useCase = new ReleaseSessionPushDevices({
    pushDeviceRepository: store,
    pushTokenRepository: store,
    unitOfWork: createUnitOfWorkMock(),
    cache,
    logger,
  });
  return { store, cache, useCase };
}

describe("ReleaseSessionPushDevices — 폐기된 세션의 푸시 기기 해제", () => {
  it("폐기된 세션의 기기와 토큰만 지우고 그 사용자의 토큰 캐시를 비운다", async () => {
    // Given 기기 두 대를 쓰는 user-a
    const { store, cache, useCase } = await setup();

    // When 휴대폰 세션만 폐기됐다
    await useCase.releaseSessions(["session-phone"]);

    // Then
    expect(store.tokenOf("user-a", "ios_phone")).toBeUndefined();
    expect(store.deviceOf("user-a", "ios_phone")).toBeUndefined();
    expect(store.tokenOf("user-a", "android_tablet")).toBe("ExponentPushToken[android_tablet]");
    expect(store.tokenOf("user-b", "ios_legacy")).toBe("ExponentPushToken[ios_legacy]");
    expect(cache.invalidationAttempts).toEqual(["user-a"]);
  });

  it("세션 목록이 비면 아무것도 하지 않는다", async () => {
    const { store, cache, useCase } = await setup();

    await useCase.releaseSessions([]);

    expect(store.tokens.size).toBe(3);
    expect(cache.invalidationAttempts).toEqual([]);
  });
});
