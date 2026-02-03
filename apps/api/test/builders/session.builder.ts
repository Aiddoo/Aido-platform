/**
 * Session 모델 테스트 데이터 빌더
 *
 * @example
 * ```typescript
 * // 기본 세션
 * const session = SessionBuilder.create('user-123').build();
 *
 * // 만료된 세션
 * const expired = SessionBuilder.create('user-123').expired().build();
 *
 * // 폐기된 세션
 * const revoked = SessionBuilder.create('user-123').revoked().build();
 * ```
 */

import * as crypto from "node:crypto";
import type { Session } from "@/generated/prisma/client";

export class SessionBuilder {
	private data: Session;

	private constructor(userId: string) {
		const now = new Date();
		this.data = {
			id: `session-${crypto.randomUUID().slice(0, 8)}`,
			userId,
			refreshTokenHash: crypto.randomBytes(32).toString("hex"),
			tokenFamily: crypto.randomUUID(),
			tokenVersion: 1,
			previousTokenHash: null,
			deviceFingerprint: crypto.randomBytes(32).toString("hex"),
			userAgent: "Mozilla/5.0 (Test Browser)",
			ipAddress: "127.0.0.1",
			expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7일 후
			revokedAt: null,
			revokedReason: null,
			createdAt: now,
			updatedAt: now,
			lastUsedAt: now,
		};
	}

	static create(userId: string): SessionBuilder {
		return new SessionBuilder(userId);
	}

	// === ID 관련 ===

	withId(id: string): SessionBuilder {
		this.data.id = id;
		return this;
	}

	// === 토큰 관련 ===

	withRefreshTokenHash(hash: string): SessionBuilder {
		this.data.refreshTokenHash = hash;
		return this;
	}

	withTokenFamily(family: string): SessionBuilder {
		this.data.tokenFamily = family;
		return this;
	}

	withTokenVersion(version: number): SessionBuilder {
		this.data.tokenVersion = version;
		return this;
	}

	withPreviousTokenHash(hash: string): SessionBuilder {
		this.data.previousTokenHash = hash;
		return this;
	}

	// === 디바이스 관련 ===

	withDeviceInfo(userAgent: string, ipAddress: string): SessionBuilder {
		this.data.userAgent = userAgent;
		this.data.ipAddress = ipAddress;
		return this;
	}

	// === 상태 관련 ===

	withExpiresAt(date: Date): SessionBuilder {
		this.data.expiresAt = date;
		return this;
	}

	/** 만료된 세션 */
	expired(): SessionBuilder {
		this.data.expiresAt = new Date(Date.now() - 1000);
		return this;
	}

	/** 폐기된 세션 */
	revoked(reason = "USER_LOGOUT"): SessionBuilder {
		this.data.revokedAt = new Date();
		this.data.revokedReason = reason;
		return this;
	}

	// === 타임스탬프 관련 ===

	withLastUsedAt(date: Date): SessionBuilder {
		this.data.lastUsedAt = date;
		return this;
	}

	// === 빌드 ===

	build(): Session {
		return { ...this.data };
	}
}
