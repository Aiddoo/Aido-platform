import type { SessionInfo } from "@aido/api";

import type { DeviceFingerprint } from "#api/auth/domain/constants/auth.constants";

/**
 * @aido/api에서 re-export (하위 호환성 유지)
 */
export type { SessionInfo };

/**
 * 세션 생성 데이터 (API 내부 전용)
 */
export interface CreateSessionData {
  userId: string;
  /** 선택적 - 토큰 생성 후 업데이트 가능 */
  refreshTokenHash?: string;
  tokenFamily: string;
  tokenVersion: number;
  deviceFingerprint: DeviceFingerprint;
  userAgent: string;
  ipAddress: string;
  expiresAt: Date;
}
