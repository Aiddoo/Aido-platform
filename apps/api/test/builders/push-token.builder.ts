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
import type { Platform, PushToken } from "@/generated/prisma/client";

export class PushTokenBuilder {
	private data: PushToken;
	private static idCounter = 0;

	private constructor(userId: string) {
		const now = new Date();
		PushTokenBuilder.idCounter += 1;
		this.data = {
			id: PushTokenBuilder.idCounter,
			userId,
			token: `ExponentPushToken[test-token-${PushTokenBuilder.idCounter}]`,
			deviceId: `device-${PushTokenBuilder.idCounter}`,
			platform: "IOS" as Platform,
			isActive: true,
			createdAt: now,
			updatedAt: now,
			lastUsedAt: now,
		};
	}

	static create(userId: string): PushTokenBuilder {
		return new PushTokenBuilder(userId);
	}

	/** ID 카운터 리셋 (테스트 간 격리용) */
	static resetIdCounter(): void {
		PushTokenBuilder.idCounter = 0;
	}

	// === ID 관련 ===

	withId(id: number): PushTokenBuilder {
		this.data.id = id;
		return this;
	}

	// === 토큰 관련 ===

	withToken(token: string): PushTokenBuilder {
		this.data.token = token;
		return this;
	}

	withDeviceId(deviceId: string): PushTokenBuilder {
		this.data.deviceId = deviceId;
		return this;
	}

	// === 플랫폼 관련 ===

	withPlatform(platform: Platform): PushTokenBuilder {
		this.data.platform = platform;
		return this;
	}

	asIos(): PushTokenBuilder {
		this.data.platform = "IOS" as Platform;
		return this;
	}

	asAndroid(): PushTokenBuilder {
		this.data.platform = "ANDROID" as Platform;
		return this;
	}

	// === 상태 관련 ===

	asActive(): PushTokenBuilder {
		this.data.isActive = true;
		return this;
	}

	asInactive(): PushTokenBuilder {
		this.data.isActive = false;
		return this;
	}

	// === 타임스탬프 관련 ===

	withCreatedAt(date: Date): PushTokenBuilder {
		this.data.createdAt = date;
		return this;
	}

	withLastUsedAt(date: Date): PushTokenBuilder {
		this.data.lastUsedAt = date;
		return this;
	}

	// === 빌드 ===

	build(): PushToken {
		return { ...this.data };
	}

	/** 여러 개 생성 */
	static createMany(userId: string, count: number): PushToken[] {
		return Array.from({ length: count }, () =>
			PushTokenBuilder.create(userId).build(),
		);
	}
}
