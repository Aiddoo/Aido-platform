import type { IncomingHttpHeaders } from "node:http";

import { parseRequestClient } from "#api/platform/http/request-client/request-client";
import { TEST_REQUEST_ID } from "#test/mocks/request-client";

import type { RequestSource } from "../decorators/request-source.decorator.js";
import { toRequestMetadata } from "./auth-request.mapper.js";

function requestSource(headers: IncomingHttpHeaders): RequestSource {
  return {
    ip: "198.51.100.24",
    userAgent: headers["user-agent"],
    acceptLanguage: headers["accept-language"],
    client: parseRequestClient(headers, TEST_REQUEST_ID),
  };
}

describe("toRequestMetadata", () => {
  it("본문에 기기 정보가 있으면 헤더보다 우선해 정규화한다", () => {
    // Given
    const source = requestSource({ "x-device-type": "ANDROID", "x-device-name": "Header Phone" });

    // When
    const metadata = toRequestMetadata(source, { deviceType: "ios", deviceName: "iPhone 15" });

    // Then
    expect(metadata.device).toEqual({ devicePlatform: "IOS", deviceModel: "iPhone 15" });
  });

  it("앱이 보낸 버전·OS·언어·시간대 헤더를 기기 정보로 정규화한다", () => {
    // Given
    const source = requestSource({
      "x-device-type": "IOS",
      "x-device-name": "iPhone 16 Pro",
      "x-os-version": "18.1",
      "x-app-version": "1.14.0",
      "x-app-build": "123",
      "accept-language": "ko",
      "x-timezone": "Asia/Seoul",
    });

    // When
    const metadata = toRequestMetadata(source);

    // Then
    expect(metadata.device).toEqual({
      devicePlatform: "IOS",
      deviceModel: "iPhone 16 Pro",
      osVersion: "18.1",
      appVersion: "1.14.0",
      appBuild: "123",
      locale: "ko",
      timezone: "Asia/Seoul",
    });
  });
});
