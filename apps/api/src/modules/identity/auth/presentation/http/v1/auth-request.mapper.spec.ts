import { parseRequestClient } from "#api/platform/http/request-client/request-client";
import { TEST_REQUEST_ID } from "#test/mocks/request-client";

import { extractMetadata } from "./auth-request.mapper.js";

describe("extractMetadata", () => {
  it("감사 IP는 전달 헤더의 왼쪽 값이 아니라 Express가 확정한 req.ip를 사용한다", () => {
    // Given - 신뢰 프록시가 확정한 canonical IP와 공격자가 붙인 왼쪽 값
    const req = {
      ip: "198.51.100.24",
      headers: {
        "x-forwarded-for": "203.0.113.99, 198.51.100.24",
        "user-agent": "request-identity-test",
      },
    };

    // When
    const metadata = extractMetadata(req, parseRequestClient(req.headers, TEST_REQUEST_ID));

    // Then
    expect(metadata).toEqual({
      ip: "198.51.100.24",
      userAgent: "request-identity-test",
      deviceName: undefined,
      deviceType: undefined,
      device: {},
    });
  });

  it("본문에 기기 정보가 있으면 헤더보다 우선해 정규화한다", () => {
    // Given
    const req = {
      ip: "198.51.100.24",
      headers: { "x-device-type": "ANDROID", "x-device-name": "Header Phone" },
    };

    // When
    const metadata = extractMetadata(req, parseRequestClient(req.headers, TEST_REQUEST_ID), {
      deviceType: "ios",
      deviceName: "iPhone 15",
    });

    // Then
    expect(metadata.device).toEqual({ devicePlatform: "IOS", deviceModel: "iPhone 15" });
  });

  it("앱이 보낸 버전·OS·언어·시간대 헤더를 기기 정보로 정규화한다", () => {
    // Given
    const req = {
      ip: "198.51.100.24",
      headers: {
        "x-device-type": "IOS",
        "x-device-name": "iPhone 16 Pro",
        "x-os-version": "18.1",
        "x-app-version": "1.14.0",
        "x-app-build": "123",
        "accept-language": "ko",
        "x-timezone": "Asia/Seoul",
      },
    };

    // When
    const metadata = extractMetadata(req, parseRequestClient(req.headers, TEST_REQUEST_ID));

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
