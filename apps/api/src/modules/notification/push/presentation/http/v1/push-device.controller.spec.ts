import { mock, type MockProxy } from "vitest-mock-extended";

import type { CurrentUserPayload } from "#api/modules/identity/identity-auth-http.public";
import { parseRequestClient } from "#api/platform/http/request-client/index";
import { TEST_REQUEST_ID } from "#test/mocks/request-client";

import { OptOutMarketingPushUseCase } from "../../../application/use-cases/opt-out-marketing-push.use-case.js";
import { ReportPushDeviceUseCase } from "../../../application/use-cases/report-push-device.use-case.js";
import { UnregisterPushDeviceUseCase } from "../../../application/use-cases/unregister-push-device.use-case.js";
import { PushDeviceController } from "./push-device.controller.js";
import type { RegisterPushTokenDto } from "./push-device.dto.js";

describe("PushDeviceController — 푸시 기기 컨트롤러", () => {
  let controller: PushDeviceController;
  let reportPushDeviceUseCase: MockProxy<ReportPushDeviceUseCase>;

  const mockUser: CurrentUserPayload = {
    userId: "user-123",
    email: "test@example.com",
    sessionId: "session-123",
    role: "USER",
  };

  beforeEach(() => {
    reportPushDeviceUseCase = mock<ReportPushDeviceUseCase>();
    controller = new PushDeviceController(
      reportPushDeviceUseCase,
      mock<UnregisterPushDeviceUseCase>(),
      mock<OptOutMarketingPushUseCase>(),
    );
  });

  describe("registerToken", () => {
    it("1.14.1 이하 앱의 토큰 등록을 권한 허용 기기 보고로 바꿔 전달한다", async () => {
      // Given 권한을 허용한 뒤 토큰을 보내는 구 앱 요청
      const dto: RegisterPushTokenDto = {
        token: "ExponentPushToken[xxxxxx]",
        deviceId: "android_abc",
        payloadVersion: 2,
        appVersion: "1.14.1",
      };

      // When
      const client = parseRequestClient(
        { "x-timezone": "Asia/Seoul", "accept-language": "ko", "x-device-name": "SM-S931N" },
        TEST_REQUEST_ID,
      );
      const result = await controller.registerToken(mockUser, dto, client);

      // Then 권한은 GRANTED, 결과 문구는 그대로다
      expect(reportPushDeviceUseCase.execute).toHaveBeenCalledWith({
        userId: mockUser.userId,
        sessionId: mockUser.sessionId,
        deviceId: "android_abc",
        platformHint: undefined,
        deviceModel: "SM-S931N",
        osVersion: null,
        permission: { status: "GRANTED", canAskAgain: false },
        token: dto.token,
        payloadVersion: 2,
        appVersion: "1.14.1",
        timezone: "Asia/Seoul",
        locale: "ko",
      });
      expect(result).toEqual({ message: "푸시 토큰이 등록되었습니다.", registered: true });
    });

    it("deviceId가 없으면 구 기본 기기로 보고하고 기기 타입 헤더를 플랫폼 힌트로 쓴다", async () => {
      // Given deviceId 없이 보낸 요청
      const dto: RegisterPushTokenDto = { token: "ExponentPushToken[xxxxxx]", payloadVersion: 1 };

      // When
      await controller.registerToken(
        mockUser,
        dto,
        parseRequestClient({ "x-device-type": "android" }, TEST_REQUEST_ID),
      );

      // Then
      expect(reportPushDeviceUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: "default",
          platformHint: "ANDROID",
          timezone: null,
        }),
      );
    });
  });
});
