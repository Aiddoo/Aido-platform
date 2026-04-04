/**
 * UserLocation 모델 테스트 데이터 빌더
 *
 * @example
 * ```typescript
 * // 기본 위치 (서울)
 * const location = UserLocationBuilder.create('user-123').build();
 *
 * // 부산 위치
 * const busan = UserLocationBuilder.create('user-123').asBusan().build();
 *
 * // 커스텀 좌표
 * const custom = UserLocationBuilder.create('user-123')
 *   .withLatitude(35.0)
 *   .withLongitude(129.0)
 *   .withGrid(98, 76)
 *   .build();
 * ```
 */
import type { UserLocation } from "@/generated/prisma/client";

export class UserLocationBuilder {
	private data: UserLocation;
	private static idCounter = 0;

	private constructor(userId: string) {
		UserLocationBuilder.idCounter += 1;
		this.data = {
			id: `loc-${UserLocationBuilder.idCounter}`,
			userId,
			latitude: 37.5665,
			longitude: 126.978,
			gridX: 60,
			gridY: 127,
			updatedAt: new Date(),
		};
	}

	static create(userId: string): UserLocationBuilder {
		return new UserLocationBuilder(userId);
	}

	static resetIdCounter(): void {
		UserLocationBuilder.idCounter = 0;
	}

	// ========================================
	// 단일 필드 설정
	// ========================================

	withId(id: string): UserLocationBuilder {
		this.data.id = id;
		return this;
	}

	withLatitude(latitude: number): UserLocationBuilder {
		this.data.latitude = latitude;
		return this;
	}

	withLongitude(longitude: number): UserLocationBuilder {
		this.data.longitude = longitude;
		return this;
	}

	withGrid(gridX: number, gridY: number): UserLocationBuilder {
		this.data.gridX = gridX;
		this.data.gridY = gridY;
		return this;
	}

	// ========================================
	// 프리셋 상태
	// ========================================

	/** 부산 좌표 프리셋 (35.1796, 129.0756, grid: 98, 76) */
	asBusan(): UserLocationBuilder {
		this.data.latitude = 35.1796;
		this.data.longitude = 129.0756;
		this.data.gridX = 98;
		this.data.gridY = 76;
		return this;
	}

	/** 제주 좌표 프리셋 (33.4996, 126.5312, grid: 52, 38) */
	asJeju(): UserLocationBuilder {
		this.data.latitude = 33.4996;
		this.data.longitude = 126.5312;
		this.data.gridX = 52;
		this.data.gridY = 38;
		return this;
	}

	// ========================================
	// 빌드
	// ========================================

	build(): UserLocation {
		return { ...this.data };
	}

	static createMany(userId: string, count: number): UserLocation[] {
		return Array.from({ length: count }, () =>
			UserLocationBuilder.create(userId).build(),
		);
	}
}
