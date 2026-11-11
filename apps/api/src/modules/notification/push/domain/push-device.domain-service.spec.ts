import { noActiveTokenSkipReason, platformFromDeviceId } from "./push-device.domain-service.js";

describe("platformFromDeviceId — deviceId 접두어로 플랫폼 판정", () => {
  it.each([
    ["ios_5F2C1E7A", "IOS"],
    ["android_a1b2c3", "ANDROID"],
    ["default", null],
    ["IOS_upper", null],
  ] as const)("%s → %s", (deviceId, platform) => {
    expect(platformFromDeviceId(deviceId)).toBe(platform);
  });
});

describe("noActiveTokenSkipReason — 토큰 없는 사용자의 건너뜀 사유", () => {
  it.each([
    [[], "NO_ACTIVE_TOKEN"],
    [["DENIED"], "PUSH_PERMISSION_DENIED"],
    [["NOT_DETERMINED"], "PUSH_PERMISSION_NOT_REQUESTED"],
    [["DENIED", "NOT_DETERMINED"], "PUSH_PERMISSION_NOT_REQUESTED"],
    [["DENIED", "GRANTED"], "NO_ACTIVE_TOKEN"],
    [["PROVISIONAL"], "NO_ACTIVE_TOKEN"],
  ] as const)("기기 권한 %j → %s", (statuses, reason) => {
    expect(noActiveTokenSkipReason(statuses)).toBe(reason);
  });
});
