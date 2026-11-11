import Bowser from "bowser";
import { match, P } from "ts-pattern";

import type {
  RequestDevice,
  RequestDevicePlatform,
} from "#api/modules/identity/auth/application/read-models/auth-result.read-model";
import {
  normalizeDeviceName,
  normalizeDevicePlatform,
  type RequestClient,
} from "#api/platform/http/request-client/request-client";

const MAX_USER_AGENT_LENGTH = 512;
const LANGUAGE_TAG_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{1,8}){0,3}$/;

export interface RequestDeviceSource {
  readonly client: RequestClient;
  readonly userAgent?: string;
  readonly acceptLanguage?: string | string[];
  /** 본문의 기기 이름. 구 앱이 로그인 본문에 보내므로 헤더보다 우선한다 */
  readonly deviceName?: string;
  /** 본문의 기기 타입. 구 앱이 로그인 본문에 보내므로 헤더보다 우선한다 */
  readonly deviceType?: string;
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

function languageFromAcceptLanguage(header: string | string[] | undefined): string | undefined {
  const primary = typeof header === "string" ? header.split(",")[0]?.split(";")[0]?.trim() : "";
  return primary && LANGUAGE_TAG_PATTERN.test(primary) ? primary : undefined;
}

/**
 * 가입·로그인 관리자 알림에 표시할 기기 정보를 만든다.
 *
 * 값은 모두 클라이언트가 보낸 것이므로 표시용으로만 쓰고 신뢰 판단에 쓰지 않는다.
 * 본문의 기기 이름·타입이 RequestClient의 헤더 값보다 우선하고, 기기 타입이 없거나 알 수 없으면
 * User-Agent에서 확인되는 모바일 플랫폼만 쓴다. 언어는 지원 locale이 아닌 첫 언어 태그(예: en-US)다.
 */
export function resolveRequestDevice(source: RequestDeviceSource): RequestDevice {
  const { client } = source;
  const devicePlatform =
    (source.deviceType == null ? client.platform : normalizeDevicePlatform(source.deviceType)) ??
    platformFromUserAgent(source.userAgent);
  const deviceModel =
    source.deviceName == null ? client.deviceName : normalizeDeviceName(source.deviceName);
  const locale = languageFromAcceptLanguage(source.acceptLanguage);

  return {
    ...(devicePlatform ? { devicePlatform } : {}),
    ...(deviceModel ? { deviceModel } : {}),
    ...(client.osVersion ? { osVersion: client.osVersion } : {}),
    ...(client.appVersion ? { appVersion: client.appVersion } : {}),
    ...(client.appBuild ? { appBuild: client.appBuild } : {}),
    ...(locale ? { locale } : {}),
    ...(client.timezone ? { timezone: client.timezone } : {}),
  };
}
