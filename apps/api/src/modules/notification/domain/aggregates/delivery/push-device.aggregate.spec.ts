import { ErrorCode } from "@aido/api/errors";

import { PushPermission } from "../../value-objects/delivery/push-permission.vo.js";
import { PushDevice } from "./push-device.aggregate.js";

function report(status: PushPermission["status"], token: string | null) {
  return PushDevice.report({
    userId: "user-a",
    sessionId: "session-a",
    deviceId: "ios_device-a",
    platform: "IOS",
    permission: PushPermission.of({ status, canAskAgain: false }),
    token,
    deviceModel: "iPhone 17 Pro",
    osVersion: "26.1",
    reportedAt: new Date("2026-11-04T03:00:00.000Z"),
  });
}

describe("PushDevice — 푸시 기기", () => {
  it.each([
    ["GRANTED", "ExponentPushToken[a]"],
    ["PROVISIONAL", "ExponentPushToken[a]"],
  ] as const)("%s 권한이면 토큰을 발송 대상으로 둔다", (status, token) => {
    expect(report(status, token).deliverableToken).toBe(token);
  });

  it.each(["DENIED", "NOT_DETERMINED"] as const)(
    "%s 권한이면 앱이 토큰을 보내도 발송 대상으로 두지 않는다",
    (status) => {
      expect(report(status, "ExponentPushToken[stale]").deliverableToken).toBeNull();
    },
  );

  it("플랫폼을 알 수 없으면 NOTIFICATION_1006을 던진다", () => {
    expect(() =>
      PushDevice.report({
        userId: "user-a",
        sessionId: null,
        deviceId: "device-x",
        platform: null,
        permission: PushPermission.of({ status: "GRANTED", canAskAgain: false }),
        token: null,
        deviceModel: null,
        osVersion: null,
        reportedAt: new Date(),
      }),
    ).toThrow(expect.objectContaining({ errorCode: ErrorCode.NOTIFICATION_1006 }));
  });
});
