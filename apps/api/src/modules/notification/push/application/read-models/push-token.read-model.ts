import type { PushDevicePlatform } from "@aido/api/vocabulary";

// DB PushToken 행이 구조적으로 이 모양을 만족한다
export interface PushTokenRecord {
  readonly id: number;
  readonly userId: string;
  readonly token: string;
  readonly deviceId: string;
  readonly platform: PushDevicePlatform;
  readonly isActive: boolean;
  readonly createdAt: Temporal.Instant;
  readonly updatedAt: Temporal.Instant;
  readonly lastUsedAt: Temporal.Instant;
  readonly payloadVersion: number;
  readonly appVersion: string | null;
}
