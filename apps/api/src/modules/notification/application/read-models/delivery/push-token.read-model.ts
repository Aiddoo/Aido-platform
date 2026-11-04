import type { PushDevicePlatform } from "@aido/api/vocabulary";

/**
 * 푸시 토큰 읽기 레코드 (도메인 소유 뷰).
 *
 * DB `PushToken` 행이 구조적으로 이 인터페이스를 만족한다.
 */
export interface PushTokenRecord {
  readonly id: number;
  readonly userId: string;
  readonly token: string;
  readonly deviceId: string;
  readonly platform: PushDevicePlatform;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly lastUsedAt: Date;
  readonly payloadVersion: number;
  readonly appVersion: string | null;
}
