import Bowser from "bowser";
import { match, P } from "ts-pattern";

import type {
  RequestDevice,
  RequestDevicePlatform,
} from "#api/modules/identity/application/types/auth/auth.types";

const MAX_DEVICE_MODEL_LENGTH = 40;
const MAX_USER_AGENT_LENGTH = 512;

export interface RequestDeviceSource {
  readonly userAgent?: string | string[];
  readonly deviceType?: string | string[];
  readonly deviceName?: string | string[];
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

/**
 * 요청 헤더·본문에서 기기 정보를 정규화한다.
 *
 * 값은 모두 클라이언트가 보낸 것이므로 관리자 알림 표시용으로만 쓰고 신뢰 판단에 쓰지 않는다.
 * 앱이 명시한 기기 타입을 우선하고, 없거나 알 수 없으면 User-Agent에서 확인되는 모바일 플랫폼만 쓴다.
 * 중복 헤더(배열)는 모호하므로 무시하며, 확인되지 않은 필드는 비워 둔다.
 */
export function resolveRequestDevice(source: RequestDeviceSource): RequestDevice {
  const devicePlatform =
    platformFromDeviceType(onlyString(source.deviceType)) ??
    platformFromUserAgent(onlyString(source.userAgent));
  const deviceModel = normalizeModel(onlyString(source.deviceName));

  return {
    ...(devicePlatform ? { devicePlatform } : {}),
    ...(deviceModel ? { deviceModel } : {}),
  };
}
