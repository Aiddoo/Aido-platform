/** 푸시 토큰 플랫폼 (Prisma `Platform` enum과 구조 동일) */
export type PushTokenPlatform = "IOS" | "ANDROID";

/**
 * 푸시 토큰 읽기 레코드 (도메인 소유 뷰).
 *
 * Prisma `PushToken` 행이 구조적으로 이 인터페이스를 만족한다.
 */
export interface PushTokenRecord {
  readonly id: number;
  readonly userId: string;
  readonly token: string;
  readonly deviceId: string;
  readonly platform: PushTokenPlatform;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly lastUsedAt: Date;
  readonly payloadVersion: number;
  readonly appVersion: string | null;
}
