import type { CurrentUserPayload } from "#api/modules/identity/identity-auth-http.public";
import { parseRequestClient } from "#api/platform/http/request-client/request-client";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FakePushProvider } from "#test/doubles/notification/fake-push-provider";
import { InMemoryPushDeviceRepository } from "#test/doubles/notification/in-memory-push-device.repository";
import { InMemoryPushTokenRepository } from "#test/doubles/notification/in-memory-push-token.repository";
import { PassThroughNotificationCache } from "#test/doubles/notification/pass-through-notification-cache";
import { StubMarketingPushOptOutToken } from "#test/doubles/notification/stub-marketing-push-opt-out-token";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { SilentLogger } from "#test/doubles/platform/silent-logger";

import type { UserNotificationSettingsPort } from "../../../application/ports/user-notification-settings.port.js";
import { OptOutMarketingPushUseCase } from "../../../application/use-cases/opt-out-marketing-push.use-case.js";
import { ReportPushDeviceUseCase } from "../../../application/use-cases/report-push-device.use-case.js";
import { UnregisterPushDeviceByTokenUseCase } from "../../../application/use-cases/unregister-push-device-by-token.use-case.js";
import { UnregisterPushDeviceUseCase } from "../../../application/use-cases/unregister-push-device.use-case.js";
import { PushDeviceController } from "./push-device.controller.js";
import type { RegisterPushTokenDto } from "./push-device.dto.js";

const REQUEST_ID = "00000000-0000-4000-8000-000000000001";
const NOW = Temporal.Instant.from("2026-11-10T03:00:00Z");

const user: CurrentUserPayload = {
  userId: "user-123",
  email: "test@example.com",
  sessionId: "session-123",
  role: "USER",
};

class RecordingSettings implements Pick<
  UserNotificationSettingsPort,
  "upsertPushLocale" | "upsertPushTimezone" | "updateMarketingPushConsent"
> {
  readonly timezones = new Map<string, string>();
  readonly locales = new Map<string, string>();

  async upsertPushTimezone(user: UserId, timezone: string): Promise<void> {
    const userId = user.value;
    this.timezones.set(userId, timezone);
  }

  async upsertPushLocale(user: UserId, locale: string): Promise<void> {
    const userId = user.value;
    this.locales.set(userId, locale);
  }

  async updateMarketingPushConsent(): Promise<void> {}
}

function setup() {
  const devices = new InMemoryPushDeviceRepository();
  const tokens = new InMemoryPushTokenRepository();
  const settings = new RecordingSettings();
  const cache = new PassThroughNotificationCache();
  const unitOfWork = new ImmediateUnitOfWork();
  const clock = new FixedClock(NOW);
  const logger = new SilentLogger();
  const controller = new PushDeviceController(
    new ReportPushDeviceUseCase({
      pushDeviceRepository: devices,
      pushTokenRepository: tokens,
      unitOfWork,
      pushProvider: new FakePushProvider(),
      userSettings: settings,
      cache,
      clock,
      logger,
    }),
    new UnregisterPushDeviceUseCase({
      pushDeviceRepository: devices,
      pushTokenRepository: tokens,
      unitOfWork,
      cache,
      logger,
    }),
    new UnregisterPushDeviceByTokenUseCase({
      pushDeviceRepository: devices,
      pushTokenRepository: tokens,
      unitOfWork,
      cache,
      logger,
    }),
    new OptOutMarketingPushUseCase({
      tokens: new StubMarketingPushOptOutToken(),
      settings,
      clock,
      logger,
    }),
  );
  return { controller, devices, tokens, settings };
}

describe("PushDeviceController — 푸시 기기 컨트롤러", () => {
  describe("registerToken", () => {
    it("1.14.1 이하 앱의 토큰 등록을 권한 허용 기기 보고로 바꿔 저장한다", async () => {
      // Given 권한을 허용한 뒤 토큰을 보내는 구 앱 요청
      const { controller, devices, tokens, settings } = setup();
      const dto: RegisterPushTokenDto = {
        token: "ExponentPushToken[xxxxxx]",
        deviceId: "android_abc",
        payloadVersion: 2,
        appVersion: "1.14.1",
      };
      const client = parseRequestClient(
        { "x-timezone": "Asia/Seoul", "accept-language": "ko", "x-device-name": "SM-S931N" },
        REQUEST_ID,
      );

      // When
      const result = await controller.registerToken(user, dto, client);

      // Then 권한은 GRANTED, 결과 문구는 그대로다
      expect(result).toEqual({ message: "푸시 토큰이 등록되었습니다.", registered: true });
      expect(devices.deviceOf(user.userId, "android_abc")?.toPrimitives()).toEqual({
        deviceId: "android_abc",
        userId: user.userId,
        sessionId: user.sessionId,
        platform: "ANDROID",
        permissionStatus: "GRANTED",
        permissionCanAskAgain: false,
        token: null,
        deviceModel: "SM-S931N",
        osVersion: null,
        reportedAt: NOW,
      });
      expect(tokens.tokenOf(user.userId, "android_abc")).toMatchObject({
        token: dto.token,
        platform: "ANDROID",
        payloadVersion: 2,
        appVersion: "1.14.1",
        isActive: true,
      });
      expect(settings.timezones.get(user.userId)).toBe("Asia/Seoul");
      expect(settings.locales.get(user.userId)).toBe("ko");
    });

    it("deviceId가 없으면 구 기본 기기로 보고하고 기기 타입 헤더를 플랫폼 힌트로 쓴다", async () => {
      // Given deviceId 없이 보낸 요청
      const { controller, tokens, settings } = setup();
      const dto: RegisterPushTokenDto = { token: "ExponentPushToken[xxxxxx]", payloadVersion: 1 };

      // When
      await controller.registerToken(
        user,
        dto,
        parseRequestClient({ "x-device-type": "android" }, REQUEST_ID),
      );

      // Then
      expect(tokens.tokenOf(user.userId, "default")).toMatchObject({
        token: dto.token,
        platform: "ANDROID",
        payloadVersion: 1,
      });
      expect(settings.timezones.size).toBe(0);
    });
  });
});
