import { mock, type MockProxy } from "vitest-mock-extended";
/**
 * NotificationController 컨트롤러 단위 테스트
 *
 * @description
 * NotificationController의 엔드포인트 핸들러를 격리 테스트합니다.
 * 컨트롤러는 endpoint UseCase를 직접 주입받는다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/server test notification.controller
 * ```
 */

import type { CurrentUserPayload } from "#api/modules/identity/identity-auth-http.public";
import { parseRequestClient } from "#api/platform/http/request-client/index";
import { TEST_REQUEST_ID } from "#test/mocks/request-client";

import { OptOutMarketingPushUseCase } from "../../../../push/application/use-cases/opt-out-marketing-push.use-case.js";
import { ReportPushDeviceUseCase } from "../../../../push/application/use-cases/report-push-device.use-case.js";
import { UnregisterPushDeviceUseCase } from "../../../../push/application/use-cases/unregister-push-device.use-case.js";
import { GetUnreadNotificationCountUseCase } from "../../../application/use-cases/get-unread-notification-count.use-case.js";
import { ListNotificationsUseCase } from "../../../application/use-cases/list-notifications.use-case.js";
import { MarkAllNotificationsReadUseCase } from "../../../application/use-cases/mark-all-notifications-read.use-case.js";
import { MarkNotificationOpenedUseCase } from "../../../application/use-cases/mark-notification-opened.use-case.js";
import { MarkNotificationReadUseCase } from "../../../application/use-cases/mark-notification-read.use-case.js";
import { NotificationController } from "./notification.controller.js";
import type { RegisterPushTokenDto } from "./notification.dto.js";

describe("NotificationController — 알림 컨트롤러", () => {
  let controller: NotificationController;
  let getUnreadCountUseCase: MockProxy<GetUnreadNotificationCountUseCase>;
  let markAllAsReadUseCase: MockProxy<MarkAllNotificationsReadUseCase>;
  let markAsReadUseCase: MockProxy<MarkNotificationReadUseCase>;
  let reportPushDeviceUseCase: MockProxy<ReportPushDeviceUseCase>;

  const mockUser: CurrentUserPayload = {
    userId: "user-123",
    email: "test@example.com",
    sessionId: "session-123",
    role: "USER",
  };

  beforeEach(() => {
    getUnreadCountUseCase = mock<GetUnreadNotificationCountUseCase>();
    markAllAsReadUseCase = mock<MarkAllNotificationsReadUseCase>();
    markAsReadUseCase = mock<MarkNotificationReadUseCase>();
    reportPushDeviceUseCase = mock<ReportPushDeviceUseCase>();
    controller = new NotificationController(
      mock<ListNotificationsUseCase>(),
      getUnreadCountUseCase,
      markAsReadUseCase,
      mock<MarkNotificationOpenedUseCase>(),
      markAllAsReadUseCase,
      reportPushDeviceUseCase,
      mock<UnregisterPushDeviceUseCase>(),
      mock<OptOutMarketingPushUseCase>(),
    );
  });

  describe("getUnreadCount", () => {
    it("읽지 않은 알림 수를 반환해야 한다", async () => {
      // Given -읽지 않은 알림이 5개 있을 때
      getUnreadCountUseCase.execute.mockResolvedValue(5);

      // When -getUnreadCount를 호출하면
      const result = await controller.getUnreadCount(mockUser);

      // Then -use-case에 userId를 전달하고 unreadCount를 반환해야 한다
      expect(getUnreadCountUseCase.execute).toHaveBeenCalledWith(mockUser.userId);
      expect(result).toEqual({ unreadCount: 5 });
    });

    it("읽지 않은 알림이 없으면 0을 반환해야 한다", async () => {
      // Given -읽지 않은 알림이 없을 때
      getUnreadCountUseCase.execute.mockResolvedValue(0);

      // When -getUnreadCount를 호출하면
      const result = await controller.getUnreadCount(mockUser);

      // Then -unreadCount가 0이어야 한다
      expect(result).toEqual({ unreadCount: 0 });
    });
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

  describe("markAsRead", () => {
    it("단일 알림을 읽음 처리하고 결과를 반환해야 한다", async () => {
      // Given -읽음 처리할 알림 ID가 있을 때
      const notificationId = 42;
      markAsReadUseCase.execute.mockResolvedValue(undefined);

      // When -markAsRead를 호출하면
      const result = await controller.markAsRead(mockUser, {
        id: notificationId,
      });

      // Then -use-case에 userId와 id를 전달하고 성공 응답을 반환해야 한다
      expect(markAsReadUseCase.execute).toHaveBeenCalledWith(mockUser.userId, notificationId);
      expect(result).toEqual({
        message: "알림을 읽음 처리했습니다.",
        readCount: 1,
      });
    });
  });

  describe("markAllAsRead", () => {
    it("모든 알림을 읽음 처리하고 결과를 반환해야 한다", async () => {
      // Given -읽지 않은 알림이 3개 있을 때
      markAllAsReadUseCase.execute.mockResolvedValue({ count: 3 });

      // When -markAllAsRead를 호출하면
      const result = await controller.markAllAsRead(mockUser);

      // Then -use-case에 userId를 전달하고 처리된 개수를 반환해야 한다
      expect(markAllAsReadUseCase.execute).toHaveBeenCalledWith(mockUser.userId);
      expect(result).toEqual({
        message: "모든 알림을 읽음 처리했습니다.",
        readCount: 3,
      });
    });
  });
});
