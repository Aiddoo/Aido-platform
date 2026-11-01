import { match, P } from "ts-pattern";

import type { RequestMetadata } from "../../types/auth/auth.types.js";

export type SignupDevicePlatform = "IOS" | "ANDROID" | "WEB";

export interface SignupDevice {
  readonly devicePlatform?: SignupDevicePlatform;
  readonly deviceModel?: string;
}

const MAX_DEVICE_MODEL_LENGTH = 40;

function platformFromDeviceType(deviceType: string | undefined): SignupDevicePlatform | undefined {
  return match(deviceType?.trim().toUpperCase())
    .with("IOS", "ANDROID", "WEB", (platform) => platform)
    .otherwise(() => undefined);
}

function platformFromUserAgent(userAgent: string | undefined): SignupDevicePlatform | undefined {
  return match(userAgent)
    .with(P.string.regex(/android|okhttp/i), () => "ANDROID" as const)
    .with(P.string.regex(/iphone|ipad|ipod|cfnetwork|darwin/i), () => "IOS" as const)
    .otherwise(() => undefined);
}

function normalizeModel(deviceName: string | undefined): string | undefined {
  const model = deviceName
    ?.replaceAll(/\p{Cc}/gu, "")
    .trim()
    .slice(0, MAX_DEVICE_MODEL_LENGTH);
  return model || undefined;
}

/**
 * 가입 요청 메타데이터에서 확인된 기기 사실만 추려낸다.
 *
 * 명시된 기기 타입을 우선하고, 없으면 User-Agent에서 확인되는 플랫폼만 사용한다.
 * 어느 쪽에서도 확인되지 않으면 해당 필드를 비워 둔다.
 */
export function resolveSignupDevice(metadata: RequestMetadata | undefined): SignupDevice {
  const devicePlatform =
    platformFromDeviceType(metadata?.deviceType) ?? platformFromUserAgent(metadata?.userAgent);
  const deviceModel = normalizeModel(metadata?.deviceName);

  return {
    ...(devicePlatform ? { devicePlatform } : {}),
    ...(deviceModel ? { deviceModel } : {}),
  };
}
