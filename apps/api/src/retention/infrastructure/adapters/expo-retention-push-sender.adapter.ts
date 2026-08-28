import { Inject, Injectable } from "@nestjs/common";

import {
	MARKETING_PUSH_OPT_OUT_TOKEN,
	type MarketingPushOptOutTokenPort,
	PUSH_PROVIDER,
	PUSH_RATE_LIMITER,
	type PushProvider,
	type PushRateLimiterPort,
} from "@/notification";

import type { RetentionPushSenderPort } from "../../application/ports/retention-push-sender.port";
import type {
	RetentionDeliveryResult,
	RetentionDispatchCandidate,
} from "../../application/ports/retention.repository.port";
import { retentionPushSkipReason } from "../../domain/services/push-eligibility";

@Injectable()
export class ExpoRetentionPushSenderAdapter implements RetentionPushSenderPort {
	constructor(
		@Inject(PUSH_PROVIDER) private readonly provider: PushProvider,
		@Inject(PUSH_RATE_LIMITER) private readonly rateLimiter: PushRateLimiterPort,
		@Inject(MARKETING_PUSH_OPT_OUT_TOKEN)
		private readonly optOutTokens: MarketingPushOptOutTokenPort,
	) {}

	isEligible(candidate: RetentionDispatchCandidate, now: Date): boolean {
		return !retentionPushSkipReason({
			pushEnabled: candidate.pushEnabled,
			marketingPushAgreedAt: candidate.marketingPushAgreedAt,
			activeTokenCount: candidate.tokens.length,
			timezone: candidate.timezone,
			now,
		});
	}

	async reserveRateLimit(candidate: RetentionDispatchCandidate, now: Date): Promise<boolean> {
		const reservation = { dispatchId: candidate.dispatchId, userId: candidate.userId };
		if (await this.rateLimiter.reserveGeneral(reservation)) return false;
		return !(await this.rateLimiter.reserveEngagement({
			...reservation,
			localDate: this.#localDate(now, candidate.timezone),
		}));
	}

	async send(candidate: RetentionDispatchCandidate): Promise<RetentionDeliveryResult[]> {
		const result = await this.provider.sendBatch(
			candidate.tokens.map((entry) => ({
				token: entry.token,
				title: candidate.title,
				body: candidate.body,
				categoryId: "MARKETING",
				sound: "default",
				data: {
					notificationId: candidate.notificationId,
					type: "SYSTEM_NOTICE",
					action: { type: "DEEP_LINK", url: candidate.actionUrl },
					campaignKey: candidate.campaignKey,
					variantId: candidate.variantId,
					purpose: "ENGAGEMENT",
					dispatchId: candidate.dispatchId,
					marketingOptOutToken: this.optOutTokens.issue(candidate.userId),
				},
			})),
		);
		return result.results;
	}

	#localDate(date: Date, timezone: string): string {
		return new Intl.DateTimeFormat("en-CA", {
			timeZone: timezone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		}).format(date);
	}
}
