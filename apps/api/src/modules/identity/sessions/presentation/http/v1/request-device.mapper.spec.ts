import type { IncomingHttpHeaders } from "node:http";

import { parseRequestClient } from "#api/platform/http/request-client/request-client";
import { TEST_REQUEST_ID } from "#test/mocks/request-client";

import { type RequestDeviceSource, resolveRequestDevice } from "./request-device.mapper.js";

function resolve(
  source: Omit<RequestDeviceSource, "client"> & { readonly headers?: IncomingHttpHeaders } = {},
) {
  const { headers = {}, ...rest } = source;
  return resolveRequestDevice({ client: parseRequestClient(headers, TEST_REQUEST_ID), ...rest });
}

const IPAD_DESKTOP_MODE =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
const ANDROID_WEBVIEW =
  "Mozilla/5.0 (Linux; Android 14; SM-S921N; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const GOOGLEBOT_SMARTPHONE =
  "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

describe("resolveRequestDevice", () => {
  describe("기기 타입", () => {
    it.each([
      ["ios", "IOS"],
      ["  Android ", "ANDROID"],
      ["WeB", "WEB"],
    ])("앱이 보낸 값(%j)의 대소문자와 공백을 정규화한다", (deviceType, platform) => {
      // Given

      // When
      const result = resolve({ deviceType });

      // Then
      expect(result).toEqual({ devicePlatform: platform });
    });

    it("알 수 없는 값은 버리고 User-Agent로 판별한다", () => {
      // Given
      const source = { deviceType: "TOASTER", userAgent: "okhttp/4.12.0" };

      // When
      const result = resolve(source);

      // Then
      expect(result).toEqual({ devicePlatform: "ANDROID" });
    });

    it("User-Agent와 다르면 앱이 명시한 값을 우선한다", () => {
      // Given
      const source = { deviceType: "IOS", userAgent: ANDROID_CHROME };

      // When
      const result = resolve(source);

      // Then
      expect(result).toEqual({ devicePlatform: "IOS" });
    });

    it("본문에 기기 타입·이름이 있으면 헤더 값보다 우선한다", () => {
      // Given
      const source = {
        headers: { "x-device-type": "ANDROID", "x-device-name": "Header Phone" },
        deviceType: "ios",
        deviceName: "iPhone 15",
      };

      // When
      const result = resolve(source);

      // Then
      expect(result).toEqual({ devicePlatform: "IOS", deviceModel: "iPhone 15" });
    });

    it("본문 기기 타입이 알 수 없는 값이면 헤더가 아닌 User-Agent로 판별한다", () => {
      // Given
      const source = {
        headers: { "x-device-type": "IOS" },
        deviceType: "TOASTER",
        userAgent: "okhttp/4.12.0",
      };

      // When
      const result = resolve(source);

      // Then
      expect(result).toEqual({ devicePlatform: "ANDROID" });
    });

    it("본문이 없으면 헤더의 기기 타입·이름을 쓴다", () => {
      // Given
      const source = { headers: { "x-device-type": "WEB", "x-device-name": "Chrome" } };

      // When
      const result = resolve(source);

      // Then
      expect(result).toEqual({ devicePlatform: "WEB", deviceModel: "Chrome" });
    });
  });

  describe("User-Agent", () => {
    it.each([
      ["iPhone Safari", IPHONE_SAFARI, "IOS"],
      ["Android Chrome", ANDROID_CHROME, "ANDROID"],
      ["Android WebView", ANDROID_WEBVIEW, "ANDROID"],
      ["okhttp", "okhttp/4.12.0", "ANDROID"],
      ["iOS CFNetwork/Darwin", "aido/1 CFNetwork/1494 Darwin/23.4.0", "IOS"],
    ])("%s에서 플랫폼을 확인한다", (_name, userAgent, platform) => {
      // Given

      // When
      const result = resolve({ userAgent });

      // Then
      expect(result).toEqual({ devicePlatform: platform });
    });

    it.each([
      ["iPad 데스크톱 모드(Macintosh)", IPAD_DESKTOP_MODE],
      ["Windows 데스크톱", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0"],
      ["Dart/Flutter", "Dart/3.3 (dart:io)"],
      ["curl", "curl/8.4.0"],
      ["검색 봇", GOOGLEBOT_SMARTPHONE],
      ["빈 문자열", ""],
      ["공백", "   "],
    ])("%s는 확인 불가로 비워 둔다", (_name, userAgent) => {
      // Given

      // When
      const result = resolve({ userAgent });

      // Then
      expect(result).toEqual({});
    });

    it("User-Agent가 없으면 확인 불가로 비워 둔다", () => {
      // Given

      // When
      const result = resolve({});

      // Then
      expect(result).toEqual({});
    });

    it("지나치게 긴 User-Agent도 예외 없이 처리한다", () => {
      // Given
      const userAgent = `${"x".repeat(100_000)} Android`;

      // When
      const result = resolve({ userAgent });

      // Then
      expect(result).toEqual({});
    });
  });

  describe("기기 이름", () => {
    it("제어문자와 방향 제어 문자를 제거하고 공백을 정리한다", () => {
      // Given
      const deviceName = "  iPhone\n\t15‮ Pro\u0000  ";

      // When
      const result = resolve({ deviceName });

      // Then
      expect(result).toEqual({ deviceModel: "iPhone 15 Pro" });
    });

    it("비ASCII 이름은 그대로 표시용으로 보존한다", () => {
      // Given
      const deviceName = "갤럭시 S24";

      // When
      const result = resolve({ deviceName });

      // Then
      expect(result).toEqual({ deviceModel: "갤럭시 S24" });
    });

    it("길이를 40자로 제한하고 서로게이트 쌍을 자르지 않는다", () => {
      // Given
      const deviceName = "😀".repeat(60);

      // When
      const result = resolve({ deviceName });

      // Then
      expect(result).toEqual({ deviceModel: "😀".repeat(40) });
    });

    it("제어문자만 있으면 비워 둔다", () => {
      // Given
      const deviceName = "\n\t\u0000";

      // When
      const result = resolve({ deviceName });

      // Then
      expect(result).toEqual({});
    });
  });

  describe("앱·OS 정보", () => {
    it("RequestClient가 정규화한 앱 버전·빌드·OS 버전·시간대와 첫 언어 태그를 남긴다", () => {
      // Given
      const source = {
        headers: {
          "x-os-version": " 18.1 ",
          "x-app-version": "1.14.0",
          "x-app-build": "123",
          "x-timezone": "Asia/Seoul",
        },
        acceptLanguage: "en-US,en;q=0.9",
      };

      // When
      const result = resolve(source);

      // Then
      expect(result).toEqual({
        osVersion: "18.1",
        appVersion: "1.14.0",
        appBuild: "123",
        locale: "en-US",
        timezone: "Asia/Seoul",
      });
    });

    it.each([
      ["언어 태그가 아닌 Accept-Language", "*"],
      ["중복 헤더(배열)", ["en-US", "ko"]],
    ])("%s는 언어를 비워 둔다", (_name, acceptLanguage) => {
      // Given

      // When
      const result = resolve({ acceptLanguage });

      // Then
      expect(result).toEqual({});
    });
  });
});
