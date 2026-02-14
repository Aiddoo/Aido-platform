/**
 * Verification 모델 테스트 데이터 빌더
 *
 * @example
 * ```typescript
 * const verification = VerificationBuilder.create("user-123", "EMAIL_VERIFY").build();
 * const expired = VerificationBuilder.create("user-123", "PASSWORD_RESET").expired().build();
 * const used = VerificationBuilder.create("user-123", "EMAIL_VERIFY").used().build();
 * ```
 */

import * as crypto from "node:crypto";
import type { Verification, VerificationType } from "@/generated/prisma/client";

let idCounter = 1;

export class VerificationBuilder {
	private data: Verification;

	private constructor(userId: string, type: VerificationType) {
		this.data = {
			id: idCounter++,
			userId,
			type,
			token: crypto.randomBytes(32).toString("hex"),
			expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10분 후
			usedAt: null,
			attempts: 0,
			createdAt: new Date(),
		};
	}

	static create(userId: string, type: VerificationType): VerificationBuilder {
		return new VerificationBuilder(userId, type);
	}

	static resetIdCounter(): void {
		idCounter = 1;
	}

	withId(id: number): VerificationBuilder {
		this.data.id = id;
		return this;
	}

	withToken(token: string): VerificationBuilder {
		this.data.token = token;
		return this;
	}

	withExpiresAt(date: Date): VerificationBuilder {
		this.data.expiresAt = date;
		return this;
	}

	/** 만료된 인증 */
	expired(): VerificationBuilder {
		this.data.expiresAt = new Date(Date.now() - 1000);
		return this;
	}

	/** 사용된 인증 */
	used(): VerificationBuilder {
		this.data.usedAt = new Date();
		return this;
	}

	withAttempts(count: number): VerificationBuilder {
		this.data.attempts = count;
		return this;
	}

	withCreatedAt(date: Date): VerificationBuilder {
		this.data.createdAt = date;
		return this;
	}

	build(): Verification {
		return { ...this.data };
	}
}
