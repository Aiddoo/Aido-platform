/**
 * User 모델 테스트 데이터 빌더
 *
 * Prisma 공식 권장 Builder 패턴으로 테스트 데이터 생성
 * 필드 추가 시 이 파일만 수정하면 됨
 *
 * @see https://www.prisma.io/docs/orm/prisma-client/testing/unit-testing
 *
 * @example
 * ```typescript
 * // 기본 사용자
 * const user = UserBuilder.create().build();
 *
 * // 커스텀 사용자
 * const admin = UserBuilder.create()
 *   .withEmail('admin@example.com')
 *   .withRole('ADMIN')
 *   .build();
 *
 * // 인증 완료 사용자
 * const verifiedUser = UserBuilder.create().verified().build();
 * ```
 */
import type {
	SubscriptionStatus,
	User,
	UserRole,
	UserStatus,
} from "@/generated/prisma/client";

export class UserBuilder {
	private data: User;

	private constructor() {
		const now = new Date();
		this.data = {
			id: `user-${crypto.randomUUID().slice(0, 8)}`,
			email: `test-${Date.now()}@example.com`,
			userTag: this.generateUserTag(),
			role: "USER" as UserRole,
			status: "PENDING_VERIFY" as UserStatus,
			emailVerifiedAt: null,
			twoFactorEnabled: false,
			twoFactorSecret: null,
			subscriptionStatus: "FREE" as SubscriptionStatus,
			subscriptionExpiresAt: null,
			revenueCatUserId: null,
			aiUsageCount: 0,
			aiUsageResetAt: now,
			createdAt: now,
			updatedAt: now,
			lastLoginAt: null,
			deletedAt: null,
		};
	}

	private generateUserTag(): string {
		const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
		return Array.from(
			{ length: 8 },
			() => chars[Math.floor(Math.random() * chars.length)],
		).join("");
	}

	static create(): UserBuilder {
		return new UserBuilder();
	}

	// === ID 관련 ===

	withId(id: string): UserBuilder {
		this.data.id = id;
		return this;
	}

	// === 이메일 관련 ===

	withEmail(email: string): UserBuilder {
		this.data.email = email;
		return this;
	}

	// === 태그 관련 ===

	withUserTag(tag: string): UserBuilder {
		this.data.userTag = tag;
		return this;
	}

	// === 역할 관련 ===

	withRole(role: UserRole): UserBuilder {
		this.data.role = role;
		return this;
	}

	asAdmin(): UserBuilder {
		this.data.role = "ADMIN";
		return this;
	}

	// === 상태 관련 ===

	withStatus(status: UserStatus): UserBuilder {
		this.data.status = status;
		return this;
	}

	/** 이메일 인증 완료 상태로 설정 */
	verified(): UserBuilder {
		this.data.status = "ACTIVE";
		this.data.emailVerifiedAt = new Date();
		return this;
	}

	/** 계정 잠금 상태로 설정 */
	locked(): UserBuilder {
		this.data.status = "LOCKED";
		return this;
	}

	/** 정지 상태로 설정 */
	suspended(): UserBuilder {
		this.data.status = "SUSPENDED";
		return this;
	}

	// === 구독 관련 ===

	withSubscription(status: SubscriptionStatus, expiresAt?: Date): UserBuilder {
		this.data.subscriptionStatus = status;
		this.data.subscriptionExpiresAt = expiresAt ?? null;
		return this;
	}

	/** 프리미엄 구독 사용자 */
	asPremium(expiresInDays = 30): UserBuilder {
		this.data.subscriptionStatus = "ACTIVE";
		this.data.subscriptionExpiresAt = new Date(
			Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
		);
		return this;
	}

	// === AI 사용량 관련 ===

	withAiUsage(count: number, resetAt?: Date): UserBuilder {
		this.data.aiUsageCount = count;
		this.data.aiUsageResetAt = resetAt ?? new Date();
		return this;
	}

	// === 타임스탬프 관련 ===

	withCreatedAt(date: Date): UserBuilder {
		this.data.createdAt = date;
		return this;
	}

	withLastLoginAt(date: Date): UserBuilder {
		this.data.lastLoginAt = date;
		return this;
	}

	/** Soft delete 처리된 사용자 (status도 SUSPENDED로 설정) */
	deleted(deletedAt?: Date): UserBuilder {
		this.data.deletedAt = deletedAt ?? new Date();
		this.data.status = "SUSPENDED";
		return this;
	}

	// === 빌드 ===

	build(): User {
		return { ...this.data };
	}

	/** 여러 개 생성 */
	static createMany(count: number): User[] {
		return Array.from({ length: count }, () => UserBuilder.create().build());
	}
}
