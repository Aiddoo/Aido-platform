import type { IncomingHttpHeaders } from "node:http";

import {
  parseRequestClient,
  type RequestClient,
  requestedAppLocale,
  resolveResponseLocale,
} from "./request-client.js";
import { requestTimezoneIfSent, requestTimezoneOrUtc } from "./request-timezone.js";

const REQUEST_ID = "00000000-0000-4000-8000-000000000001";

describe("parseRequestClient — 요청 헤더를 한 번 정규화한다", () => {
  it("앱이 보내는 헤더를 모두 정규화해 담는다", () => {
    // Given
    const headers = {
      "x-app-version": "1.14.2",
      "x-app-build": "512",
      "x-device-type": " ios ",
      "x-device-name": "iPhone 16 Pro",
      "x-os-version": " 18.1 ",
      "x-timezone": "US/Eastern",
      "accept-language": "en-US,en;q=0.9",
    };

    // When
    const client = parseRequestClient(headers, REQUEST_ID);

    // Then
    expect(client).toEqual({
      requestId: REQUEST_ID,
      appVersion: "1.14.2",
      appBuild: "512",
      platform: "IOS",
      osVersion: "18.1",
      deviceName: "iPhone 16 Pro",
      timezone: "US/Eastern",
      locale: "en",
      idempotencyKey: null,
    });
  });

  it("헤더를 보내지 않은 구 앱은 요청 ID 외 모든 값이 null이다", () => {
    // Given
    const headers = {};

    // When
    const client = parseRequestClient(headers, REQUEST_ID);

    // Then
    expect(client).toEqual({
      requestId: REQUEST_ID,
      appVersion: null,
      appBuild: null,
      platform: null,
      osVersion: null,
      deviceName: null,
      timezone: null,
      locale: null,
      idempotencyKey: null,
    });
  });

  it.each<[string, IncomingHttpHeaders, keyof RequestClient]>([
    ["SemVer가 아닌 앱 버전", { "x-app-version": "latest" }, "appVersion"],
    ["30자를 넘는 앱 버전", { "x-app-version": `1.0.0-${"a".repeat(40)}` }, "appVersion"],
    ["공백이 섞인 빌드 번호", { "x-app-build": "12 3" }, "appBuild"],
    ["알 수 없는 기기 타입", { "x-device-type": "TOASTER" }, "platform"],
    ["허용하지 않는 문자가 섞인 OS 버전", { "x-os-version": "18.1<script>" }, "osVersion"],
    ["20자를 넘는 OS 버전", { "x-os-version": "1".repeat(21) }, "osVersion"],
    ["제어문자만 있는 기기 이름", { "x-device-name": "\n\t\u0000" }, "deviceName"],
    ["IANA가 아닌 시간대", { "x-timezone": "Mars/Olympus" }, "timezone"],
    ["빈 시간대", { "x-timezone": "  " }, "timezone"],
    ["고정 오프셋 시간대", { "x-timezone": "+09:00" }, "timezone"],
    ["UTC 시간대(기기 시간대를 못 읽은 출시 앱)", { "x-timezone": "UTC" }, "timezone"],
    ["UTC와 같은 이름", { "x-timezone": "Etc/UTC" }, "timezone"],
    ["중복 헤더(배열)", { "x-device-name": ["a", "b"] }, "deviceName"],
  ])("%s는 null로 둔다", (_name, headers, field) => {
    // When
    const client = parseRequestClient(headers, REQUEST_ID);

    // Then
    expect(client[field]).toBeNull();
  });

  it("기기 이름의 제어·방향 제어 문자를 지우고 40자(서로게이트 쌍 단위)로 자른다", () => {
    // Given
    const headers = { "x-device-name": `  iPhone\n\t15‮ ${"😀".repeat(60)}` };

    // When
    const client = parseRequestClient(headers, REQUEST_ID);

    // Then
    expect(client.deviceName).toBe(`iPhone 15 ${"😀".repeat(30)}`);
  });

  it.each<[string, IncomingHttpHeaders]>([
    ["버전 헤더 없음", {}],
    ["1.4.0 미만", { "x-app-version": "1.3.9" }],
    ["최신 버전", { "x-app-version": "1.17.1" }],
  ])("지원하지 않는 언어는 앱 버전과 상관없이 en으로 저장된다(%s)", (_name, versionHeaders) => {
    // Given
    const headers = { ...versionHeaders, "accept-language": "ja-JP,ja;q=0.9" };

    // When
    const client = parseRequestClient(headers, REQUEST_ID);

    // Then
    expect(client.locale).toBe("en");
  });
});

describe("requestedAppLocale — 저장하는 앱 언어", () => {
  it.each([
    ["ko", "ko"],
    ["en", "en"],
    ["ko-KR", "ko"],
    ["en-US", "en"],
    ["en-US,en;q=0.9,ko;q=0.8", "en"],
    ["ko-KR,ko;q=0.9", "ko"],
    ["EN-us", "en"],
    ["ja-JP,ja;q=0.9", "en"],
    ["zh_CN", "en"],
  ])("'%s' 헤더는 %s다", (header, expected) => {
    // When
    const locale = requestedAppLocale(header);

    // Then
    expect(locale).toBe(expected);
  });

  it.each([undefined, null, "", " , en", 123, ["en"]])(
    "헤더 미전송/비정상 값(%s)은 null — 저장된 locale을 덮어쓰지 않는다",
    (header) => {
      // When
      const locale = requestedAppLocale(header);

      // Then
      expect(locale).toBeNull();
    },
  );
});

describe("resolveResponseLocale — 응답 문구 언어", () => {
  it.each([
    [undefined, "ko"],
    ["", "ko"],
    ["ko-KR,ko;q=0.9", "ko"],
    ["ko;q=1", "ko"],
    ["en-US,en;q=0.9,ko;q=0.8", "en"],
    ["ja-JP,ja;q=0.9", "en"],
    ["zh_CN", "en"],
  ])("Accept-Language '%s'는 %s 문구를 받는다", (header, expected) => {
    // When
    const locale = resolveResponseLocale(header);

    // Then
    expect(locale).toBe(expected);
  });
});

describe("요청 시간대 규칙", () => {
  it("날짜 경계 계산은 시간대가 없으면 UTC를 쓴다", () => {
    // When
    const missing = requestTimezoneOrUtc({ timezone: null });
    const sent = requestTimezoneOrUtc({ timezone: "Asia/Seoul" });

    // Then
    expect(missing).toBe("UTC");
    expect(sent).toBe("Asia/Seoul");
  });

  it("저장값을 쓰는 경로는 보낸 시간대만 넘기고 없으면 undefined로 저장값을 유지한다", () => {
    // When
    const missing = requestTimezoneIfSent({ timezone: null });
    const sent = requestTimezoneIfSent({ timezone: "Asia/Seoul" });

    // Then
    expect(missing).toBeUndefined();
    expect(sent).toBe("Asia/Seoul");
  });

  it.each([
    {
      name: "UUID",
      value: "6f1d2c3a-0d4e-4c55-9a2b-111111111111",
      expected: "6f1d2c3a-0d4e-4c55-9a2b-111111111111",
    },
    { name: "128자", value: "a".repeat(128), expected: "a".repeat(128) },
    { name: "129자", value: "a".repeat(129), expected: null },
    { name: "공백이 든 값", value: "a b", expected: null },
    { name: "ASCII가 아닌 값", value: "키", expected: null },
    { name: "중복 헤더", value: ["a", "b"], expected: null },
  ])("Idempotency-Key $name은 $expected로 읽는다", ({ value, expected }) => {
    // Given
    const headers = { "idempotency-key": value };
    // When
    const client = parseRequestClient(headers, "request-1");
    // Then
    expect(client.idempotencyKey).toBe(expected);
  });
});
