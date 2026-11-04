import { platformFromDeviceId } from "./push-device.policy.js";

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
