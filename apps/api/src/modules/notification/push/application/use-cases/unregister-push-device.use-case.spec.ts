import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { PushDeviceReportFixture } from "#test/fixtures/index";
import { InMemoryPushDeviceStore } from "#test/mocks/in-memory-push-device.store";
import { createUnitOfWorkMock } from "#test/mocks/ports/index";
import { StubPushTokenCache } from "#test/mocks/stub-push-token-cache";

import { ReportPushDeviceUseCase } from "./report-push-device.use-case.js";
import { UnregisterPushDeviceUseCase } from "./unregister-push-device.use-case.js";

async function setup() {
  const store = new InMemoryPushDeviceStore();
  const cache = new StubPushTokenCache();
  const logger = { log: () => undefined, warn: () => undefined };
  const report = new ReportPushDeviceUseCase({
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
    clock: new FixedClock(Temporal.Instant.from("2026-11-10T00:00:00.000Z")),
    logger,
  });
  for (const deviceId of ["ios_phone", "android_tablet"]) {
    await report.execute(
      PushDeviceReportFixture.command({
        userId: "user-a",
        sessionId: null,
        deviceId,
        permission: { status: "GRANTED", canAskAgain: false },
        token: `ExponentPushToken[${deviceId}]`,
        payloadVersion: 2,
      }),
    );
  }
  const useCase = new UnregisterPushDeviceUseCase({
    pushDeviceRepository: store,
    pushTokenRepository: store,
    unitOfWork: createUnitOfWorkMock(),
    cache,
    logger,
  });
  return { store, cache, useCase };
}

describe("UnregisterPushDeviceUseCase — 푸시 기기 해제", () => {
  it("deviceId가 있으면 그 기기의 기록과 토큰만 지우고 토큰 캐시를 비운다", async () => {
    // Given 기기 두 대
    const { store, cache, useCase } = await setup();

    // When
    await useCase.execute("user-a", "ios_phone");

    // Then
    expect(store.deviceOf("user-a", "ios_phone")).toBeUndefined();
    expect(store.tokenOf("user-a", "ios_phone")).toBeUndefined();
    expect(store.tokenOf("user-a", "android_tablet")).toBe("ExponentPushToken[android_tablet]");
    expect(cache.invalidationAttempts).toEqual(["user-a"]);
  });

  it("deviceId가 없으면(1.14.1 이하 앱) 모든 기기를 지운다", async () => {
    const { store, useCase } = await setup();

    await useCase.execute("user-a");

    expect(store.devices.size).toBe(0);
    expect(store.tokens.size).toBe(0);
  });

  it("등록되지 않은 기기를 해제해도 오류 없이 끝난다", async () => {
    const { useCase } = await setup();

    await expect(useCase.execute("user-a", "ios_unknown")).resolves.toBeUndefined();
  });
});
