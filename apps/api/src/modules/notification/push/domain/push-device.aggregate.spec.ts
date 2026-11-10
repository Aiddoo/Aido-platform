import { ErrorCode } from "@aido/api/errors";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { PushDeviceId } from "./push-device-id.vo.js";
import { PushDevice } from "./push-device.aggregate.js";
import { PushPermission } from "./push-permission.vo.js";

const REPORTED_AT = Temporal.Instant.from("2026-11-04T03:00:00.000Z");

function report(status: PushPermission["status"], token: string | null) {
  return PushDevice.create({
    id: PushDeviceId.reconstitute("ios_device-a"),
    userId: UserId.reconstitute("user-a"),
    sessionId: "session-a",
    platform: "IOS",
    permission: PushPermission.create({ status, canAskAgain: false }),
    token,
    deviceModel: "iPhone 17 Pro",
    osVersion: "26.1",
    now: REPORTED_AT,
  });
}

describe("PushDevice — 푸시 기기", () => {
  it.each([
    ["GRANTED", "ExponentPushToken[a]"],
    ["PROVISIONAL", "ExponentPushToken[a]"],
  ] as const)("%s 권한이면 토큰을 발송 대상으로 둔다", (status, token) => {
    // Given
    const device = report(status, token);

    // When
    const deliverableToken = device.deliverableToken;

    // Then
    expect(deliverableToken).toBe(token);
  });

  it.each(["DENIED", "NOT_DETERMINED"] as const)(
    "%s 권한이면 앱이 토큰을 보내도 발송 대상으로 두지 않는다",
    (status) => {
      // Given
      const device = report(status, "ExponentPushToken[stale]");

      // When
      const deliverableToken = device.deliverableToken;

      // Then
      expect(deliverableToken).toBeNull();
    },
  );

  it("플랫폼을 알 수 없으면 NOTIFICATION_1006을 던진다", () => {
    // Given
    const params = {
      id: PushDeviceId.reconstitute("device-x"),
      userId: UserId.reconstitute("user-a"),
      sessionId: null,
      platform: null,
      permission: PushPermission.create({ status: "GRANTED", canAskAgain: false }),
      token: null,
      deviceModel: null,
      osVersion: null,
      now: REPORTED_AT,
    };

    // When
    const create = () => PushDevice.create(params);

    // Then
    expect(create).toThrow(
      expect.objectContaining({
        errorCode: ErrorCode.NOTIFICATION_1006,
        details: { deviceId: "device-x" },
      }),
    );
  });

  it("보고 시각을 now로 남기고 저장값으로 같은 기기를 복원한다", () => {
    // Given
    const device = report("GRANTED", "ExponentPushToken[a]");

    // When
    const restored = PushDevice.reconstitute(device.toPrimitives());

    // Then
    expect(restored.reportedAt.equals(REPORTED_AT)).toBe(true);
    expect(restored.toPrimitives()).toEqual(device.toPrimitives());
  });
});
