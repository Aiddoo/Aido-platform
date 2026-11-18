import type { IncomingHttpHeaders } from "node:http";

import {
  isSemanticVersionAtLeast,
  DEFAULT_LOCALE,
  DEVICE_NAME_MAX_LENGTH,
  DEVICE_TYPES,
  type DeviceType,
  findSupportedLocale,
  IDEMPOTENCY_KEY_MAX_LENGTH,
  OS_VERSION_PATTERN,
  resolveSupportedLocale,
  type SupportedLocale,
} from "@aido/api/vocabulary";

import { normalizeIanaTimezone } from "#api/shared/domain/time/time-zone-name";

/** 앱이 매 요청에 보내는 헤더를 요청당 한 번 정규화한 값. 확인되지 않은 값은 null이다. */
export interface RequestClient {
  readonly requestId: string;
  /** SemVer 형식인 X-App-Version */
  readonly appVersion: string | null;
  readonly appBuild: string | null;
  /** X-Device-Type. User-Agent 판별은 인증 기기 정보(resolveRequestDevice)에서만 한다 */
  readonly platform: DeviceType | null;
  readonly osVersion: string | null;
  readonly deviceName: string | null;
  /** 런타임이 지원하는 정규 IANA X-Timezone */
  readonly timezone: string | null;
  /** Accept-Language를 보냈으면 지원 locale(requestedAppLocale), 보내지 않았으면 null */
  readonly locale: SupportedLocale | null;
  /** 형식이 맞는 Idempotency-Key. 사용자 행동 한 번을 가리킨다 */
  readonly idempotencyKey: string | null;
}

const MAX_APP_VERSION_LENGTH = 30;
const APP_BUILD_PATTERN = /^[0-9A-Za-z][0-9A-Za-z.]{0,19}$/;
const IDEMPOTENCY_KEY_PATTERN = new RegExp(`^[\\x21-\\x7e]{1,${IDEMPOTENCY_KEY_MAX_LENGTH}}$`);

function singleValue(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function matchPattern(value: string | undefined, pattern: RegExp): string | null {
  const trimmed = value?.trim();
  return trimmed && pattern.test(trimmed) ? trimmed : null;
}

/** SemVer 형식인 앱 버전만 남긴다. 헤더가 없거나 형식이 틀리면 null */
function normalizeAppVersion(value: unknown): string | null {
  return typeof value === "string" &&
    value.length <= MAX_APP_VERSION_LENGTH &&
    isSemanticVersionAtLeast(value, "0.0.0")
    ? value
    : null;
}

export function normalizeDevicePlatform(value: string | undefined): DeviceType | null {
  const normalized = value?.trim().toUpperCase();
  return DEVICE_TYPES.find((platform) => platform === normalized) ?? null;
}

/** 제어·방향 제어 문자를 지우고 표시 한도로 자른 기기 이름. 남는 글자가 없으면 null */
export function normalizeDeviceName(value: string | undefined): string | null {
  const name = Array.from(
    (value ?? "")
      .replaceAll(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, " ")
      .replaceAll(/\s+/gu, " ")
      .trim(),
  )
    .slice(0, DEVICE_NAME_MAX_LENGTH)
    .join("")
    .trim();

  return name || null;
}

// Accept-Language 첫 항목의 언어 태그. "en-US,en;q=0.9"는 "en-US"다
function primaryLanguageTag(header: unknown): string | null {
  if (typeof header !== "string") {
    return null;
  }
  const primary = header.split(",")[0]?.split(";")[0]?.trim() ?? "";
  return primary.length > 0 ? primary : null;
}

// 1.4.0부터 앱이 앱 언어를 Accept-Language로 보낸다
const APP_LOCALE_HEADER_MIN_APP_VERSION = "1.4.0";

/**
 * X-App-Version 없음·1.4.0 미만(1.10.0 이하 앱과 앱 밖 클라이언트)에서 지원하지 않는 언어만 ko로 둔다(1.4.0 전 앱은
 * iOS가 기기 언어를 붙였고 한국어 화면뿐이다, 1.4.0~1.10.0은 ko·en만 보낸다). 제거 조건은 docs/conventions/compatibility.md다.
 */
export function resolvePreI18nAppLocale(tag: string): SupportedLocale {
  return findSupportedLocale(tag) ?? DEFAULT_LOCALE;
}

/**
 * 저장하는 앱 언어. 보내지 않으면 null이라 저장된 locale을 덮어쓰지 않는다
 * (1.4.0에서 en으로 쓰는 유저가 구버전 기기로 토큰을 재등록해도 en이 유지된다).
 */
export function requestedAppLocale(
  header: unknown,
  appVersion: string | null,
): SupportedLocale | null {
  const tag = primaryLanguageTag(header);
  if (tag == null) {
    return null;
  }
  const sentByPreI18nApp =
    appVersion == null || !isSemanticVersionAtLeast(appVersion, APP_LOCALE_HEADER_MIN_APP_VERSION);
  return sentByPreI18nApp ? resolvePreI18nAppLocale(tag) : resolveSupportedLocale(tag);
}

/**
 * 응답 문구(오류 message 등)의 언어. Accept-Language 첫 항목을 앱과 같은 vocabulary 규칙으로 정한다.
 * 저장용 locale(requestedAppLocale)과 달리 보내지 않으면 ko다.
 */
export function resolveResponseLocale(header: unknown): SupportedLocale {
  return resolveSupportedLocale(primaryLanguageTag(header));
}

/**
 * 요청 헤더를 RequestClient로 정규화한다. 값은 모두 클라이언트가 보낸 것이므로 표시·호환 분기에만
 * 쓰고 신뢰 판단에 쓰지 않는다. 중복 헤더(배열)는 모호하므로 무시한다.
 */
export function parseRequestClient(headers: IncomingHttpHeaders, requestId: string): RequestClient {
  const appVersion = normalizeAppVersion(headers["x-app-version"]);
  return {
    requestId,
    appVersion,
    appBuild: matchPattern(singleValue(headers["x-app-build"]), APP_BUILD_PATTERN),
    platform: normalizeDevicePlatform(singleValue(headers["x-device-type"])),
    osVersion: matchPattern(singleValue(headers["x-os-version"]), OS_VERSION_PATTERN),
    deviceName: normalizeDeviceName(singleValue(headers["x-device-name"])),
    timezone: normalizeIanaTimezone(headers["x-timezone"]),
    locale: requestedAppLocale(headers["accept-language"], appVersion),
    idempotencyKey: matchPattern(singleValue(headers["idempotency-key"]), IDEMPOTENCY_KEY_PATTERN),
  };
}
