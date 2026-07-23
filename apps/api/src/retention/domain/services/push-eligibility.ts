import { resolveDeliveryTimezone } from "@/shared/domain/date/utils/timezone";

export interface RetentionPushEligibilityInput {
	readonly pushEnabled: boolean;
	readonly marketingPushAgreedAt: Date | null;
	readonly activeTokenCount: number;
	readonly timezone: string;
	readonly now: Date;
}

export function retentionPushSkipReason(
	input: RetentionPushEligibilityInput,
): string | null {
	if (!input.pushEnabled) return "PUSH_DISABLED";
	if (!input.marketingPushAgreedAt) return "MARKETING_CONSENT_REQUIRED";
	if (input.activeTokenCount === 0) return "NO_ACTIVE_TOKEN";
	const hour = localHour(input.now, input.timezone);
	if (hour < 8 || hour >= 21) return "MARKETING_QUIET_HOURS";
	return null;
}

function localHour(date: Date, timezone: string): number {
	// 마케팅 quiet-hours는 지역 기준 — 미상(UTC) 유저는 KST로 폴백해 판정
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: resolveDeliveryTimezone(timezone),
		hour: "2-digit",
		hourCycle: "h23",
	}).formatToParts(date);
	const hour = parts.find((part) => part.type === "hour")?.value;
	return Number(hour ?? 0);
}
