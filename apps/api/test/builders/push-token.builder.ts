/**
 * PushToken 모델 테스트 데이터 빌더
 *
 * @example
 * ```typescript
 * // 기본 푸시 토큰
 * const token = PushTokenBuilder.create('user-123').build();
 *
 * // iOS 토큰
 * const iosToken = PushTokenBuilder.create('user-123').asIos().build();
 *
 * // 비활성 토큰
 * const inactive = PushTokenBuilder.create('user-123').asInactive().build();
 * ```
 */
import type { Platform, PushToken } from "#test/types/database-rows";

export class PushTokenBuilder {
  private data: PushToken;
  private static idCounter = 0;

  private constructor(userId: string) {
    const now = Temporal.Now.instant();
    PushTokenBuilder.idCounter += 1;
    this.data = {
      id: PushTokenBuilder.idCounter,
      userId,
      token: `ExponentPushToken[test-token-${PushTokenBuilder.idCounter}]`,
      deviceId: `device-${PushTokenBuilder.idCounter}`,
      platform: "IOS",
      sessionId: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      lastUsedAt: now,
      payloadVersion: 1,
      appVersion: null,
    };
  }

  static create(userId: string): PushTokenBuilder {
    return new PushTokenBuilder(userId);
  }

  /** ID 카운터 리셋 (테스트 간 격리용) */
  static resetIdCounter(): void {
    PushTokenBuilder.idCounter = 0;
  }

  withId(id: number): PushTokenBuilder {
    this.data.id = id;
    return this;
  }

  withToken(token: string): PushTokenBuilder {
    this.data.token = token;
    return this;
  }

  withDeviceId(deviceId: string): PushTokenBuilder {
    this.data.deviceId = deviceId;
    return this;
  }

  withPlatform(platform: Platform): PushTokenBuilder {
    this.data.platform = platform;
    return this;
  }

  asIos(): PushTokenBuilder {
    this.data.platform = "IOS";
    return this;
  }

  asAndroid(): PushTokenBuilder {
    this.data.platform = "ANDROID";
    return this;
  }

  asActive(): PushTokenBuilder {
    this.data.isActive = true;
    return this;
  }

  asInactive(): PushTokenBuilder {
    this.data.isActive = false;
    return this;
  }

  withCreatedAt(date: Temporal.Instant): PushTokenBuilder {
    this.data.createdAt = date;
    return this;
  }

  withLastUsedAt(date: Temporal.Instant): PushTokenBuilder {
    this.data.lastUsedAt = date;
    return this;
  }

  build(): PushToken {
    return { ...this.data };
  }

  static createMany(userId: string, count: number): PushToken[] {
    return Array.from({ length: count }, () => PushTokenBuilder.create(userId).build());
  }
}
