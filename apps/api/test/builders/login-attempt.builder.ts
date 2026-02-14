/**
 * LoginAttempt 모델 테스트 데이터 빌더
 *
 * @example
 * ```typescript
 * const attempt = LoginAttemptBuilder.create("test@example.com").build();
 * const failed = LoginAttemptBuilder.create("test@example.com").failed("INVALID_PASSWORD").build();
 * ```
 */

import type { AccountProvider, LoginAttempt } from "@/generated/prisma/client";

let idCounter = 1;

export class LoginAttemptBuilder {
	private data: LoginAttempt;

	private constructor(email: string) {
		this.data = {
			id: idCounter++,
			email,
			provider: "CREDENTIAL" as AccountProvider,
			ipAddress: "127.0.0.1",
			userAgent: "Mozilla/5.0 (Test Browser)",
			success: true,
			failureReason: null,
			createdAt: new Date(),
		};
	}

	static create(email: string): LoginAttemptBuilder {
		return new LoginAttemptBuilder(email);
	}

	static resetIdCounter(): void {
		idCounter = 1;
	}

	withId(id: number): LoginAttemptBuilder {
		this.data.id = id;
		return this;
	}

	withProvider(provider: AccountProvider): LoginAttemptBuilder {
		this.data.provider = provider;
		return this;
	}

	withIpAddress(ip: string): LoginAttemptBuilder {
		this.data.ipAddress = ip;
		return this;
	}

	withUserAgent(ua: string): LoginAttemptBuilder {
		this.data.userAgent = ua;
		return this;
	}

	/** 로그인 실패 */
	failed(reason: string): LoginAttemptBuilder {
		this.data.success = false;
		this.data.failureReason = reason;
		return this;
	}

	withCreatedAt(date: Date): LoginAttemptBuilder {
		this.data.createdAt = date;
		return this;
	}

	build(): LoginAttempt {
		return { ...this.data };
	}
}
