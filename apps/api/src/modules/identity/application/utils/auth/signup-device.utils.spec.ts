import { resolveSignupDevice } from "./signup-device.utils.js";

describe("resolveSignupDevice", () => {
  it("명시된 기기 타입과 모델명을 사용한다", () => {
    expect(
      resolveSignupDevice({ deviceType: "ios", deviceName: "iPhone 15 Pro", userAgent: "okhttp" }),
    ).toEqual({ devicePlatform: "IOS", deviceModel: "iPhone 15 Pro" });
  });

  it.each([
    ["aido/1 CFNetwork/1494 Darwin/23.4.0", "IOS"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Safari", "IOS"],
    ["okhttp/4.12.0", "ANDROID"],
    ["Mozilla/5.0 (Linux; Android 14; SM-S921N) Chrome/124", "ANDROID"],
  ])("기기 타입이 없으면 User-Agent(%s)에서 플랫폼을 확인한다", (userAgent, platform) => {
    expect(resolveSignupDevice({ userAgent })).toEqual({ devicePlatform: platform });
  });

  it("확인할 수 없으면 비워 둔다", () => {
    expect(resolveSignupDevice({ userAgent: "Mozilla/5.0 (Windows NT 10.0)" })).toEqual({});
    expect(resolveSignupDevice(undefined)).toEqual({});
  });

  it("알 수 없는 기기 타입은 User-Agent로 넘어가고 모델명은 제어문자 제거 후 길이를 제한한다", () => {
    const result = resolveSignupDevice({
      deviceType: "TOASTER",
      userAgent: "okhttp/4",
      deviceName: `\n${"a".repeat(60)}`,
    });

    expect(result).toEqual({ devicePlatform: "ANDROID", deviceModel: "a".repeat(40) });
  });
});
