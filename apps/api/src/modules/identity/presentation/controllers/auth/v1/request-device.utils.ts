import { isSemanticVersionAtLeast } from "@aido/api";
import Bowser from "bowser";
import { match, P } from "ts-pattern";

import type {
  RequestDevice,
  RequestDevicePlatform,
} from "#api/modules/identity/application/types/auth/auth.types";
import { normalizeIanaTimezone } from "#api/shared/domain/date/utils/timezone";

const MAX_DEVICE_MODEL_LENGTH = 40;
const MAX_USER_AGENT_LENGTH = 512;
const MAX_APP_VERSION_LENGTH = 30;
const OS_VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z._-]{0,19}$/;
const APP_BUILD_PATTERN = /^[0-9A-Za-z][0-9A-Za-z.]{0,19}$/;
const LANGUAGE_TAG_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{1,8}){0,3}$/;

export interface RequestDeviceSource {
  readonly userAgent?: string | string[];
  readonly deviceType?: string | string[];
  readonly deviceName?: string | string[];
  readonly osVersion?: string | string[];
  readonly appVersion?: string | string[];
  readonly appBuild?: string | string[];
  readonly acceptLanguage?: string | string[];
  readonly timezone?: string | string[];
}

function onlyString(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function platformFromDeviceType(deviceType: string | undefined): RequestDevicePlatform | undefined {
  return match(deviceType?.trim().toUpperCase())
    .with("IOS", "ANDROID", "WEB", (platform) => platform)
    .otherwise(() => undefined);
}

function platformFromBrowserUserAgent(userAgent: string): RequestDevicePlatform | undefined {
  const { os, platform } = Bowser.parse(userAgent);

  if (platform.type === "bot") {
    return undefined;
  }

  return match(os.name)
    .with("iOS", () => "IOS" as const)
    .with("Android", () => "ANDROID" as const)
    .otherwise(() => undefined);
}

function platformFromUserAgent(
  rawUserAgent: string | undefined,
): RequestDevicePlatform | undefined {
  const userAgent = rawUserAgent?.trim().slice(0, MAX_USER_AGENT_LENGTH);

  if (!userAgent) {
    return undefined;
  }

  return (
    platformFromBrowserUserAgent(userAgent) ??
    match(userAgent)
      .with(P.string.regex(/okhttp/i), () => "ANDROID" as const)
      .with(P.string.regex(/cfnetwork|darwin/i), () => "IOS" as const)
      .otherwise(() => undefined)
  );
}

function normalizeModel(deviceName: string | undefined): string | undefined {
  const model = Array.from(
    (deviceName ?? "")
      .replaceAll(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, " ")
      .replaceAll(/\s+/gu, " ")
      .trim(),
  )
    .slice(0, MAX_DEVICE_MODEL_LENGTH)
    .join("")
    .trim();

  return model || undefined;
}

function matchPattern(value: string | undefined, pattern: RegExp): string | undefined {
  const trimmed = value?.trim();
  return trimmed && pattern.test(trimmed) ? trimmed : undefined;
}

/** SemVer 형식인 앱 버전만 남긴다. 헤더가 없거나 형식이 틀리면 undefined */
export function normalizeAppVersion(header: unknown): string | undefined {
  return typeof header === "string" &&
    header.length <= MAX_APP_VERSION_LENGTH &&
    isSemanticVersionAtLeast(header, "0.0.0")
    ? header
    : undefined;
}

function languageFromAcceptLanguage(header: string | undefined): string | undefined {
  const primary = header?.split(",")[0]?.split(";")[0];
  return matchPattern(primary, LANGUAGE_TAG_PATTERN);
}

/**
 * 요청 헤더·본문에서 기기 정보를 정규화한다.
 *
 * 값은 모두 클라이언트가 보낸 것이므로 관리자 알림 표시용으로만 쓰고 신뢰 판단에 쓰지 않는다.
 * 앱이 명시한 기기 타입을 우선하고, 없거나 알 수 없으면 User-Agent에서 확인되는 모바일 플랫폼만 쓴다.
 * OS·앱 버전·언어·시간대는 정해진 형식만 남긴다(구 앱은 일부 헤더를 보내지 않는다).
 * 중복 헤더(배열)는 모호하므로 무시하며, 확인되지 않은 필드는 비워 둔다.
 */
export function resolveRequestDevice(source: RequestDeviceSource): RequestDevice {
  const devicePlatform =
    platformFromDeviceType(onlyString(source.deviceType)) ??
    platformFromUserAgent(onlyString(source.userAgent));
  const deviceModel = normalizeModel(onlyString(source.deviceName));
  const osVersion = matchPattern(onlyString(source.osVersion), OS_VERSION_PATTERN);
  const appVersion = normalizeAppVersion(onlyString(source.appVersion));
  const appBuild = matchPattern(onlyString(source.appBuild), APP_BUILD_PATTERN);
  const locale = languageFromAcceptLanguage(onlyString(source.acceptLanguage));
  const timezone = normalizeIanaTimezone(onlyString(source.timezone)) ?? undefined;

  return {
    ...(devicePlatform ? { devicePlatform } : {}),
    ...(deviceModel ? { deviceModel } : {}),
    ...(osVersion ? { osVersion } : {}),
    ...(appVersion ? { appVersion } : {}),
    ...(appBuild ? { appBuild } : {}),
    ...(locale ? { locale } : {}),
    ...(timezone ? { timezone } : {}),
  };
}
