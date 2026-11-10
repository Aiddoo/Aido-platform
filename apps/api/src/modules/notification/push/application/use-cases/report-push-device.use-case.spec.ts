import { ErrorCode } from "@aido/api/errors";

import type {
  ApplicationLoggerPort,
  ApplicationLogMessage,
} from "#api/shared/application/ports/application-logger.port";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { PushDeviceReportFixture } from "#test/fixtures/index";
import { InMemoryPushDeviceStore } from "#test/mocks/in-memory-push-device.store";
import { createUnitOfWorkMock } from "#test/mocks/ports/index";

import type { NotificationCachePort } from "../../../inbox/application/ports/notification-cache.port.js";
import type { UserNotificationSettingsPort } from "../ports/user-notification-settings.port.js";
import {
  type ReportPushDeviceCommand,
  ReportPushDeviceUseCase,
} from "./report-push-device.use-case.js";

const VALID_TOKEN = "ExponentPushToken[device-a]";
const NOW = Temporal.Instant.from("2026-11-10T03:00:00.000Z");

class RecordingSettings implements Pick<
  UserNotificationSettingsPort,
  "upsertPushLocale" | "upsertPushTimezone"
> {
  readonly timezones: string[] = [];
  readonly locales: string[] = [];

  async upsertPushTimezone(_userId: string, timezone: string): Promise<void> {
    this.timezones.push(timezone);
  }

  async upsertPushLocale(_userId: string, locale: string): Promise<void> {
    this.locales.push(locale);
  }
}

class RecordingCache implements Pick<
  NotificationCachePort,
  "invalidatePushTokens" | "invalidateUserPreference"
> {
  readonly pushTokenInvalidations: string[] = [];
  readonly preferenceInvalidations: string[] = [];

  async invalidatePushTokens(userId: string): Promise<void> {
    this.pushTokenInvalidations.push(userId);
  }

  async invalidateUserPreference(userId: string): Promise<void> {
    this.preferenceInvalidations.push(userId);
  }
}

class RecordingLogger implements Pick<ApplicationLoggerPort, "log" | "warn"> {
  readonly entries: ApplicationLogMessage[] = [];

  log(message: ApplicationLogMessage): void {
    this.entries.push(message);
  }

  warn(message: ApplicationLogMessage): void {
    this.entries.push(message);
  }
}

function createCommand(overrides: Partial<ReportPushDeviceCommand> = {}): ReportPushDeviceCommand {
  return PushDeviceReportFixture.command({
    sessionId: "session-a",
    token: VALID_TOKEN,
    ...overrides,
  });
}

function setup() {
  const store = new InMemoryPushDeviceStore();
  const settings = new RecordingSettings();
  const cache = new RecordingCache();
  const logger = new RecordingLogger();
  const useCase = new ReportPushDeviceUseCase({
    pushDeviceRepository: store,
    pushTokenRepository: store,
    unitOfWork: createUnitOfWorkMock(),
    pushProvider: { validateToken: (token) => token.startsWith("ExponentPushToken[") },
    userSettings: settings,
    cache,
    clock: new FixedClock(NOW),
    logger,
  });
  return { store, settings, cache, logger, useCase };
}

describe("ReportPushDeviceUseCase — 푸시 기기 보고", () => {
  it("권한이 허용되고 토큰이 있으면 deviceId 접두어의 플랫폼으로 토큰을 등록한다", async () => {
    // Given
    const { store, useCase } = setup();

    // When
    const report = await useCase.execute(createCommand({ deviceId: "android_device-a" }));

    // Then
    expect(report).toMatchObject({ platform: "ANDROID", hasActiveToken: true });
    expect(report.reportedAt.equals(NOW)).toBe(true);
    expect(store.tokens.get("user-a:android_device-a")).toMatchObject({
      token: VALID_TOKEN,
      platform: "ANDROID",
      payloadVersion: 2,
    });
  });

  it("iOS 임시 허용(PROVISIONAL)도 발송 대상으로 등록한다", async () => {
    const { store, useCase } = setup();

    const report = await useCase.execute(
      createCommand({ permission: { status: "PROVISIONAL", canAskAgain: true } }),
    );

    expect(report.hasActiveToken).toBe(true);
    expect(store.tokenOf("user-a", "ios_device-a")).toBe(VALID_TOKEN);
  });

  it("권한을 거절하면 이 기기의 토큰을 지우고 권한 상태만 남긴다", async () => {
    // Given 허용 상태로 등록된 기기
    const { store, cache, useCase } = setup();
    await useCase.execute(createCommand());

    // When 설정에서 알림을 끈 뒤 같은 토큰과 함께 보고
    const report = await useCase.execute(
      createCommand({ permission: { status: "DENIED", canAskAgain: false } }),
    );

    // Then
    expect(report).toMatchObject({
      hasActiveToken: false,
      permission: { status: "DENIED", canAskAgain: false },
    });
    expect(store.tokenOf("user-a", "ios_device-a")).toBeUndefined();
    expect(store.deviceOf("user-a", "ios_device-a")?.permission.status).toBe("DENIED");
    expect(cache.pushTokenInvalidations).toEqual(["user-a", "user-a"]);
  });

  it("아직 묻지 않은 기기는 토큰 없이 기록한다", async () => {
    const { store, useCase } = setup();

    await useCase.execute(
      createCommand({ permission: { status: "NOT_DETERMINED", canAskAgain: true }, token: null }),
    );

    expect(store.deviceOf("user-a", "ios_device-a")?.permission.canAskAgain).toBe(true);
    expect(store.tokens.size).toBe(0);
  });

  it("계정을 바꿔 로그인한 기기는 이전 사용자의 기기·토큰을 옮기고 양쪽 캐시를 비운다", async () => {
    // Given user-b가 쓰던 같은 기기
    const { store, cache, logger, useCase } = setup();
    await useCase.execute(createCommand({ userId: "user-b" }));

    // When user-a로 로그인한 뒤 권한을 거절한 상태로 보고
    await useCase.execute(
      createCommand({ permission: { status: "DENIED", canAskAgain: false }, token: null }),
    );

    // Then user-b는 더 이상 이 기기로 푸시를 받지 않는다
    expect(store.deviceOf("user-b", "ios_device-a")).toBeUndefined();
    expect(store.tokenOf("user-b", "ios_device-a")).toBeUndefined();
    expect(cache.pushTokenInvalidations.slice(-2)).toEqual(["user-a", "user-b"]);
    expect(logger.entries).toContainEqual(
      expect.objectContaining({ userId: "user-a", previousUserIds: ["user-b"] }),
    );
  });

  it("접두어로 플랫폼을 알 수 없으면 헤더 힌트를 쓰고, 그것도 없으면 NOTIFICATION_1006을 던진다", async () => {
    const { store, useCase } = setup();

    await useCase.execute(createCommand({ deviceId: "default", platformHint: "ANDROID" }));

    expect(store.tokens.get("user-a:default")?.platform).toBe("ANDROID");
    await expect(useCase.execute(createCommand({ deviceId: "device-x" }))).rejects.toMatchObject({
      errorCode: ErrorCode.NOTIFICATION_1006,
    });
  });

  it("토큰 형식이 틀리면 NOTIFICATION_1001을 던지고 아무것도 저장하지 않는다", async () => {
    const { store, useCase } = setup();

    await expect(useCase.execute(createCommand({ token: "not-a-token" }))).rejects.toMatchObject({
      errorCode: ErrorCode.NOTIFICATION_1001,
    });
    expect(store.devices.size).toBe(0);
  });

  it("시간대·언어가 있을 때만 저장하고 설정 캐시를 비운다. 잘못된 시간대는 버린다", async () => {
    const { settings, cache, useCase } = setup();

    await useCase.execute(createCommand());
    await useCase.execute(createCommand({ timezone: "Mars/Olympus" }));
    await useCase.execute(createCommand({ timezone: "Asia/Seoul", locale: "en" }));

    expect(settings.timezones).toEqual(["Asia/Seoul"]);
    expect(settings.locales).toEqual(["en"]);
    expect(cache.preferenceInvalidations).toEqual(["user-a"]);
  });

  it("같은 토큰 동시 등록으로 한 번 충돌하면 새 트랜잭션에서 한 번만 다시 시도한다", async () => {
    // Given
    const { store, logger, useCase } = setup();
    store.registerConflictsLeft = 1;

    // When
    await useCase.execute(createCommand());

    // Then
    expect(store.registerCalls).toBe(2);
    expect(store.tokenOf("user-a", "ios_device-a")).toBe(VALID_TOKEN);
    expect(logger.entries).toContainEqual(
      expect.objectContaining({
        event: "notification.delivery.report-push-device.token-conflict-retried",
      }),
    );
  });

  it("다시 시도해도 충돌하면 더 반복하지 않고 충돌 오류를 던진다", async () => {
    const { store, useCase } = setup();
    store.registerConflictsLeft = 2;

    await expect(useCase.execute(createCommand())).rejects.toThrow(
      "Push token registered concurrently",
    );
    expect(store.registerCalls).toBe(2);
  });

  it("로그에 토큰 값을 남기지 않는다", async () => {
    const { logger, useCase } = setup();

    await useCase.execute(createCommand());

    expect(JSON.stringify(logger.entries)).not.toContain(VALID_TOKEN);
  });
});
