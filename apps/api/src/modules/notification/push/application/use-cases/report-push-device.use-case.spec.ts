import { ErrorCode } from "@aido/api/errors";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FakePushProvider } from "#test/doubles/notification/fake-push-provider";
import { InMemoryPushDeviceRepository } from "#test/doubles/notification/in-memory-push-device.repository";
import { InMemoryPushTokenRepository } from "#test/doubles/notification/in-memory-push-token.repository";
import { PassThroughNotificationCache } from "#test/doubles/notification/pass-through-notification-cache";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createReportPushDeviceCommandFixture } from "#test/fixtures/notification/push-device.fixture";

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

  async upsertPushTimezone(_userId: UserId, timezone: string): Promise<void> {
    this.timezones.push(timezone);
  }

  async upsertPushLocale(_userId: UserId, locale: string): Promise<void> {
    this.locales.push(locale);
  }
}

function createCommand(overrides: Partial<ReportPushDeviceCommand> = {}): ReportPushDeviceCommand {
  return createReportPushDeviceCommandFixture({
    userId: "user-a",
    sessionId: "session-a",
    deviceId: "ios_device-a",
    token: VALID_TOKEN,
    ...overrides,
  });
}

function setup() {
  const devices = new InMemoryPushDeviceRepository();
  const tokens = new InMemoryPushTokenRepository();
  const settings = new RecordingSettings();
  const cache = new PassThroughNotificationCache();
  const logger = new SilentLogger();
  const useCase = new ReportPushDeviceUseCase({
    pushDeviceRepository: devices,
    pushTokenRepository: tokens,
    unitOfWork: new ImmediateUnitOfWork(),
    pushProvider: new FakePushProvider(),
    userSettings: settings,
    cache,
    clock: new FixedClock(NOW),
    logger,
  });
  return { devices, tokens, settings, cache, logger, useCase };
}

describe("ReportPushDeviceUseCase — 푸시 기기 보고", () => {
  it("권한이 허용되고 토큰이 있으면 deviceId 접두어의 플랫폼으로 토큰을 등록한다", async () => {
    // Given
    const { tokens, useCase } = setup();

    // When
    const report = await useCase.execute(createCommand({ deviceId: "android_device-a" }));

    // Then
    expect(report).toMatchObject({ platform: "ANDROID", hasActiveToken: true });
    expect(report.reportedAt.equals(NOW)).toBe(true);
    expect(tokens.tokenOf("user-a", "android_device-a")).toMatchObject({
      token: VALID_TOKEN,
      platform: "ANDROID",
      payloadVersion: 2,
      isActive: true,
    });
  });

  it("iOS 임시 허용(PROVISIONAL)도 발송 대상으로 등록한다", async () => {
    // Given
    const { tokens, useCase } = setup();

    // When
    const report = await useCase.execute(
      createCommand({ permission: { status: "PROVISIONAL", canAskAgain: true } }),
    );

    // Then
    expect(report.hasActiveToken).toBe(true);
    expect(tokens.tokenOf("user-a", "ios_device-a")?.token).toBe(VALID_TOKEN);
  });

  it("권한을 거절하면 이 기기의 토큰을 지우고 권한 상태만 남긴다", async () => {
    // Given 허용 상태로 등록된 기기
    const { devices, tokens, cache, useCase } = setup();
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
    expect(tokens.tokenOf("user-a", "ios_device-a")).toBeUndefined();
    expect(devices.deviceOf("user-a", "ios_device-a")?.permission.status).toBe("DENIED");
    expect(cache.invalidatedPushTokenUserIds).toEqual(["user-a", "user-a"]);
  });

  it("허용인데 토큰 발급에 실패해 null로 보고하면 등록된 토큰을 두고 세션·앱 버전만 이번 보고로 옮긴다", async () => {
    // Given 이전 세션에서 토큰을 등록한 기기
    const { devices, tokens, useCase } = setup();
    await useCase.execute(createCommand({ sessionId: "session-old", appVersion: "1.14.2" }));

    // When 다시 로그인한 뒤 토큰 발급이 시간 초과로 실패한 보고
    const report = await useCase.execute(
      createCommand({ sessionId: "session-new", appVersion: "1.15.0", token: null }),
    );

    // Then
    expect(report.hasActiveToken).toBe(true);
    expect(tokens.tokenOf("user-a", "ios_device-a")).toMatchObject({
      token: VALID_TOKEN,
      isActive: true,
      appVersion: "1.15.0",
    });
    expect(tokens.sessionOf("user-a", "ios_device-a")).toBe("session-new");
    expect(devices.deviceOf("user-a", "ios_device-a")?.sessionId).toBe("session-new");
  });

  it("허용인데 토큰이 null이고 등록된 토큰도 없으면 토큰 없이 권한만 기록한다", async () => {
    // Given
    const { devices, tokens, useCase } = setup();

    // When
    const report = await useCase.execute(createCommand({ token: null }));

    // Then
    expect(report).toMatchObject({ hasActiveToken: false, permission: { status: "GRANTED" } });
    expect(tokens.size).toBe(0);
    expect(devices.deviceOf("user-a", "ios_device-a")?.permission.status).toBe("GRANTED");
  });

  it("아직 묻지 않은 기기는 토큰 없이 기록한다", async () => {
    // Given
    const { devices, tokens, useCase } = setup();

    // When
    await useCase.execute(
      createCommand({ permission: { status: "NOT_DETERMINED", canAskAgain: true }, token: null }),
    );

    // Then
    expect(devices.deviceOf("user-a", "ios_device-a")?.permission.canAskAgain).toBe(true);
    expect(tokens.size).toBe(0);
  });

  it("계정을 바꿔 로그인한 기기는 이전 사용자의 기기·토큰을 옮기고 양쪽 캐시를 비운다", async () => {
    // Given user-b가 쓰던 같은 기기
    const { devices, tokens, cache, logger, useCase } = setup();
    await useCase.execute(createCommand({ userId: "user-b" }));

    // When user-a로 로그인한 뒤 권한을 거절한 상태로 보고
    await useCase.execute(
      createCommand({ permission: { status: "DENIED", canAskAgain: false }, token: null }),
    );

    // Then user-b는 더 이상 이 기기로 푸시를 받지 않는다
    expect(devices.deviceOf("user-b", "ios_device-a")).toBeUndefined();
    expect(tokens.tokenOf("user-b", "ios_device-a")).toBeUndefined();
    expect(cache.invalidatedPushTokenUserIds.slice(-2)).toEqual(["user-a", "user-b"]);
    expect(logger.messages).toContainEqual(
      expect.objectContaining({ userId: "user-a", previousUserIds: ["user-b"] }),
    );
  });

  it("접두어로 플랫폼을 알 수 없으면 헤더 힌트를 쓰고, 그것도 없으면 NOTIFICATION_1006을 던진다", async () => {
    // Given
    const { tokens, useCase } = setup();

    // When
    await useCase.execute(createCommand({ deviceId: "default", platformHint: "ANDROID" }));
    const withoutHint = useCase.execute(createCommand({ deviceId: "device-x" }));

    // Then
    expect(tokens.tokenOf("user-a", "default")?.platform).toBe("ANDROID");
    await expect(withoutHint).rejects.toMatchObject({ errorCode: ErrorCode.NOTIFICATION_1006 });
  });

  it("토큰 형식이 틀리면 NOTIFICATION_1001을 던지고 아무것도 저장하지 않는다", async () => {
    // Given
    const { devices, tokens, useCase } = setup();

    // When
    const result = useCase.execute(createCommand({ token: "not-a-token" }));

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.NOTIFICATION_1001 });
    expect(devices.size).toBe(0);
    expect(tokens.size).toBe(0);
  });

  it("시간대·언어가 있을 때만 저장하고 설정 캐시를 비운다. 잘못된 시간대는 버린다", async () => {
    // Given
    const { settings, cache, useCase } = setup();

    // When
    await useCase.execute(createCommand());
    await useCase.execute(createCommand({ timezone: "Mars/Olympus" }));
    await useCase.execute(createCommand({ timezone: "Asia/Seoul", locale: "en" }));

    // Then
    expect(settings.timezones).toEqual(["Asia/Seoul"]);
    expect(settings.locales).toEqual(["en"]);
    expect(cache.invalidatedPreferenceUserIds).toEqual(["user-a"]);
  });

  it("같은 토큰 동시 등록으로 한 번 충돌하면 새 트랜잭션에서 한 번만 다시 시도한다", async () => {
    // Given
    const { tokens, logger, useCase } = setup();
    tokens.failNextRegistrations(1);

    // When
    await useCase.execute(createCommand());

    // Then
    expect(tokens.registerAttempts).toBe(2);
    expect(tokens.tokenOf("user-a", "ios_device-a")?.token).toBe(VALID_TOKEN);
    expect(logger.messages).toContainEqual(
      expect.objectContaining({
        event: "notification.delivery.report-push-device.token-conflict-retried",
      }),
    );
  });

  it("다시 시도해도 충돌하면 더 반복하지 않고 충돌 오류를 던진다", async () => {
    // Given
    const { tokens, useCase } = setup();
    tokens.failNextRegistrations(2);

    // When
    const result = useCase.execute(createCommand());

    // Then
    await expect(result).rejects.toThrow("Push token registered concurrently");
    expect(tokens.registerAttempts).toBe(2);
  });

  it("로그에 토큰 값을 남기지 않는다", async () => {
    // Given
    const { logger, useCase } = setup();

    // When
    await useCase.execute(createCommand());

    // Then
    expect(JSON.stringify(logger.messages)).not.toContain(VALID_TOKEN);
  });
});
