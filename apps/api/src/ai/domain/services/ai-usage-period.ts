/**
 * AI 사용량 리셋 주기 도메인 서비스 (순수)
 *
 * 월간 사용량은 KST 기준 매월 1일 00:00에 리셋된다. "새로운 달인지" 판정과
 * "다음 리셋 시각" 계산은 시간대 규칙이 얽힌 도메인 정책이므로 여기에 둔다.
 * 현재 시각은 참조값으로 주입받아 순수성을 유지한다.
 */
import { addMonths } from "@/shared/domain/date/utils/arithmetic";
import { toISOString, toIsoMonthId } from "@/shared/domain/date/utils/format";
import { firstOfMonthInTimezone } from "@/shared/domain/date/utils/timezone";

/** 사용량 리셋 기준 시간대 (KST). */
const BILLING_TIMEZONE = "Asia/Seoul";

/**
 * 마지막 리셋 시각이 참조 시점과 KST 기준 다른 달(YYYY-MXX)에 속하면 새로운 달.
 * 윤년/30·31일 경계는 `toIsoMonthId`가 월 식별자로 비교하므로 자동 처리된다.
 */
export function isNewBillingMonth(
	lastReset: Date | null,
	reference: Date,
): boolean {
	if (!lastReset) {
		return true;
	}
	return (
		toIsoMonthId(reference, BILLING_TIMEZONE) !==
		toIsoMonthId(lastReset, BILLING_TIMEZONE)
	);
}

/**
 * 다음 리셋 시각(KST 매월 1일 00:00)을 ISO 8601 문자열로 반환한다.
 *
 * @example KST 2026-04-18 14:00 → "2026-04-30T15:00:00.000Z" (KST 5/1 00:00)
 */
export function nextBillingResetIso(reference: Date): string {
	return toISOString(
		firstOfMonthInTimezone(addMonths(1, reference), BILLING_TIMEZONE),
	);
}
