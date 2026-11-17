import type { DeviceType } from "@aido/api/vocabulary";

import type { SupportedLocale } from "#api/shared/domain/locale";

/** 요청에 IP·User-Agent가 없을 때 보안 기록에 남기는 값 */
export const REQUEST_ORIGIN_DEFAULTS = {
  UNKNOWN_IP: "unknown",
  UNKNOWN_USER_AGENT: "unknown",
} as const;

export type RequestDevicePlatform = DeviceType;

/** 요청 경계에서 정규화한 기기 정보. 관리자 알림 표시용이며 신뢰 판단에 쓰지 않는다 */
export interface RequestDevice {
  readonly devicePlatform?: RequestDevicePlatform;
  readonly deviceModel?: string;
  readonly osVersion?: string;
  readonly appVersion?: string;
  readonly appBuild?: string;
  /** Accept-Language 첫 언어 태그 (예: ko, en-US) */
  readonly locale?: string;
  /** X-Timezone IANA 시간대 */
  readonly timezone?: string;
}

export interface RequestMetadata {
  ip?: string;
  userAgent?: string;
  device?: RequestDevice;
  /** Accept-Language의 지원 언어. 보내지 않은 요청에는 없다. */
  locale?: SupportedLocale;
}
