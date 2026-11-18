import type { ReportPushDeviceCommand } from "#api/modules/notification/push-devices/application/use-cases/report-push-device.use-case";
import {
  PushDevice,
  type PushDevicePrimitives,
} from "#api/modules/notification/push-devices/domain/push-device.aggregate";

export const PUSH_DEVICE_FIXTURE_NOW = Temporal.Instant.from("2026-11-10T03:00:00Z");
export const PUSH_DEVICE_FIXTURE_USER_ID = "clz7x5p8k0021qz0z8z8z8z8z";
export const PUSH_DEVICE_FIXTURE_OTHER_USER_ID = "clz7x5p8k0022qz0z8z8z8z8z";
const PUSH_DEVICE_FIXTURE_DEVICE_ID = "ios_device-a";
const PUSH_DEVICE_FIXTURE_TOKEN = "ExponentPushToken[device-a]";
export const PUSH_FIXTURE_SESSION_ID = "clz7x5p8k0041qz0z8z8z8z8z";
export const PUSH_FIXTURE_OTHER_SESSION_ID = "clz7x5p8k0042qz0z8z8z8z8z";

// 토큰은 사용자·기기마다 다르다. 같은 토큰을 다른 사용자가 보고하는 경우(토큰 넘겨받기)만 token을 직접 넘긴다
export function createPushDeviceFixture(overrides: Partial<PushDevicePrimitives> = {}): PushDevice {
  const deviceId = overrides.deviceId ?? PUSH_DEVICE_FIXTURE_DEVICE_ID;
  const userId = overrides.userId ?? PUSH_DEVICE_FIXTURE_USER_ID;
  return PushDevice.reconstitute({
    deviceId,
    userId,
    sessionId: null,
    platform: "IOS",
    permissionStatus: "GRANTED",
    permissionCanAskAgain: false,
    token: `ExponentPushToken[${deviceId}.${userId}]`,
    channel: "EXPO",
    payloadVersion: 2,
    appVersion: null,
    deviceModel: null,
    osVersion: null,
    reportedAt: PUSH_DEVICE_FIXTURE_NOW,
    ...overrides,
  });
}

// 헤더에서 오는 값(시간대·언어·모델·OS)은 보내지 않은 상태(null)가 기본이다
export function createReportPushDeviceCommandFixture(
  overrides: Partial<ReportPushDeviceCommand> = {},
): ReportPushDeviceCommand {
  return {
    userId: PUSH_DEVICE_FIXTURE_USER_ID,
    sessionId: null,
    deviceId: PUSH_DEVICE_FIXTURE_DEVICE_ID,
    permission: { status: "GRANTED", canAskAgain: false },
    token: PUSH_DEVICE_FIXTURE_TOKEN,
    channel: "EXPO",
    payloadVersion: 2,
    appVersion: null,
    deviceModel: null,
    osVersion: null,
    timezone: null,
    locale: null,
    ...overrides,
  };
}
