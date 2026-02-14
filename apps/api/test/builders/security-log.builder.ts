/**
 * SecurityLog 모델 테스트 데이터 빌더
 *
 * @example
 * ```typescript
 * const log = SecurityLogBuilder.create("user-123", "LOGIN_SUCCESS").build();
 * const suspicious = SecurityLogBuilder.create("user-123", "SUSPICIOUS_ACTIVITY")
 *   .withMetadata({ reason: "multiple failed attempts" })
 *   .build();
 * ```
 */

import type { SecurityEvent, SecurityLog } from "@/generated/prisma/client";

let idCounter = 1;

export class SecurityLogBuilder {
	private data: SecurityLog;

	private constructor(userId: string, event: SecurityEvent) {
		this.data = {
			id: idCounter++,
			userId,
			event,
			ipAddress: "127.0.0.1",
			userAgent: "Mozilla/5.0 (Test Browser)",
			metadata: null,
			createdAt: new Date(),
		};
	}

	static create(userId: string, event: SecurityEvent): SecurityLogBuilder {
		return new SecurityLogBuilder(userId, event);
	}

	static resetIdCounter(): void {
		idCounter = 1;
	}

	withId(id: number): SecurityLogBuilder {
		this.data.id = id;
		return this;
	}

	withIpAddress(ip: string): SecurityLogBuilder {
		this.data.ipAddress = ip;
		return this;
	}

	withUserAgent(ua: string): SecurityLogBuilder {
		this.data.userAgent = ua;
		return this;
	}

	withMetadata(
		metadata: Record<string, unknown>,
	): SecurityLogBuilder {
		this.data.metadata = metadata as SecurityLog["metadata"];
		return this;
	}

	withCreatedAt(date: Date): SecurityLogBuilder {
		this.data.createdAt = date;
		return this;
	}

	build(): SecurityLog {
		return { ...this.data };
	}
}
