import type { MarketingPushOptOutTokenPort, PushProvider } from "@/notification";
import { InMemoryPushRateLimiter } from "@/notification/infrastructure/rate-limiter/in-memory-push-rate-limiter";

import type { RetentionDispatchCandidate } from "../../application/ports/retention.repository.port";
import { ExpoRetentionPushSenderAdapter } from "./expo-retention-push-sender.adapter";

function candidate(
	overrides: Partial<RetentionDispatchCandidate> = {},
): RetentionDispatchCandidate {
	return {
		fence: {
			outboxId: "outbox-1",
			dispatchId: 41,
			publishAttempt: 1,
			processingJobId: "retention-job",
			deliveryAttemptCount: 1,
		},
		outboxId: "outbox-1",
		dispatchId: 41,
		notificationId: 51,
		userId: "user-1",
		title: "title",
		body: "body",
		actionUrl: "/feed",
		campaignKey: "new_user_retention_v2",
		variantId: "d1_return",
		timezone: "UTC",
		pushEnabled: true,
		nightPushEnabled: true,
		marketingPushAgreedAt: new Date("2026-08-01T00:00:00.000Z"),
		rateLimitReserved: false,
		tokens: [{ id: 1, token: "ExponentPushToken[test]" }],
		...overrides,
	};
}

describe("ExpoRetentionPushSenderAdapter", () => {
	it("동일 dispatch retry는 retention 전용 reservation으로 general+engagement quota를 재소비하지 않는다", async () => {
		const limiter = new InMemoryPushRateLimiter();
		const adapter = new ExpoRetentionPushSenderAdapter(
			{} as PushProvider,
			limiter,
			{} as MarketingPushOptOutTokenPort,
		);
		const now = new Date("2026-08-29T03:00:00.000Z");

		await expect(adapter.reserveRateLimit(candidate(), now)).resolves.toBe(true);
		await expect(adapter.reserveRateLimit(candidate(), now)).resolves.toBe(true);
		await expect(adapter.reserveRateLimit(candidate({ dispatchId: 42 }), now)).resolves.toBe(false);
		limiter.destroy();
	});

	it("rate reservation과 무관하게 현재 push 설정과 marketing opt-out을 매번 반영한다", () => {
		const adapter = new ExpoRetentionPushSenderAdapter(
			{} as PushProvider,
			{} as InMemoryPushRateLimiter,
			{} as MarketingPushOptOutTokenPort,
		);
		const now = new Date("2026-08-29T03:00:00.000Z");

		expect(adapter.isEligible(candidate({ rateLimitReserved: true }), now)).toBe(true);
		expect(
			adapter.isEligible(candidate({ rateLimitReserved: true, pushEnabled: false }), now),
		).toBe(false);
		expect(
			adapter.isEligible(candidate({ rateLimitReserved: true, marketingPushAgreedAt: null }), now),
		).toBe(false);
	});
});
